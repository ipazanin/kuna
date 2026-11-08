import { readPortfolioWorkbookFile } from '../../imports/application/portfolioWorkbookFile'
import { writeWorkbookImport } from '../../imports/application/workbookImport'
import { importableRecords } from '../../imports/domain/importDryRun'
import type { ImportedRecord, WorkbookRows } from '../../imports/domain/importDryRun'
import { ratesWanted } from '../../imports/domain/workbookRates'
import { NO_CHOICES, NO_SPLIT_LOOKUP, settledImport } from '../../imports/presentation/importChoices'
import type { AskedChoice, ClosesOf, SettledImport } from '../../imports/presentation/importChoices'
import { MAIL_READER_WRITES, writeLeftOut } from '../../mail/application/mailReaderWrites'
import { ibkrMailReader } from '../../mail/domain/ibkrFlexRecipe'
import { heldOrNewReader, mailReaderErrors, mailReaderTexts, withMailField } from '../../mail/presentation/mailReaderForm'
import type { MailReaderField, MailReaderTexts } from '../../mail/presentation/mailReaderForm'
import { seriesKey } from '../../prices/domain/pricesFile'
import { transactionRecordKind } from '../../transactions/application/transactionWrites'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import { INSTRUMENT_RECORDS, INVESTMENT_ACCOUNT_RECORDS, MAIL_READER_RECORDS } from '../../workbook/domain/investmentKinds'
import { words } from '../words'
import type { ChatAttachment } from '../../../../shared/ai/domain/chatAttachments'
import { ATTACHMENT_REF } from '../../../../shared/app/assistantOperations'
import type { ProposalStep } from '../../../../shared/app/assistantOperations'
import { FLAG_OR_NULL, NOT_READ_OFF_A_PAGE, TEXT, TEXT_OR_NULL, choiceOf, inputOf } from '../../../../shared/app/operationInput'
import { StepRefused } from '../../../../shared/app/proposedWrites'
import { NO_RATES } from '../../../../shared/money/rateBook'
import { newRecordId } from '../../../../shared/storage/domain/recordId'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'
import type { RecordNoun } from '../../../../shared/storage/domain/recordKind'
import { plural } from '../../../../shared/text/translation'
import type { CardBooks, InvestmentSteps, StepNote, StepWritten } from './investmentSteps'

const IMPORT_WORKBOOK = 'import-workbook'
const ACCEPT_MAIL_REPORT = 'accept-mail-report'
const GONE = ['keep', 'delete'] as const
const ASKED: readonly AskedChoice[] = ['hold', 'leave-out']
const MAIL_FIELDS: readonly MailReaderField[] = ['senders', 'subject', 'contents', 'since']

/** A workbook or a report Kuna read before the dry run, which stands in the step for the file or the mail once read. */
interface RowsRead {
  readonly rows: WorkbookRows
}

function isRowsRead(value: unknown): value is RowsRead {
  return typeof value === 'object' && value !== null && 'rows' in value
}

function isAttachment(file: unknown): file is ChatAttachment {
  return typeof file === 'object' && file !== null && 'kind' in file && 'bytes' in file
}

/** The rows of an attached portfolio workbook, read by the Import dialog's own reader, or why not, in fixed words that quote nothing of the file. */
async function workbookOf(file: unknown): Promise<RowsRead | string> {
  if (!isAttachment(file)) return 'file is not a file attached to this chat.'
  if (file.kind === 'photo' || file.kind === 'pdf') return NOT_READ_OFF_A_PAGE
  if (file.kind !== 'sheet') return 'The portfolio workbook is a spreadsheet with a Transactions tab, such as an xlsx file.'
  const read = await readPortfolioWorkbookFile(file.bytes).catch(() => null)
  if (read === null) return 'Kuna could not read that file as a spreadsheet.'
  if (read.kind === 'refused') return read.refusal.kind === 'no-transactions-tab' ? 'That spreadsheet has no Transactions tab.' : `That workbook lacks the columns ${read.refusal.columns.join(', ')}.`
  return { rows: read }
}

