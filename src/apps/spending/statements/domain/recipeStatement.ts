import { fileHoldings } from './fileHoldings'
import { REVOLUT_STATEMENT } from './revolutRecipe'
import type { HeldRow } from './fileHoldings'
import { PENDING_KEY_FACT } from './statementRows'
import type { DraftedAccount, FileNote, StatementReading, StatementRefusal, StatementRow } from './statementRows'
import { REVOLUT_BANK, draftedAccount, revolutIban } from '../../accounts/domain/accountDraft'
import { earliestStart, openingOn } from '../../accounts/domain/bankOpening'
import { sameBank } from '../../workbook/domain/account'
import type { Account } from '../../workbook/domain/account'
import { categoryWithRole } from '../../workbook/domain/category'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { DateRange } from '../../../../shared/calendar/dateRange'
import { absAccountMoney, addAccountMoney, negateAccountMoney, subtractAccountMoney, ZERO_ACCOUNT_MONEY } from '../../../../shared/money/accountMoney'
import type { AccountMoney } from '../../../../shared/money/accountMoney'
import { currencyCodeOf } from '../../../../shared/money/currencyCode'
import type { CurrencyCode } from '../../../../shared/money/currencyCode'
import { accountMoneyOfDecimal } from '../../../../shared/money/decimal'
import type { Recipe, RecipeField, TableFile } from '../../../../shared/recipes/domain/recipe'
import { runRecipe } from '../../../../shared/recipes/domain/runRecipe'
import type { AskedRow, RecipeRow } from '../../../../shared/recipes/domain/runRecipe'
import { tableRows } from '../../../../shared/recipes/domain/tableRows'
import { amountText } from '../../../../shared/storage/domain/recordFields'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { occurrenceKeys } from '../../../../shared/text/factKey'

/**
 * The kinds of row Spending reads a statement's rows as. `payment` is any completed row, `exchange` and `cash-withdrawal`
 * are completed rows of those types, `pending` is one the bank has not booked, and `other-product` and `not-completed` are
 * counted and left out.
 */
export const STATEMENT_KINDS = ['payment', 'exchange', 'cash-withdrawal', 'pending', 'other-product', 'not-completed'] as const

type StatementKind = (typeof STATEMENT_KINDS)[number]

/**
 * A recipe Spending reads statement files with, the name of the bank whose accounts take its rows, which is also a fee row's
 * payee, and the currency of every row for a file whose rows name none, or null when each names its own. A kind that comes
 * in reads `started` and `startedTime`, `amount`, `fee`, `currency`, `description` and `product`, whose `Savings` sends a row to
 * a savings account, and a completed row may also read `completed`, `completedTime` and the `balance` after it.
 */
export interface StatementRecipe {
  readonly recipe: Recipe<TableFile>
  readonly bank: string
  readonly currency: CurrencyCode | null
}

/** How a fee row's description names the row it was charged on. */
export type FeeDescription = (description: string) => string

/** When a row started: its day, and one text however the file writes it. */
interface Started {
  readonly date: CivilDate
  readonly at: string
}

/** A row of a kind that comes in, completed or pending. A pending row has no balance and no completed time. */
interface ComingRow {
  readonly line: number
  readonly started: Started
  readonly amount: AccountMoney
  readonly fee: AccountMoney
  readonly onSavings: boolean
  readonly exchange: boolean
  readonly cashWithdrawal: boolean
  readonly currency: string
  readonly description: string
  /** Empty where the file leaves it out. */
  readonly completedAt: string
  readonly balance: AccountMoney | null
  readonly pending: boolean
}

class Refused extends Error {
  readonly refusal: StatementRefusal

  constructor(refusal: StatementRefusal) {
    super(refusal.kind)
    this.refusal = refusal
  }
}

function moneyField(row: RecipeRow, field: string): AccountMoney | null {
  const decimal = row.decimals[field] ?? null
  return decimal === null ? null : accountMoneyOfDecimal(decimal)
}

function atOf(date: CivilDate, time: string | null | undefined): string {
  return `${date} ${time === null || time === undefined || time === '' ? '00:00:00' : time}`
}

function comingRow(row: RecipeRow, line: number, currency: CurrencyCode | null): ComingRow {
  const started = row.dates['started']!
  const completed = row.dates['completed'] ?? null
  return {
    line,
    started: { date: started, at: atOf(started, row.texts['startedTime']) },
    amount: moneyField(row, 'amount') ?? ZERO_ACCOUNT_MONEY,
    fee: moneyField(row, 'fee') ?? ZERO_ACCOUNT_MONEY,
    onSavings: (row.texts['product'] ?? '').toLowerCase() === 'savings',
    exchange: row.kind === 'exchange',
    cashWithdrawal: row.kind === 'cash-withdrawal',
    currency: (row.texts['currency'] ?? currency ?? '').toUpperCase(),
    description: row.texts['description'] ?? '',
    completedAt: completed === null ? '' : atOf(completed, row.texts['completedTime']),
    balance: moneyField(row, 'balance'),
    pending: row.kind === 'pending',
  }
}

