import { NUMBER, NUMBER_OR_NULL, TEXT, TEXT_OR_NULL, choiceOf, dayOf, inputOf, isAttachment } from '../../../../shared/app/operationInput'
import { addRevolutAccounts, revolutStatement } from '../../statements/domain/revolutStatement'
import { copiedStatementRows, copiedStatementTie, earlierPartRows } from '../../statements/domain/copiedStatement'
import type { StatementRows } from '../../statements/domain/statementRows'
import type { Account } from '../../workbook/domain/account'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import { ACCOUNT_RECORDS } from '../../workbook/domain/spendingKinds'
import { words as statementWords } from '../../statements/domain/words'
import { ATTACHMENT_REF } from '../../../../shared/app/assistantOperations'
import type { ChatAttachment } from '../../../../shared/ai/domain/chatAttachments'
import type { AssistantOperation, ProposalStep } from '../../../../shared/app/assistantOperations'
import { ROWS_A_PART, StepRefused } from '../../../../shared/app/proposedWrites'
import { accountMoneyFromAmount } from '../../../../shared/money/accountMoney'
import type { AccountMoney } from '../../../../shared/money/accountMoney'
import type { CurrencyCode } from '../../../../shared/money/currencyCode'
import { BOOKING_DAYS_APART, LOOK_ALIKES } from '../../../../shared/money/lookAlikeBookings'
import type { LookAlikes } from '../../../../shared/money/lookAlikeBookings'
import { formatAccountMoney } from '../../../../shared/money/moneyFormat'
import { givesPrintedBalances, partRefusal } from '../../../../shared/money/statementTies'
import type { StatementTie } from '../../../../shared/money/statementTies'
import { copiedStatementCheck } from '../../../../shared/ai/presentation/copiedRowsWords'
import type { CopiedStatementCheck } from '../../../../shared/ai/presentation/copiedRowsWords'
import { amountText } from '../../../../shared/storage/domain/recordFields'
import { decodedText } from '../../../../shared/text/decodedText'
import { readFirstSheet } from '../../../../shared/xlsx/sheetGrids'

export const IMPORT_STATEMENT: AssistantOperation = {
  name: 'import-statement',
  about: [
    'Imports a statement through the same dry run as Entries, Import: rows already in are skipped, a row of the same money fills a typed row, rules file the new rows, and transfers between your accounts pair.',
    'file names the attached file by its id, or null for a statement pasted as text. For a file the context line says Kuna reads, account, statementName, opening and closing are null and rows empty, and Kuna reads it itself.',
    'For any other file or a pasted statement, read every row and copy each as written, money out below zero, on the one account it is for. statementName names the statement as it names itself, such as its number or the period it covers. Give the opening and closing balances only as the statement prints them, and never work one out. Without them the card warns that Kuna could not check the rows.',
    `lookAlikes says what becomes of a copied row that looks like a row Kuna has from another source, such as a Revolut export or the bank sync: the same amount on the same account at most ${BOOKING_DAYS_APART} days apart, unless the two payees share no word. ask keeps it waiting and lists it on the card, which asks the person to say in the chat. import imports it once the person says it is another payment: propose the same rows again with import once the card is answered. A row of the same day, amount and payee as one Kuna has is skipped either way. For a file Kuna reads, lookAlikes is ask.`,
    `A card carries at most ${ROWS_A_PART} copied rows. A longer statement goes in parts, oldest first, each its own card with only its own rows and the same statementName, part 1 first and each part once the one before is accepted. A part ends at the end of a day. Part 1 gives the opening alone and the last part both balances, and the parts between give neither. Kuna checks on the last part that the rows of every part lead from the opening to the closing. A statement in one part gives both or neither. For a file Kuna reads, part says which ${ROWS_A_PART} rows of it the card imports.`,
    'Rules on the same card file its new rows. A new category goes on an earlier card. When a card with an import holds too many changes, put its rules on a card of their own before the import.',
  ].join(' '),
  input: inputOf({
    file: TEXT_OR_NULL,
    account: TEXT_OR_NULL,
    statementName: TEXT_OR_NULL,
    opening: NUMBER_OR_NULL,
    closing: NUMBER_OR_NULL,
    rows: { type: 'array', items: inputOf({ date: TEXT, amount: NUMBER, payee: TEXT, iban: TEXT_OR_NULL }) },
    part: { type: 'integer', description: 'Which part of the statement this card imports, from 1.' },
    lookAlikes: { type: 'string', enum: [...LOOK_ALIKES] },
  }),
  refs: { file: ATTACHMENT_REF, account: ACCOUNT_RECORDS.name },
  creates: null,
  alone: false,
  example: {
    file: null,
    account: 'account',
    statementName: 'October 2026',
    opening: 100,
    closing: 62.5,
    rows: [
      { date: '2026-10-02', amount: -12.5, payee: 'Corner market', iban: null },
      { date: '2026-10-03', amount: -25, payee: 'Harbour bistro', iban: null },
    ],
    part: 1,
    lookAlikes: 'ask',
  },
}