/**
 * The steps with each attached workbook read and the mailed report the last sync read in place, since a dry run cannot
 * wait for a file. Or why a step cannot be checked.
 */
export async function withRowsRead(steps: readonly ProposalStep[], mailReport: () => WorkbookRows | null): Promise<readonly ProposalStep[] | { readonly refused: readonly string[] }> {
  const read: ProposalStep[] = []
  for (const step of steps) {
    if (step.operation === IMPORT_WORKBOOK) {
      const workbook = await workbookOf(step.input['file'])
      if (typeof workbook === 'string') return { refused: [workbook] }
      read.push({ ...step, input: { ...step.input, file: workbook } })
    } else if (step.operation === ACCEPT_MAIL_REPORT) {
      const rows = mailReport()
      if (rows === null) return { refused: ['No mailed report waits. A sync reads it from Gmail while the IBKR report reader is on.'] }
      read.push({ ...step, input: { ...step.input, report: { rows } } })
    } else {
      read.push(step)
    }
  }
  return read
}

/**
 * What the model does with an import that makes more changes than a card holds. An import cannot shrink, so other steps
 * go on a card of their own, and an import this size goes through its screen, which writes it in one write. Null for
 * any other card.
 */
export function importTooLarge(steps: readonly ProposalStep[]): string | null {
  const first = steps.length > 1 ? ' If other changes share its card, propose them on a card of their own first, and if the import alone is too large,' : ''
  if (steps.some((step) => step.operation === IMPORT_WORKBOOK)) return `A workbook import cannot shrink.${first || ' So'} link Overview, Import, which imports a workbook this size in one write.`
  if (steps.some((step) => step.operation === ACCEPT_MAIL_REPORT))
    return `A report cannot shrink.${first || ' So'} link the review on Settings, General, which accepts a report this size in one write.`
  return null
}

/** Where an import's rows are answered, and what its warned line is called. */
interface ImportPlace {
  readonly label: string
  readonly place: string
}

/**
 * The kind of the first record the import writes, whose group on the card carries its warned line. A report that adds
 * nothing changes only the mail reader.
 */
function firstNounOf(added: InvestmentBook, deleting: readonly ImportedRecord[]): RecordNoun {
  if (added.accounts.length > 0) return INVESTMENT_ACCOUNT_RECORDS.noun
  if (added.instruments.length > 0) return INSTRUMENT_RECORDS.noun
  const first = importableRecords(added)[0] ?? deleting[0]
  return first === undefined ? MAIL_READER_RECORDS.noun : transactionRecordKind(first.kind).noun
}

/** A warned line on the card, since the card shows only what the import writes. */
function noteOf(label: string, noun: RecordNoun, counts: readonly (readonly [number, (count: number) => Parameters<typeof plural>[0]])[]): StepNote[] {
  const warnings = counts.flatMap(([count, forms]) => (count === 0 ? [] : [plural(forms(count), count)]))
  return warnings.length === 0 ? [] : [{ noun, line: { label, fields: [], warning: warnings.join(' ') } }]
}

/** The holdings whose split or spin-off the Import dialog would ask about, by name: a split no vendor lists, and a spin-off its row does not answer whole. */
function holdingsAskedAbout(settled: SettledImport, book: InvestmentBook): string[] {
  const nameOf = (identity: string): string => {
    const step = settled.instruments.find(({ question }) => question.identity === identity)
    if (step === undefined) return identity
    if (step.choice.kind === 'new') return step.choice.texts.name.trim() || step.question.proposal.name
    const chosen = step.choice.instrument
    return book.instruments.find((instrument) => instrument.id === chosen)?.name ?? identity
  }
  const asked = [
    ...settled.splits.filter((split) => split.listed === null).map((split) => split.question.identity),
    ...settled.spinOffs.filter((spinOff) => !spinOff.answeredByRow).map((spinOff) => spinOff.question.identity),
  ]
  return [...new Set(asked.map(nameOf))]
}

