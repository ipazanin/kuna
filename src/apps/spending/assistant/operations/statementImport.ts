import { NUMBER, NUMBER_OR_NULL, TEXT, TEXT_OR_NULL, dayOf, inputOf } from './operationInput'
import { revolutStatement } from '../../statements/domain/revolutStatement'
import { transcribedImportKeys } from '../../statements/domain/statementRows'
import type { StatementRow, StatementRows } from '../../statements/domain/statementRows'
import { statementTies, tieRefusal } from '../../statements/domain/statementTies'
import type { Account } from '../../workbook/domain/account'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import { ACCOUNT_RECORDS } from '../../workbook/domain/spendingKinds'
import { words } from '../words'
import type { ChatAttachment } from '../../../../shared/ai/domain/chatAttachments'
import { ATTACHMENT_REF } from '../../../../shared/app/assistantOperations'
import type { AssistantOperation, ProposalStep } from '../../../../shared/app/assistantOperations'
import { StepRefused } from '../../../../shared/app/proposedWrites'
import { accountMoneyFromAmount } from '../../../../shared/money/accountMoney'
import { normaliseIban } from '../../../../shared/text/fold'
import { readFirstSheet } from '../../../../shared/xlsx/sheetGrids'

/** The most statement rows one card imports. A card holds 200 changes, and this leaves room for the pairs and rules that come with them. */
export const ROWS_A_PART = 150

export const IMPORT_STATEMENT: AssistantOperation = {
  name: 'import-statement',
  about: [
    'Imports a statement through the same dry run as Entries, Import: rows already in are skipped, a row of the same money fills a typed row, rules file the new rows, and transfers between your accounts pair.',
    'For an attached Revolut sheet or CSV, file names it, and account, opening and closing are null and rows empty. Kuna reads that file itself.',
    'For a statement pasted as text or attached as a PDF or photo, file is null. Transcribe each row as printed, money out below zero, on the one account it is for, with the opening and closing balances the statement prints. Never work out a balance. The rows must lead from the opening to the closing balance, or the import is refused.',
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

/** A row as the model transcribed it. */
interface TranscribedRow {
  readonly date: string
  readonly amount: number
  readonly payee: string
  readonly iban: string | null
}

/** A sheet Kuna read off an attached file, which stands in the step for the file once read. */
interface SheetRead {
  readonly name: string
  readonly grid: Awaited<ReturnType<typeof readFirstSheet>>
}

function isAttachment(file: unknown): file is ChatAttachment {
  return typeof file === 'object' && file !== null && 'kind' in file && 'bytes' in file && 'name' in file
}

function isSheetRead(file: unknown): file is SheetRead {
  return typeof file === 'object' && file !== null && 'grid' in file && 'name' in file
}

/** The cells of an attached sheet or CSV, or why Spending reads no statement from the file. A CSV stays text, so its cells stay as written. */
async function sheetOf(file: unknown): Promise<SheetRead | string> {
  if (!isAttachment(file)) return 'file is not a file attached to this chat.'
  switch (file.kind) {
    case 'photo':
    case 'pdf':
      return 'Kuna reads no statement off a photo or a PDF. Read it yourself and transcribe its rows as printed, with file null.'
    case 'xml':
      return "Spending reads only Revolut's export, as a sheet or a CSV."
    case 'sheet':
    case 'csv':
      try {
        return { name: file.name, grid: await readFirstSheet(file.kind === 'csv' ? new TextDecoder().decode(file.bytes) : file.bytes.slice().buffer) }
      } catch {
        return 'Kuna could not read that file as a sheet.'
      }
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
    const sheet = await sheetOf(file)
    if (typeof sheet === 'string') return { refused: [sheet] }
    read.push({ ...step, input: { ...step.input, file: sheet } })
  }
  return read
}

/** A statement read off a page, refused unless it prints both balances and its rows lead from the one to the other. */
function transcribed(account: Account | null, opening: number | null, closing: number | null, rows: readonly TranscribedRow[]): StatementRows {
  if (account === null) throw new StepRefused('A transcribed statement names the account its rows are on.')
  if (opening === null || closing === null) throw new StepRefused('A statement is imported only with the opening and closing balances it prints. Never work one out.')
  if (rows.length === 0) throw new StepRefused('The statement has no rows to import.')
  if (rows.some((row) => accountMoneyFromAmount(row.amount) === 0)) throw new StepRefused('Every row has an amount other than zero.')
  const amounts = rows.map((row) => accountMoneyFromAmount(row.amount))
  const tie = statementTies({ opening: accountMoneyFromAmount(opening), amounts, closing: accountMoneyFromAmount(closing) })
  if (tie.kind === 'off') throw new StepRefused(tieRefusal(tie, account.currency))
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

/** A sheet read by Spending's own reader, with nothing transcribed beside it. Its refusal quotes the file's cells, so the chat hears a fixed sentence and Entries, Import shows the reason. */
function fromSheet(sheet: SheetRead, book: SpendingBook, transcribedToo: boolean): StatementRows {
  if (transcribedToo) throw new StepRefused('Kuna reads an attached file itself, so account, opening and closing are null and rows empty.')
  const reading = revolutStatement(sheet.grid, sheet.name, book)
  if ('refusal' in reading) throw new StepRefused(words.sheetNotRead)
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
export function importedStatement(input: Readonly<Record<string, never>>, book: SpendingBook, accountOf: (value: unknown) => Account): StatementRows {
  const file: unknown = input['file']
  const rows: readonly TranscribedRow[] = input['rows']
  if (file !== null && !isSheetRead(file)) throw new StepRefused('file is not a file attached to this chat.')
  const statement =
    file === null
      ? transcribed(input['account'] === null ? null : accountOf(input['account']), input['opening'], input['closing'], rows)
      : fromSheet(file, book, input['account'] !== null || input['opening'] !== null || input['closing'] !== null || rows.length > 0)
  return partOf(statement, input['part'])
}