/** Why Spending reads no statement from an attached file by itself, which sends the AI to read and copy it. */
const COPY_IT = 'Kuna does not read this file as a Revolut export. Read it with read_attachment and copy every row into rows as written, with file naming it.'

const KUNA_READS_IT = 'Kuna reads this file itself, so account, statementName, opening and closing are null and rows empty.'

/** A row as the model transcribed it. */
interface TranscribedRow {
  readonly date: string
  readonly amount: number
  readonly payee: string
  readonly iban: string | null
}

/** Rows the AI copied from a file or the chat, which the card warns about: how many are on the card, the file's name or null for the chat, and when Kuna checks that the statement adds up. */
export interface CopiedRows {
  readonly count: number
  readonly file: string | null
  readonly check: CopiedStatementCheck
}

/** The statement a card imports, and the rows the AI copied into it, which are null when Spending's own reader read the file. */
export interface CardStatement {
  readonly statement: StatementRows
  readonly copied: CopiedRows | null
}

/** A sheet Kuna read off an attached file, which stands in the step for the file once read. */
interface SheetRead {
  readonly name: string
  readonly grid: Awaited<ReturnType<typeof readFirstSheet>>
}

function isSheetRead(file: unknown): file is SheetRead {
  return typeof file === 'object' && file !== null && 'grid' in file && 'name' in file
}

/**
 * What an import step's file stands for once read: Spending's reader takes a sheet or a CSV whose rows the AI left empty, and a
 * file whose rows the AI copied stays as attached. Or why the file cannot be imported. A CSV stays text, so its cells stay as written.
 */
async function fileOf(file: unknown, copied: boolean): Promise<SheetRead | ChatAttachment | string> {
  if (!isAttachment(file)) return 'file is not a file attached to this chat.'
  if (copied) return file.reading.kind === 'kuna' ? KUNA_READS_IT : file
  if (file.kind !== 'sheet' && file.kind !== 'csv') return COPY_IT
  try {
    return { name: file.name, grid: await readFirstSheet(file.kind === 'csv' ? decodedText(file.bytes) : file.bytes.slice().buffer) }
  } catch {
    return COPY_IT
  }
}

/** The steps with each attached sheet read, since a dry run cannot wait for a file. Or why a file cannot be imported. */
export async function withSheetsRead(steps: readonly ProposalStep[]): Promise<readonly ProposalStep[] | { readonly refused: readonly string[] }> {
  const read: ProposalStep[] = []
  for (const step of steps) {
    const file = step.input['file']
    if (step.operation !== IMPORT_STATEMENT.name || file === null || file === undefined) {
      read.push(step)
      continue
    }
    const rows = step.input['rows']
    const held = await fileOf(file, Array.isArray(rows) && rows.length > 0)
    if (typeof held === 'string') return { refused: [held] }
    read.push({ ...step, input: { ...step.input, file: held } })
  }
  return read
}

/** What a later part's tie counts, since a row an earlier part found in Kuna already is not among them. */
const EARLIER_PARTS_COUNTED = 'Its rows are those its parts put in Kuna and this part, so a row of an earlier part that Kuna had already from another source counts as missing.'

/** What a step names of a statement the AI copied: the account, the statement's name, its part and the balances the card gives. */
interface CopiedPart {
  readonly account: Account | null
  readonly name: string | null
  readonly part: number
  readonly opening: number | null
  readonly closing: number | null
}

/**
 * One part of a statement the AI copied off a page, a file or the chat. A card that gives both printed balances ties them, against
 * the rows its earlier parts put in Kuna too, and a statement without them goes in with the card warning that Kuna could not check it.
 */
