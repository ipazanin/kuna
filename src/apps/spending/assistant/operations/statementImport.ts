import { NUMBER, NUMBER_OR_NULL, TEXT, TEXT_OR_NULL, dayOf, inputOf, isAttachment } from '../../../../shared/app/operationInput'
import { revolutStatement } from '../../statements/domain/revolutStatement'
import { transcribedImportKeys } from '../../statements/domain/statementRows'
import type { StatementRow, StatementRows } from '../../statements/domain/statementRows'
import type { Account } from '../../workbook/domain/account'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import { ACCOUNT_RECORDS } from '../../workbook/domain/spendingKinds'
import { words } from '../words'
import { words as statementWords } from '../../statements/domain/words'
import { ATTACHMENT_REF } from '../../../../shared/app/assistantOperations'
import type { ChatAttachment } from '../../../../shared/ai/domain/chatAttachments'
import type { AssistantOperation, ProposalStep } from '../../../../shared/app/assistantOperations'
import { ROWS_A_PART, StepRefused } from '../../../../shared/app/proposedWrites'
import { accountMoneyFromAmount } from '../../../../shared/money/accountMoney'
import type { AccountMoney } from '../../../../shared/money/accountMoney'
import type { CurrencyCode } from '../../../../shared/money/currencyCode'
import { formatAccountMoney } from '../../../../shared/money/moneyFormat'
import { statementTies } from '../../../../shared/money/statementTies'
import type { StatementTie } from '../../../../shared/money/statementTies'
import { decodedText } from '../../../../shared/text/decodedText'
import { normaliseIban } from '../../../../shared/text/fold'
import { readFirstSheet } from '../../../../shared/xlsx/sheetGrids'

export const IMPORT_STATEMENT: AssistantOperation = {
  name: 'import-statement',
  about: [
    'Imports a statement through the same dry run as Entries, Import: rows already in are skipped, a row of the same money fills a typed row, rules file the new rows, and transfers between your accounts pair.',
    'file names the attached file by its id, or null for a statement pasted as text. For a file the context line says Kuna reads, account, opening and closing are null and rows empty, and Kuna reads it itself.',
    'For any other file or a pasted statement, read every row and copy each as written, money out below zero, on the one account it is for. Give the opening and closing balances only when the statement prints both, and the rows must then lead from the one to the other. Never work out a balance. Without them the card warns that Kuna could not check the rows.',
    `A statement over ${ROWS_A_PART} rows goes in parts: part 1, then part 2 and on, each its own card holding the whole statement. Rules on the same card file its new rows. A new category goes on an earlier card. When a card with an import holds too many changes, put its rules on a card of their own before the import.`,
  ].join(' '),
  input: inputOf({
    file: TEXT_OR_NULL,
    account: TEXT_OR_NULL,
    opening: NUMBER_OR_NULL,
    closing: NUMBER_OR_NULL,
    rows: { type: 'array', items: inputOf({ date: TEXT, amount: NUMBER, payee: TEXT, iban: TEXT_OR_NULL }) },
    part: { type: 'integer', description: `Which ${ROWS_A_PART} rows this card imports, from 1.` },
  }),
  refs: { file: ATTACHMENT_REF, account: ACCOUNT_RECORDS.name },
  creates: null,
  alone: false,
  example: {
    file: null,
    account: 'account',
    opening: 100,
    closing: 62.5,
    rows: [
      { date: '2026-10-02', amount: -12.5, payee: 'Corner market', iban: null },
      { date: '2026-10-03', amount: -25, payee: 'Harbour bistro', iban: null },
    ],
    part: 1,
  },
}

/** Why Spending reads no statement from an attached file by itself, which sends the AI to read and copy it. */
const COPY_IT = 'Kuna does not read this file as a Revolut export. Read it with read_attachment and copy every row into rows as written, with file naming it.'

const KUNA_READS_IT = 'Kuna reads this file itself, so account, opening and closing are null and rows empty.'

/** A row as the model transcribed it. */
interface TranscribedRow {
  readonly date: string
  readonly amount: number
  readonly payee: string
  readonly iban: string | null
}

