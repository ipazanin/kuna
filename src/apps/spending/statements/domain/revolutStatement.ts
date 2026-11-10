import type { DraftedAccount, StatementReading, StatementRow } from './statementRows'
import { words } from './words'
import { draftedAccount } from '../../accounts/domain/accountDraft'
import { earliestStart, openingOn } from '../../accounts/domain/bankOpening'
import { bankFeesCategory } from '../../categories/domain/starterCategories'
import type { Account } from '../../workbook/domain/account'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import { civilDateFromSerial, parseCivilDate } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { absAccountMoney, accountMoneyFromAmount, addAccountMoney, negateAccountMoney, subtractAccountMoney, ZERO_ACCOUNT_MONEY } from '../../../../shared/money/accountMoney'
import type { AccountMoney } from '../../../../shared/money/accountMoney'
import { EURO, currencyCodeOf } from '../../../../shared/money/currencyCode'
import { roundHalfAwayFromZero } from '../../../../shared/money/money'
import { formatAccountMoney } from '../../../../shared/money/moneyFormat'
import { amountText } from '../../../../shared/storage/domain/recordFields'
import { decimalOf } from '../../../../shared/storage/domain/storedFields'
import { occurrenceKeys } from '../../../../shared/text/factKey'
import { listInWords } from '../../../../shared/text/listInWords'
import { plural } from '../../../../shared/text/translation'
import type { CroatianForms, EnglishForms } from '../../../../shared/text/translation'

/** A cell of a spreadsheet file: text, a number, a date as a serial number, or a flag. */
type SheetCell = string | number | boolean | undefined

/** The columns of Revolut's export, as the open-source parsers name them, since Revolut publishes no definition. */
const COLUMNS = ['Type', 'Product', 'Started Date', 'Completed Date', 'Description', 'Amount', 'Fee', 'Currency', 'State', 'Balance'] as const

type Column = (typeof COLUMNS)[number]

function cellText(cell: SheetCell): string {
  return cell === undefined ? '' : String(cell).trim()
}

function isBlank(row: readonly SheetCell[]): boolean {
  return row.every((cell) => cellText(cell) === '')
}

const SECONDS_PER_DAY = 86_400

/** When a row started: its day, and one text however the file writes it. */
interface Started {
  readonly date: CivilDate
  readonly at: string
}