/** The recipe's field of that name, wherever a section or a kind defines it. */
function fieldOf(recipe: Recipe<TableFile>, name: string): RecipeField | undefined {
  return recipe.sections
    .flatMap((section) => [section.fields, ...section.kinds.map((kind) => kind.fields)])
    .map((fields) => fields[name])
    .find((field) => field !== undefined)
}

function askedRefusal(recipe: Recipe<TableFile>, asked: AskedRow, lines: readonly number[]): StatementRefusal {
  const line = lines[asked.place ?? 0] ?? 0
  if (asked.why.kind !== 'unreadable') return { kind: 'no-kind', line }
  const field = fieldOf(recipe, asked.why.field)
  const reads = field?.as === 'date' || field?.as === 'time' ? 'day' : field?.as === 'decimal' ? 'amount' : 'text'
  return { kind: 'unreadable', line, column: field?.from ?? asked.why.field, text: asked.why.text, reads }
}

/**
 * A note for each product and currency whose last balance differs from what its rows add up to, as the first balance plus
 * each later row's amount less its fee, in the order they completed. A row missing from the export shows this way. It
 * never refuses, since the balance is the bank's word and the rows are what count.
 */
function balanceNotes(rows: readonly ComingRow[]): FileNote[] {
  const chains = new Map<string, ComingRow[]>()
  for (const row of rows) {
    if (row.balance === null || row.completedAt === '') continue
    const key = `${row.onSavings} ${row.currency}`
    chains.set(key, [...(chains.get(key) ?? []), row])
  }
  return [...chains.values()].flatMap((chain): FileNote[] => {
    const [first, ...later] = [...chain].sort((earlier, next) => earlier.completedAt.localeCompare(next.completedAt))
    const last = later.at(-1)
    const currency = currencyCodeOf(first?.currency ?? '')
    if (first?.balance == null || last?.balance == null || currency === null) return []
    const worked = later.reduce((sum, row) => addAccountMoney(sum, subtractAccountMoney(row.amount, row.fee)), first.balance)
    return worked === last.balance ? [] : [{ kind: 'balance-differs', savings: first.onSavings, currency, balance: last.balance, worked }]
  })
}

/** The legs of each pocket move, a current row and a savings row of the opposite amount in the same second, one to one, each with the time both legs share. */
function pocketMoves(rows: readonly ComingRow[]): ReadonlyMap<ComingRow, string> {
  const keyOf = (row: ComingRow, amount: number): string => `${row.currency} ${amount} ${row.started.at}`
  const savingsRows = new Map<string, ComingRow[]>()
  for (const row of rows) {
    if (row.onSavings) savingsRows.set(keyOf(row, row.amount), [...(savingsRows.get(keyOf(row, row.amount)) ?? []), row])
  }
  const times = new Map<ComingRow, string>()
  for (const row of rows) {
    const mirror = row.onSavings || row.amount === ZERO_ACCOUNT_MONEY ? undefined : savingsRows.get(keyOf(row, -row.amount))?.shift()
    if (mirror !== undefined) {
      times.set(row, row.started.at)
      times.set(mirror, row.started.at)
    }
  }
  return times
}

/**
 * The account a product's rows in one currency need, opening on their first day at their first balance as their last balance
 * and the rows give it, or at zero where the file prints no balance. Null for a currency Kuna does not keep.
 */
function draftFor(chain: readonly ComingRow[], bank: string, accounts: readonly Pick<Account, 'name' | 'bank' | 'kind' | 'iban'>[]): DraftedAccount | null {
  const first = chain[0]!
  const currency = currencyCodeOf(first.currency)
  if (currency === null) return null
  const rows = chain.filter((row) => !row.pending).map((row) => ({ date: row.started.date, amount: subtractAccountMoney(row.amount, absAccountMoney(row.fee)) }))
  const stated =
    chain
      .filter((row) => row.balance !== null && row.completedAt !== '')
      .sort((earlier, next) => earlier.completedAt.localeCompare(next.completedAt))
      .at(-1)?.balance ?? null
  const evidence = { rows, stated }
  const { opening, openedOn } = openingOn(evidence, earliestStart(evidence) ?? first.started.date)
  const kind = first.onSavings ? 'savings' : 'bank'
  const iban = sameBank(bank, REVOLUT_BANK) ? revolutIban(kind, accounts) : ''
  return { account: draftedAccount({ kind, bank, currency, iban, opening, openedOn }, accounts, 'provider-file'), evidence }
}