/** Rows the AI copied from a file or the chat, which the card warns about: how many are on the card, the file's name or null for the chat, and whether printed balances tied them. */
export interface CopiedRows {
  readonly count: number
  readonly file: string | null
  readonly tied: boolean
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

/**
 * Rows the AI copied off a page, a file or the chat. Printed balances, when given, must both be there and tie, and a statement
 * without them goes in with the card warning that Kuna could not check it.
 */
function copiedStatement(account: Account | null, opening: number | null, closing: number | null, rows: readonly TranscribedRow[]): StatementRows {
  if (account === null) throw new StepRefused('Copied rows name the account they are on.')
  if ((opening === null) !== (closing === null)) throw new StepRefused('Give both the opening and the closing balance the statement prints, or neither when it prints none. Never work one out.')
  if (rows.length === 0) throw new StepRefused('The statement has no rows to import.')
  if (rows.some((row) => accountMoneyFromAmount(row.amount) === 0)) throw new StepRefused('Every row has an amount other than zero.')
  const amounts = rows.map((row) => accountMoneyFromAmount(row.amount))
  if (opening !== null && closing !== null) {
    const tie = statementTies({ opening: accountMoneyFromAmount(opening), amounts, closing: accountMoneyFromAmount(closing) })
    if (tie.kind === 'off') throw new StepRefused(tieRefusal(tie, account.currency))
  }
  const dated = rows.map((row, at) => ({ account: account.id, date: dayOf(row.date), amount: amounts[at]!, payee: row.payee.trim(), iban: row.iban }))
  const keys = transcribedImportKeys(dated)
  const days = dated.map((row) => row.date).sort()
  return {
    label: words.statementRead(account.name, days[0]!, days.at(-1)!),
    rows: dated.map(({ iban, ...row }, at): StatementRow => ({
      ...row,
      category: null,
      description: '',
      counterpartyIban: iban === null ? '' : normaliseIban(iban),
      importKey: keys[at]!,
      movedAt: '',
      pocket: false,
    })),
    notes: [],
  }
}

/** A sheet read by Spending's own reader, with nothing copied beside it. Its refusal quotes the file's cells, so the chat hears a fixed sentence and Entries, Import shows the reason. */
function fromSheet(sheet: SheetRead, book: SpendingBook, copiedToo: boolean): StatementRows {
  if (copiedToo) throw new StepRefused(KUNA_READS_IT)
  const reading = revolutStatement(sheet.grid, sheet.name, book)
  if ('refusal' in reading) throw new StepRefused(COPY_IT)
  return reading.statement
}

/** The rows of the part a card imports. */
function partOf(statement: StatementRows, part: number): StatementRows {
  const first = (part - 1) * ROWS_A_PART
  const parts = Math.max(1, Math.ceil(statement.rows.length / ROWS_A_PART))
  if (part < 1 || part > parts) throw new StepRefused(`The statement has ${parts === 1 ? '1 part' : `${parts} parts`}, from part 1.`)
  return { ...statement, rows: statement.rows.slice(first, first + ROWS_A_PART) }
}

/** The statement an import step names, by the part its card imports. `accountOf` finds the account the step names among the books as the proposal left them. */
export function importedStatement(input: Readonly<Record<string, never>>, book: SpendingBook, accountOf: (value: unknown) => Account): CardStatement {
  const file: unknown = input['file']
  const rows: readonly TranscribedRow[] = input['rows']
  if (isSheetRead(file)) {
    return { statement: partOf(fromSheet(file, book, input['account'] !== null || input['opening'] !== null || input['closing'] !== null), input['part']), copied: null }
  }
  if (file !== null && !isAttachment(file)) throw new StepRefused('file is not a file attached to this chat.')
  const statement = partOf(copiedStatement(input['account'] === null ? null : accountOf(input['account']), input['opening'], input['closing'], rows), input['part'])
  return { statement, copied: { count: statement.rows.length, file: file === null ? null : file.name, tied: input['opening'] !== null } }
}

/** Why a statement that does not tie is refused, with the gap in the account's currency. */
export function tieRefusal(tie: Extract<StatementTie<AccountMoney>, { kind: 'off' }>, currency: CurrencyCode): string {
  const amount = (money: AccountMoney): string => formatAccountMoney(money, currency)
  return statementWords.doesNotTie(amount(tie.statement.opening), amount(tie.rows), amount(tie.reached), amount(tie.statement.closing), formatAccountMoney(tie.gap, currency, 'magnitude'))
}