/**
 * What the Import dialog writes with every other question left at its default: an account or holding an earlier import
 * wrote to, else a new one as proposed. Refused while the dialog would ask about a split or a spin-off, since their
 * answers set a holding's cost and so its tax, and while the prices file lacks an ECB rate the rows need, which the
 * dialog fetches first. The rows that still wait, and those Kuna cannot read, are counted on a warned line.
 */
function importedRows(
  unit: UnitOfWork,
  card: CardBooks,
  rows: WorkbookRows,
  asked: AskedChoice,
  gone: (typeof GONE)[number],
  where: ImportPlace,
): { readonly written: StepWritten; readonly leftOut: readonly string[] } {
  const rates = card.rates ?? NO_RATES
  const lacking = ratesWanted(rows.rows, rates)
  if (lacking !== null) throw new StepRefused(words.proposals.ratesMissing(lacking.currencies.join(', '), lacking.from, where.place))
  const ids = new Map<string, string>()
  const newIds = (key: string): string => {
    const id = ids.get(key) ?? newRecordId()
    ids.set(key, id)
    return id
  }
  const closesOf: ClosesOf = (instrument) => card.pricesFile?.series[seriesKey(instrument.prices, instrument.sourceSymbol)]?.closes ?? []
  const leftOut = asked === 'leave-out' ? (rows.report?.asked ?? []).map((row) => row.key) : []
  const choices = { ...NO_CHOICES, asked: Object.fromEntries(leftOut.map((key) => [key, asked])) }
  const settled = settledImport(rows, card.book, rates, choices, newIds, NO_SPLIT_LOOKUP, closesOf)
  const askedAbout = holdingsAskedAbout(settled, card.book)
  if (askedAbout.length > 0) throw new StepRefused(words.proposals.holdingsAsked(askedAbout.join(', '), where.place))
  const { dryRun } = settled
  const deleting = gone === 'delete' ? dryRun.gone : []
  writeWorkbookImport(unit, dryRun.added, deleting)
  const waiting = dryRun.entries.filter((entry) => entry.outcome.kind === 'waiting').length
  const held = asked === 'hold' ? (rows.report?.asked.length ?? 0) : 0
  const kept = gone === 'keep' ? dryRun.gone.length : 0
  const notes = noteOf(where.label, firstNounOf(dryRun.added, deleting), [
    [waiting, (count) => words.proposals.rowsWaiting(count, where.place)],
    [dryRun.skipped.length, (count) => words.proposals.rowsSkipped(count, where.place)],
    [held, words.proposals.rowsAsked],
    [kept, words.proposals.goneKept],
  ])
  const fetchesPricesOf = dryRun.added.instruments.filter((instrument) => instrument.prices !== 'manual').map((instrument) => instrument.name)
  return { written: { book: dryRun.planned, made: null, fetchesPricesOf, notes }, leftOut }
}