/** The days a file holds whole for each account, from its first row's day to its last. */
function daysCovered(rows: readonly StatementRow[]): ReadonlyMap<RecordId, DateRange> {
  const covers = new Map<RecordId, DateRange>()
  for (const { account, date } of rows) {
    const held = covers.get(account)
    covers.set(account, held === undefined ? { from: date, to: date } : { from: date < held.from ? date : held.from, to: date > held.to ? date : held.to })
  }
  return covers
}

/**
 * Reads a statement file by a recipe, its cells as `readFirstSheetCells` gives them. Completed rows count, and pending ones
 * come marked as pending, keyed apart so a completed row keeps its key. Rows of another state or product are counted in a
 * note. A row goes to the open account of the recipe's bank in its currency, or a closed one when no other fits, or a
 * `Savings` row to the savings account of that bank and currency, left out with a note when there is none. A current row and
 * a savings row of the opposite amount in the same second are a pocket move, whose legs share a time, as an exchange's do.
 * A row no kind takes or whose field cannot be read refuses the whole file, naming its line, since a row left out would throw
 * every balance after it. So does a current row in a currency no account keeps that is no currency code, and two open
 * accounts a row could go to. A fee becomes a row of its own in Bank fees. A last balance its rows do not add up to is a
 * note, per product. Each account the file needs and Kuna does not keep comes drafted, every currency at once.
 */
export function recipeStatement(
  source: StatementRecipe,
  cells: readonly (readonly string[])[],
  fileName: string,
  book: Pick<SpendingBook, 'accounts' | 'categories'>,
  feeOn: FeeDescription,
): StatementReading {
  try {
    return readRows(source, cells, fileName, book, feeOn)
  } catch (failure) {
    if (failure instanceof Refused) return { refused: failure.refusal, missing: [], holdings: [] }
    throw failure
  }
}

/** The recipes Import reads a statement file with: Revolut's export, which Kuna brings, then each table recipe the file keeps. */
export function statementRecipesOf(book: Pick<SpendingBook, 'recipes'>): readonly StatementRecipe[] {
  const saved = book.recipes.flatMap(({ recipe, bank, currency }): StatementRecipe[] => (recipe.file.format === 'table' ? [{ recipe: { ...recipe, file: recipe.file }, bank, currency }] : []))
  return [REVOLUT_STATEMENT, ...saved]
}

/**
 * Reads a statement file by the first of the recipes whose columns head one of its first rows, the ones Kuna brings first. A file
 * none of them fits is refused, with the first column each recipe looked for and did not find.
 */
export function statementOfFile(
  recipes: readonly StatementRecipe[],
  cells: readonly (readonly string[])[],
  fileName: string,
  book: Pick<SpendingBook, 'accounts' | 'categories'>,
  feeOn: FeeDescription,
): StatementReading {
  const fitting = recipes.find((source) => tableRows(source.recipe, cells).kind === 'read')
  if (fitting !== undefined) return recipeStatement(fitting, cells, fileName, book, feeOn)
  if (recipes.length === 1) return recipeStatement(recipes[0]!, cells, fileName, book, feeOn)
  const misses = recipes.flatMap((source) => {
    const table = tableRows(source.recipe, cells)
    return table.kind === 'misfit' && table.misfit.kind === 'no-column' ? [{ recipe: source.recipe.name, column: table.misfit.column }] : []
  })
  return { refused: { kind: 'no-recipe', misses }, missing: [], holdings: [] }
}