function copiedStatement({ account, name, part, opening, closing }: CopiedPart, rows: readonly TranscribedRow[], lookAlikes: LookAlikes, book: SpendingBook): StatementRows {
  if (account === null) throw new StepRefused('Copied rows name the account they are on.')
  if (name === null || name.trim() === '') throw new StepRefused('statementName names the statement, the same on every part of it.')
  if (!Number.isInteger(part) || part < 1) throw new StepRefused('part counts from 1.')
  if (!givesPrintedBalances(opening, closing, part)) {
    throw new StepRefused(
      'Give both the opening and the closing balance the statement prints, or neither when it prints none, and in parts the opening alone on part 1 and both on the last part. Never work one out.',
    )
  }
  if (rows.length === 0) throw new StepRefused('The statement has no rows to import.')
  if (rows.length > ROWS_A_PART) throw new StepRefused(`A card carries at most ${ROWS_A_PART} copied rows. Put the rest on the next part, which starts on the day after this one ends.`)
  if (rows.some((row) => accountMoneyFromAmount(row.amount) === 0)) throw new StepRefused('Every row has an amount other than zero.')
  const copied = rows.map((row) => ({ date: dayOf(row.date), amount: accountMoneyFromAmount(row.amount), payee: row.payee, iban: row.iban }))
  const statement = copiedStatementRows(account, name, copied, lookAlikes)
  const earlier = part === 1 ? [] : earlierPartRows(book.transactions, statement)
  const refusal = partRefusal(
    part,
    earlier.map((row) => row.date),
    copied.map((row) => row.date).sort()[0]!,
  )
  if (refusal === 'parts-before-missing') throw new StepRefused(`No row of ${statement.label} is in Kuna yet. Propose its parts in order from part 1, each once the one before is accepted.`)
  if (refusal === 'day-reached') throw new StepRefused(`The parts of ${statement.label} in Kuna reach the first day of part ${part}. A part starts on the day after the one before it ends.`)
  if (opening !== null && closing !== null) {
    const tie = copiedStatementTie(statement, earlier, accountMoneyFromAmount(opening), accountMoneyFromAmount(closing))
    if (tie.kind === 'off') throw new StepRefused(part === 1 ? tieRefusal(tie, account.currency) : `${tieRefusal(tie, account.currency)} ${EARLIER_PARTS_COUNTED}`)
  }
  return statement
}

/** Why an export is refused for the accounts it needs, with each drafted from the file for the chat to propose first. Each value is a currency code, a day or an amount Kuna worked out, never a cell's text. */
function addAccountsFirst(missing: readonly Omit<Account, 'id'>[]): string {
  const drafts = missing.map(
    (account) => `name ${JSON.stringify(account.name)}, kind ${account.kind}, bank ${account.bank}, currency ${account.currency}, opening ${amountText(account.opening)}, openedOn ${account.openedOn}`,
  )
  return `${addRevolutAccounts(missing, 'file')}. Propose add-account on a card of its own first, once for each of these, and the import on the next card once that one is accepted: ${drafts.map((draft) => `(${draft})`).join(', ')}.`
}

/** A sheet read by Spending's own reader, with nothing copied beside it. Its refusal quotes the file's cells, so the chat hears a fixed sentence and Entries, Import shows the reason, unless it was refused for want of accounts. */
function fromSheet(sheet: SheetRead, book: SpendingBook, copiedToo: boolean): StatementRows {
  if (copiedToo) throw new StepRefused(KUNA_READS_IT)
  const reading = revolutStatement(sheet.grid, sheet.name, book)
  if ('refusal' in reading) throw new StepRefused(reading.missing.length > 0 ? addAccountsFirst(reading.missing) : COPY_IT)
  return reading.statement
}

/** The rows of the part of a file Kuna read that a card imports. */
function partOf(statement: StatementRows, part: number): StatementRows {
  const first = (part - 1) * ROWS_A_PART
  const parts = Math.max(1, Math.ceil(statement.rows.length / ROWS_A_PART))
  if (part < 1 || part > parts) throw new StepRefused(`The statement has ${parts === 1 ? '1 part' : `${parts} parts`}, from part 1.`)
  return { ...statement, rows: statement.rows.slice(first, first + ROWS_A_PART) }
}

/** The statement an import step names: the part of a file Kuna read that its card imports, or the rows the AI copied onto it. `accountOf` finds the account the step names among the books as the proposal left them. */
export function importedStatement(input: Readonly<Record<string, never>>, book: SpendingBook, accountOf: (value: unknown) => Account): CardStatement {
  const file: unknown = input['file']
  const rows: readonly TranscribedRow[] = input['rows']
  if (isSheetRead(file)) {
    const copiedToo = input['account'] !== null || input['statementName'] !== null || input['opening'] !== null || input['closing'] !== null
    return { statement: partOf(fromSheet(file, book, copiedToo), input['part']), copied: null }
  }
  if (file !== null && !isAttachment(file)) throw new StepRefused('file is not a file attached to this chat.')
  const lookAlikes = choiceOf(LOOK_ALIKES, input['lookAlikes'], 'lookAlikes')!
  const account = input['account'] === null ? null : accountOf(input['account'])
  const part = { account, name: input['statementName'], part: input['part'], opening: input['opening'], closing: input['closing'] }
  const statement = copiedStatement(part, rows, lookAlikes, book)
  return { statement, copied: { count: statement.rows.length, file: file === null ? null : file.name, check: copiedStatementCheck(part) } }
}

/** Why a statement that does not tie is refused, with the gap in the account's currency. */
export function tieRefusal(tie: Extract<StatementTie<AccountMoney>, { kind: 'off' }>, currency: CurrencyCode): string {
  const amount = (money: AccountMoney): string => formatAccountMoney(money, currency)
  return statementWords.doesNotTie(amount(tie.statement.opening), amount(tie.rows), amount(tie.reached), amount(tie.statement.closing), formatAccountMoney(tie.gap, currency, 'magnitude'))
}