/** A started time as one text, whether the file writes it as text or as a date cell, so one row gets one key from either file. */
function startedOf(cell: SheetCell): Started | null {
  if (typeof cell === 'number') {
    const seconds = roundHalfAwayFromZero(cell * SECONDS_PER_DAY)
    const date = civilDateFromSerial(Math.floor(seconds / SECONDS_PER_DAY))
    const inDay = seconds % SECONDS_PER_DAY
    const [hours, minutes, rest] = [Math.floor(inDay / 3600), Math.floor(inDay / 60) % 60, inDay % 60].map((part) => String(part).padStart(2, '0'))
    return { date, at: `${date} ${hours}:${minutes}:${rest}` }
  }
  const [, day, hours = '0', minutes = '00', seconds = '00'] = /^(\d{4}-\d{2}-\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(cellText(cell)) ?? []
  const date = parseCivilDate(day ?? '')
  return date === null ? null : { date, at: `${date} ${hours.padStart(2, '0')}:${minutes}:${seconds}` }
}

function moneyOf(cell: SheetCell): AccountMoney | null {
  if (typeof cell === 'number') return accountMoneyFromAmount(cell)
  const amount = decimalOf(cellText(cell))
  return amount === null ? null : accountMoneyFromAmount(amount)
}

class Refused extends Error {}

/** A row the file completed, on a product Kuna reads. */
interface CompletedRow {
  readonly started: Started
  readonly amount: AccountMoney
  readonly fee: AccountMoney
  readonly onSavings: boolean
  readonly exchange: boolean
  readonly currency: string
  readonly description: string
  /** Empty or null where the file leaves them out. */
  readonly completedAt: string
  readonly balance: AccountMoney | null
}

/**
 * A note for each product and currency whose last balance differs from what its rows add up to, as the first balance plus
 * each later row's amount less its fee, in the order they completed. A row missing from the export shows this way. It
 * never refuses, since the balance is the bank's word and the rows are what count.
 */
function balanceNotes(rows: readonly CompletedRow[]): string[] {
  const chains = new Map<string, CompletedRow[]>()
  for (const row of rows) {
    if (row.balance === null || row.completedAt === '') continue
    const key = `${row.onSavings ? 'Savings' : 'Current'} ${row.currency}`
    chains.set(key, [...(chains.get(key) ?? []), row])
  }
  return [...chains].flatMap(([key, chain]) => {
    const [first, ...later] = [...chain].sort((earlier, next) => earlier.completedAt.localeCompare(next.completedAt))
    const last = later.at(-1)
    if (first?.balance == null || last?.balance == null) return []
    const worked = later.reduce((sum, row) => addAccountMoney(sum, subtractAccountMoney(row.amount, row.fee)), first.balance)
    if (worked === last.balance) return []
    const [product = '', currency = ''] = key.split(' ')
    const statedIn = currencyCodeOf(currency) ?? EURO
    return [words.balanceDiffers(product, formatAccountMoney(last.balance, statedIn), formatAccountMoney(worked, statedIn))]
  })
}

/** The legs of each pocket move, a current row and a savings row of the opposite amount in the same second, one to one, each with the time both legs share. */
function pocketMoves(rows: readonly CompletedRow[]): ReadonlyMap<CompletedRow, string> {
  const keyOf = (row: CompletedRow, amount: number): string => `${row.currency} ${amount} ${row.started.at}`
  const savingsRows = new Map<string, CompletedRow[]>()
  for (const row of rows) {
    if (row.onSavings) savingsRows.set(keyOf(row, row.amount), [...(savingsRows.get(keyOf(row, row.amount)) ?? []), row])
  }
  const times = new Map<CompletedRow, string>()
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
 * Reads a Revolut export, its columns found by the header's names. Only completed rows count, and what it leaves out is
 * counted in a note. A row goes to the open Revolut account of its currency, or a closed one when no other fits, or a
 * `Savings` row to the Revolut savings account of that currency, left out with a note when there is none. A row of any other
 * product is left out with a note naming it. A current row and a savings row of the opposite amount in the same second are
 * a pocket move, whose legs share a time, as an exchange's do. A current row of a currency no Revolut account keeps refuses
 * the file, and so do two open accounts a row could go to, and so does a date or an amount that cannot be read, since a row
 * left out would throw every balance after it. A fee becomes a row of its own in Bank fees. A last balance its rows do not
 * add up to is a note, per product. Each account the file needs and Kuna does not keep comes drafted, every currency at once.
 */
export function revolutStatement(grid: readonly (readonly SheetCell[])[], fileName: string, book: Pick<SpendingBook, 'accounts' | 'categories'>): StatementReading {
  try {
    return readRows(grid, fileName, book)
  } catch (failure) {
    if (failure instanceof Refused) return { refusal: failure.message, missing: [] }
    throw failure
  }
}

/**
 * The Revolut account a product's rows in one currency need, opening on their first day at their first balance as their
 * last balance and the rows give it, or at zero where the file prints no balance. Null for a currency Kuna does not keep.
 */
function draftFor(chain: readonly CompletedRow[], accounts: readonly Pick<Account, 'name'>[]): DraftedAccount | null {
  const first = chain[0]!
  const currency = currencyCodeOf(first.currency)
  if (currency === null) return null
  const rows = chain.map((row) => ({ date: row.started.date, amount: subtractAccountMoney(row.amount, absAccountMoney(row.fee)) }))
  const stated =
    chain
      .filter((row) => row.balance !== null && row.completedAt !== '')
      .sort((earlier, next) => earlier.completedAt.localeCompare(next.completedAt))
      .at(-1)?.balance ?? null
  const evidence = { rows, stated, pending: false }
  const { opening, openedOn } = openingOn(evidence, earliestStart(evidence) ?? first.started.date)
  return { account: draftedAccount({ kind: first.onSavings ? 'savings' : 'bank', bank: 'revolut', currency, iban: '', opening, openedOn }, accounts), evidence }
}

/** What to add to bring in the rows the drafted accounts would keep: the whole file when it was refused for them, else the savings rows left out. */
export function addRevolutAccounts(missing: readonly DraftedAccount[], rows: 'file' | 'savings'): string {
  const phrase = (kind: Account['kind'], forms: (count: number, currencies: string) => EnglishForms | CroatianForms): string[] => {
    const currencies = missing.filter(({ account }) => account.kind === kind).map(({ account }) => account.currency)
    return currencies.length === 0 ? [] : [plural(forms(currencies.length, listInWords(currencies)), currencies.length)]
  }
  const accounts = listInWords([...phrase('bank', words.revolutBankAccounts), ...phrase('savings', words.revolutSavingsAccounts)])
  return rows === 'file' ? words.addToBringIn(accounts) : words.addToBringInSavings(accounts)
}

function readRows(grid: readonly (readonly SheetCell[])[], fileName: string, book: Pick<SpendingBook, 'accounts' | 'categories'>): StatementReading {
  const headerAt = grid.findIndex((row) => !isBlank(row))
  const header = (grid[headerAt] ?? []).map((cell) => cellText(cell).toLowerCase())
  const place = new Map<Column, number>(COLUMNS.map((column) => [column, header.indexOf(column.toLowerCase())]))
  const absent = COLUMNS.find((column) => place.get(column)! < 0)
  if (absent !== undefined) throw new Refused(words.noColumn(absent))
  const cellOf = (row: readonly SheetCell[], column: Column): SheetCell => row[place.get(column)!]
  const revolut = book.accounts.filter((account) => account.bank === 'revolut')
  const feeCategory = bankFeesCategory(book.categories)?.id ?? null

  let pending = 0
  let otherStates = 0
  const savingsLeftOut: string[] = []
  const otherProducts = new Map<string, number>()
  const completed: CompletedRow[] = []

  grid.slice(headerAt + 1).forEach((row, offset) => {
    if (isBlank(row)) return
    const state = cellText(cellOf(row, 'State')).toUpperCase()
    if (state === 'PENDING') pending += 1
    else if (state !== 'COMPLETED') otherStates += 1
    if (state !== 'COMPLETED') return
    const fileRow = headerAt + offset + 2
    const started = startedOf(cellOf(row, 'Started Date')) ?? refuseRow(words.notADay(fileRow, cellText(cellOf(row, 'Started Date'))))
    const amount = moneyOf(cellOf(row, 'Amount')) ?? refuseRow(words.notAnAmount(fileRow, cellText(cellOf(row, 'Amount'))))
    const fee = cellText(cellOf(row, 'Fee')) === '' ? ZERO_ACCOUNT_MONEY : (moneyOf(cellOf(row, 'Fee')) ?? refuseRow(words.notAnAmount(fileRow, cellText(cellOf(row, 'Fee')))))
    const product = cellText(cellOf(row, 'Product'))
    const onSavings = product.toLowerCase() === 'savings'
    if (!onSavings && product.toLowerCase() !== 'current') {
      otherProducts.set(product, (otherProducts.get(product) ?? 0) + 1)
      return
    }
    completed.push({
      started,
      amount,
      fee,
      onSavings,
      exchange: cellText(cellOf(row, 'Type')).toUpperCase() === 'EXCHANGE',
      currency: cellText(cellOf(row, 'Currency')).toUpperCase(),
      description: cellText(cellOf(row, 'Description')),
      completedAt: startedOf(cellOf(row, 'Completed Date'))?.at ?? '',
      balance: moneyOf(cellOf(row, 'Balance')),
    })
  })

  const pocketTimes = pocketMoves(completed)
  const kept: Omit<StatementRow, 'importKey'>[] = []
  const facts: string[][] = []
  const fees: AccountMoney[] = []
  const unkept = new Map<string, CompletedRow[]>()

  for (const row of completed) {
    const fitting = revolut.filter((candidate) => candidate.currency === row.currency && candidate.kind === (row.onSavings ? 'savings' : 'bank'))
    const open = fitting.filter((candidate) => !candidate.closed)
    if (open.length > 1) throw new Refused(words.manyRevolutAccounts(open.map((candidate) => candidate.name).join(', '), row.currency))
    const account = open[0] ?? fitting[0]
    if (account === undefined) {
      if (!row.onSavings && currencyCodeOf(row.currency) === null) throw new Refused(words.notACurrency(row.currency))
      if (row.onSavings) savingsLeftOut.push(row.currency)
      const product = `${row.onSavings ? 'Savings' : 'Current'} ${row.currency}`
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
    })
    facts.push([account.id, row.started.at, amountText(row.amount), amountText(row.fee), row.description])
    fees.push(row.fee)
  }

  const missing = [...unkept.values()].flatMap((chain) => draftFor(chain, book.accounts) ?? [])
  if (missing.some(({ account }) => account.kind === 'bank')) return { refusal: addRevolutAccounts(missing, 'file'), missing }

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
              payee: words.revolut,
              category: feeCategory,
              description: words.feeOn(row.description),
              movedAt: '',
              pocket: false,
              importKey: `${importKey}-fee`,
            },
          ]),
    ]
  })
  const draftedSavings = new Set<string>(missing.filter(({ account }) => account.kind === 'savings').map(({ account }) => account.currency))
  const undraftedSavings = savingsLeftOut.filter((currency) => !draftedSavings.has(currency))
  const notes = [
    ...(pending === 0 ? [] : [plural(words.pendingLeftOut(pending), pending)]),
    ...(otherStates === 0 ? [] : [plural(words.otherStatesLeftOut(otherStates), otherStates)]),
    ...(undraftedSavings.length === 0 ? [] : [plural(words.savingsLeftOut(undraftedSavings.length, [...new Set(undraftedSavings)].join(', ')), undraftedSavings.length)]),
  ]
  return {
    statement: { label: fileName, rows, notes: [...notes, ...balanceNotes(completed), ...[...otherProducts].map(([product, count]) => plural(words.otherProductLeftOut(count, product), count))] },
    missing,
  }
}

function refuseRow(reason: string): never {
  throw new Refused(reason)
}