function readRows(source: StatementRecipe, cells: readonly (readonly string[])[], fileName: string, book: Pick<SpendingBook, 'accounts' | 'categories'>, feeOn: FeeDescription): StatementReading {
  const { recipe } = source
  const table = tableRows(recipe, cells)
  if (table.kind === 'misfit') throw new Refused({ kind: 'no-column', column: table.misfit.kind === 'no-column' ? table.misfit.column : '' })
  const run = runRecipe(recipe, table.rows)
  if (run.kind === 'misfit') throw new Refused({ kind: 'no-column', column: run.misfit.kind === 'no-column' ? run.misfit.column : '' })
  const [asked] = [...run.asked].sort((one, other) => (one.place ?? 0) - (other.place ?? 0))
  if (asked !== undefined) throw new Refused(askedRefusal(recipe, asked, table.lines))

  const counted = (kind: StatementKind): readonly RecipeRow[] => run.rows.filter((row) => row.kind === kind)
  const otherStates = counted('not-completed').length
  const otherProducts = new Map<string, number>()
  for (const row of counted('other-product')) {
    const product = row.texts['product'] ?? ''
    otherProducts.set(product, (otherProducts.get(product) ?? 0) + 1)
  }
  const coming = run.rows.filter((row) => row.kind !== 'not-completed' && row.kind !== 'other-product').map((row) => comingRow(row, table.lines[row.place] ?? 0, source.currency))

  const ofBank = book.accounts.filter((account) => sameBank(account.bank, source.bank))
  const feeCategory = categoryWithRole(book.categories, 'bank-fees')?.id ?? null
  const savingsLeftOut: string[] = []
  const pocketTimes = pocketMoves(coming)
  const kept: Omit<StatementRow, 'importKey'>[] = []
  const facts: string[][] = []
  const fees: AccountMoney[] = []
  const unkept = new Map<string, ComingRow[]>()
  const held: HeldRow[] = []

  for (const row of coming) {
    const fitting = ofBank.filter((candidate) => candidate.currency === row.currency && candidate.kind === (row.onSavings ? 'savings' : 'bank'))
    const open = fitting.filter((candidate) => !candidate.closed)
    if (open.length > 1) throw new Refused({ kind: 'many-accounts', bank: source.bank, names: open.map((candidate) => candidate.name), currency: row.currency })
    const account = open[0] ?? fitting[0]
    held.push({ savings: row.onSavings, currency: row.currency, date: row.started.date, account: account?.id ?? null })
    if (account === undefined) {
      if (!row.onSavings && currencyCodeOf(row.currency) === null) throw new Refused({ kind: 'not-a-currency', line: row.line, text: row.currency })
      if (row.onSavings) savingsLeftOut.push(row.currency)
      const product = `${row.onSavings} ${row.currency}`
      unkept.set(product, [...(unkept.get(product) ?? []), row])
      continue
    }
    const pocketAt = pocketTimes.get(row)
    kept.push({
      account: account.id,
      date: row.started.date,
      amount: row.amount,
      payee: row.description,
      category: null,
      description: row.description,
      counterpartyIban: '',
      movedAt: pocketAt ?? (row.exchange ? row.started.at : ''),
      pocket: pocketAt !== undefined,
      cashWithdrawal: row.cashWithdrawal,
      pending: row.pending,
    })
    const rowFacts = [account.id, row.started.at, amountText(row.amount), amountText(row.fee), row.description]
    facts.push(row.pending ? [PENDING_KEY_FACT, ...rowFacts] : rowFacts)
    fees.push(row.fee)
  }

  const missing = [...unkept.values()].flatMap((chain) => draftFor(chain, source.bank, book.accounts) ?? [])
  const holdings = fileHoldings(held)
  if (missing.some(({ account }) => account.kind === 'bank')) return { refused: { kind: 'missing-accounts' }, missing, holdings }

  const keys = occurrenceKeys(facts)
  const rows = kept.flatMap((row, index): StatementRow[] => {
    const importKey = keys[index]!
    const fee = fees[index]!
    return [
      ...(row.amount === ZERO_ACCOUNT_MONEY ? [] : [{ ...row, importKey }]),
      ...(fee === ZERO_ACCOUNT_MONEY
        ? []
        : [
            {
              ...row,
              amount: negateAccountMoney(absAccountMoney(fee)),
              payee: source.bank,
              category: feeCategory,
              description: feeOn(row.description),
              movedAt: '',
              pocket: false,
              cashWithdrawal: false,
              importKey: `${importKey}-fee`,
            },
          ]),
    ]
  })
  const draftedSavings = new Set<string>(missing.filter(({ account }) => account.kind === 'savings').map(({ account }) => account.currency))
  const undraftedSavings = savingsLeftOut.filter((currency) => !draftedSavings.has(currency))
  const fileNotes: FileNote[] = [
    ...(otherStates === 0 ? [] : [{ kind: 'not-completed', count: otherStates } as const]),
    ...(undraftedSavings.length === 0 ? [] : [{ kind: 'savings-left-out', count: undraftedSavings.length, currencies: [...new Set(undraftedSavings)] } as const]),
    ...balanceNotes(coming),
    ...[...otherProducts].map(([product, count]): FileNote => ({ kind: 'other-product', count, product })),
  ]
  return { statement: { label: fileName, rows, covers: daysCovered(rows), fileNotes }, missing, holdings }
}