/** The IBKR mail reader's plain settings, the review of its report, and the portfolio workbook, as the mail card and the Import dialog write them. Turning the reader on needs Google's consent, so only the person does it. Switching it off needs none. */
export const IMPORT_STEPS: InvestmentSteps = {
  operations: [
    {
      name: 'set-mail-reader',
      about:
        "Where the IBKR report reader looks in Gmail: senders as addresses split by commas, a phrase of the subject and of the contents, blank for any, and since, the first day of rows it takes. on no switches the reader off. Null leaves a field as it is. Turning the reader on asks Google's consent, so for that link Settings, General and leave it to the person.",
      input: inputOf({
        on: FLAG_OR_NULL,
        senders: TEXT_OR_NULL,
        subject: TEXT_OR_NULL,
        contents: TEXT_OR_NULL,
        since: { type: ['string', 'null'], description: 'A day such as 2026-01-01, or null to leave it.' },
      }),
      refs: {},
      creates: null,
      alone: false,
      example: { on: null, senders: null, subject: 'Daily activity', contents: null, since: '2026-01-01' },
    },
    {
      name: ACCEPT_MAIL_REPORT,
      about:
        "Accepts what the last sync read of IBKR's mailed report, as its review does: new records, and accounts and holdings named as Kuna proposes them. asked says what becomes of the rows the report asks about: hold keeps them waiting, leave-out stops asking for good. Rows that still wait are answered in the review on Settings, General, which also answers a split or a spin-off the card cannot.",
      input: inputOf({ asked: { type: 'string', enum: [...ASKED] } }),
      refs: {},
      creates: null,
      alone: true,
      example: { asked: 'hold' },
    },
    {
      name: IMPORT_WORKBOOK,
      about:
        'Imports an attached portfolio workbook through the same dry run as Overview, Import: rows already in are skipped, and accounts and holdings are matched or named as Kuna proposes them. Kuna reads the file itself, so file names its id. gone says what becomes of records an earlier import wrote that the workbook no longer has: keep leaves them, delete deletes them. Rows that still wait, and a split or a spin-off its row does not answer, are answered in the Import dialog.',
      input: inputOf({ file: TEXT, gone: { type: 'string', enum: [...GONE] } }),
      refs: { file: ATTACHMENT_REF },
      creates: null,
      alone: true,
      example: { file: 'a1', gone: 'keep' },
    },
  ],
  write(unit, card, { operation, input }) {
    const field = input as Readonly<Record<string, unknown>>
    if (operation === IMPORT_WORKBOOK) {
      const read = field['file']
      if (!isRowsRead(read)) throw new StepRefused('file is not a workbook Kuna read.')
      return importedRows(unit, card, read.rows, 'hold', field['gone'] === 'delete' ? 'delete' : 'keep', words.proposals.workbook).written
    }
    const held = ibkrMailReader(card.book)
    if (operation === ACCEPT_MAIL_REPORT) {
      const read = field['report']
      if (!isRowsRead(read) || held === null) throw new StepRefused('No mailed report waits.')
      const { written, leftOut } = importedRows(unit, card, read.rows, field['asked'] === 'leave-out' ? 'leave-out' : 'hold', 'keep', words.proposals.mailReport)
      if (leftOut.length > 0) writeLeftOut(unit, held, leftOut)
      return written
    }
    const switchedOff = field['on'] !== null && choiceOf(['yes', 'no'], field['on'] as string, 'on') === 'no'
    if (field['on'] !== null && !switchedOff) throw new StepRefused("Turning the reader on asks Google's consent. Link Settings, General and leave it to the person.")
    const on = held?.on === true && !switchedOff
    const shown = mailReaderTexts(held)
    const given = (name: MailReaderField): string => (field[name] as string | null) ?? shown[name]
    const texts: MailReaderTexts = { senders: given('senders'), subject: given('subject'), contents: given('contents'), since: given('since') }
    const errors = mailReaderErrors(texts, on)
    const refused = MAIL_FIELDS.flatMap((name) => (field[name] === null || errors[name] === null ? [] : [`${name}: ${errors[name]}`]))
    if (refused.length > 0) throw new StepRefused(refused.join(' '))
    const typed = MAIL_FIELDS.reduce((reader, name) => (field[name] === null ? reader : withMailField(reader, name, texts)), heldOrNewReader(held))
    const after = { ...typed, on }
    if (held === null) unit.of(MAIL_READER_WRITES).add(after)
    else unit.of(MAIL_READER_WRITES).change(held, after)
    return { book: { ...card.book, mailReaders: [...card.book.mailReaders.filter((reader) => reader.id !== after.id), after] }, made: null, fetchesPricesOf: [], notes: [] }
  },
}
