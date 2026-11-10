import { writeWorkbookImport } from '../../imports/application/workbookImport'
import { importableRecords } from '../../imports/domain/importDryRun'
import { LOOK_ALIKES } from '../../../../shared/money/lookAlikeBookings'
import type { WorkbookDryRun, WorkbookRows } from '../../imports/domain/importDryRun'
import { WORKBOOK_TYPES } from '../../imports/domain/portfolioWorkbook'
import type { WorkbookRow } from '../../imports/domain/portfolioWorkbook'
import { copiedRowRefusal, daysPartlyOnCard, transcribedRows } from '../../imports/domain/transcribedRows'
import type { CashOff, CopiedRowRefusal, TranscribedBalance, TranscribedRow } from '../../imports/domain/transcribedRows'
import { ratesWanted } from '../../imports/domain/workbookRates'
import { NO_CHOICES, NO_SPLIT_LOOKUP, settledImport } from '../../imports/presentation/importChoices'
import type { AskedChoice, ClosesOf, ImportChoices, SettledImport } from '../../imports/presentation/importChoices'
import { lookAlikesOf, waitText } from '../../imports/presentation/dryRunLines'
import { MAIL_READER_WRITES, heldOrNewReader, writeLeftOut } from '../../mail/application/mailReaderWrites'
import { ibkrMailReader } from '../../mail/domain/ibkrFlexRecipe'
import { mailReaderErrors, mailReaderTexts, withMailField } from '../../mail/presentation/mailReaderForm'
import type { MailReaderField, MailReaderTexts } from '../../mail/presentation/mailReaderForm'
import { seriesKey } from '../../prices/domain/pricesFile'
import { transactionRecordKind } from '../../transactions/application/transactionWrites'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import { INSTRUMENT_RECORDS, INVESTMENT_ACCOUNT_RECORDS, MAIL_READER_RECORDS } from '../../workbook/domain/investmentKinds'
import { words } from '../words'
import { ATTACHMENT_REF } from '../../../../shared/app/assistantOperations'
import type { CardNote, ProposalStep } from '../../../../shared/app/assistantOperations'
import { copiedInKunaText, copiedRowsSource, lookAlikesNote } from '../../../../shared/ai/presentation/copiedRowsWords'
import { FLAG_OR_NULL, TEXT, TEXT_OR_NULL, choiceOf, found, inputOf, isAttachment } from '../../../../shared/app/operationInput'
import { StepRefused } from '../../../../shared/app/proposedWrites'
import type { AccountMoney } from '../../../../shared/money/accountMoney'
import { decimalOfAccountMoney, decimalText } from '../../../../shared/money/decimal'
import { NO_RATES } from '../../../../shared/money/rateBook'
import { newRecordId } from '../../../../shared/storage/domain/recordId'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'
import type { RecordNoun } from '../../../../shared/storage/domain/recordKind'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { fold } from '../../../../shared/text/fold'
import { plural } from '../../../../shared/text/translation'
import type { CardBooks, InvestmentSteps, StepWritten } from './investmentSteps'

const ACCEPT_MAIL_REPORT = 'accept-mail-report'
const IMPORT_TRANSCRIBED = 'import-transcribed'

/** The operations that import rows, whose card holds nothing else. */
export const IMPORTING: ReadonlySet<string> = new Set([ACCEPT_MAIL_REPORT, IMPORT_TRANSCRIBED])
const ASKED: readonly AskedChoice[] = ['hold', 'leave-out']
/** What the person says of a copied row that looks like a record Kuna has, as the Import dialog's Same record and Another record. */
const LOOK_ALIKE_ANSWERS = ['same-record', 'another-record'] as const
const MAIL_FIELDS: readonly MailReaderField[] = ['senders', 'subject', 'contents', 'since']

/** The mailed report the last sync read, which stands in the step for the mail once read. */
interface RowsRead {
  readonly rows: WorkbookRows
}

function isRowsRead(value: unknown): value is RowsRead {
  return typeof value === 'object' && value !== null && 'rows' in value
}

/** The steps with the mailed report the last sync read in place, since a dry run cannot wait for the mail. Or why a step cannot be checked. */
export async function withRowsRead(steps: readonly ProposalStep[], mailReport: () => WorkbookRows | null): Promise<readonly ProposalStep[] | { readonly refused: readonly string[] }> {
  const read: ProposalStep[] = []
  for (const step of steps) {
    if (step.operation === ACCEPT_MAIL_REPORT) {
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
  if (steps.some((step) => step.operation === ACCEPT_MAIL_REPORT))
    return `A report cannot shrink.${first || ' So'} link the review on Settings, General, which accepts a report this size in one write.`
  if (steps.some((step) => step.operation === IMPORT_TRANSCRIBED))
    return `Rows copied from a file go in parts.${first ? ' If other changes share its card, propose them on a card of their own first.' : ''} Put the rows of fewer days on this card, keeping a dividend with its tax and both sides of a transfer together, and propose the rest on the next card once this one is accepted. A day that alone makes more changes than a card holds goes in parts too: put its first rows on this card, and give the next card every row of that day again from its first, since Kuna skips the rows it has.`
  return null
}

/** Where a person answers an import's rows, null for rows the AI copied, which no screen answers, what its warned line is called and what the line says first. */
interface ImportPlace {
  readonly label: string
  readonly place: string | null
  readonly lead: string | null
}

/** A person's answer to a copied row that looks like a record Kuna has, by the row's number among the rows copied: whether it is that record. */
interface LookAlikeRowAnswer {
  readonly row: number
  readonly same: boolean
}

/** What an import does with the questions the card cannot ask. */
interface ImportAnswers {
  readonly asked: AskedChoice
  /** The Kuna account a file's account goes to, by the file's account text. */
  readonly accounts: ImportChoices['accounts']
  /** What the person said in the chat of copied rows that look like records Kuna has. */
  readonly lookAlikes: readonly LookAlikeRowAnswer[]
  readonly where: ImportPlace
}

const ANSWERED_BY_DEFAULTS: Omit<ImportAnswers, 'where'> = { asked: 'hold', accounts: {}, lookAlikes: [] }

function askedOf(field: Readonly<Record<string, unknown>>): AskedChoice {
  return field['asked'] === 'leave-out' ? 'leave-out' : 'hold'
}

/** The kind of the first record the import writes, whose group on the card carries its warned line. A report that adds nothing changes only the mail reader. */
function firstNounOf(added: InvestmentBook): RecordNoun {
  if (added.accounts.length > 0) return INVESTMENT_ACCOUNT_RECORDS.noun
  if (added.instruments.length > 0) return INSTRUMENT_RECORDS.noun
  const first = importableRecords(added)[0]
  return first === undefined ? MAIL_READER_RECORDS.noun : transactionRecordKind(first.kind).noun
}

/** A warning on the card, since the card shows only what the import writes. */
function noteOf(label: string, noun: RecordNoun, counts: readonly (readonly [number, (count: number) => Parameters<typeof plural>[0]])[], lead: string | null = null): CardNote[] {
  const warnings = [...(lead === null ? [] : [lead]), ...counts.flatMap(([count, forms]) => (count === 0 ? [] : [plural(forms(count), count)]))]
  return warnings.length === 0 ? [] : [{ noun, note: { label, text: warnings.join(' '), tone: 'warning' } }]
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
 * The answers the person gave in the chat, as the Import dialog's Questions step takes them: each by the key of its row's
 * entry and the record it looks like. Refused for a row the dry run does not ask about, or one answered twice.
 */
function lookAlikeChoices(dryRun: WorkbookDryRun, answers: readonly LookAlikeRowAnswer[]): ImportChoices['lookAlikes'] {
  const asked = new Map(dryRun.questions.lookAlikes.map((question) => [question.rows[0]!.fileRow, question]))
  const twice = answers.filter((answer, at) => answers.findIndex((other) => other.row === answer.row) !== at).map(({ row }) => row)
  if (twice.length > 0) throw new StepRefused(`lookAlikeAnswers answers row ${twice[0]} twice. Give each row one answer.`)
  const unasked = answers.filter(({ row }) => !asked.has(row)).map(({ row }) => row)
  if (unasked.length > 0) {
    throw new StepRefused(
      `${unasked.length === 1 ? `Row ${unasked[0]} does not look` : `Rows ${unasked.join(', ')} do not look`} like a record Kuna has, so lookAlikeAnswers takes no answer for it. Answer only the rows a card listed as waiting.`,
    )
  }
  return Object.fromEntries(answers.map(({ row, same }) => [asked.get(row)!.key, { like: asked.get(row)!.like.record.id, same }]))
}

/** What the model hears of copied rows that still look like records Kuna has, by their number among the rows copied. */
function lookAlikesWaitText(rows: readonly number[], nothingElse: boolean): string {
  const named = rows.length === 1 ? `Row ${rows[0]} looks like a record Kuna has from another file` : `Rows ${rows.join(', ')} look like records Kuna has from another file`
  const ask = 'Ask the person whether each is the same record or another one, and propose the same rows again with lookAlikeAnswers giving each answer'
  return nothingElse ? `${named} and nothing else is new. ${ask}.` : `${named} and ${rows.length === 1 ? 'waits' : 'wait'}. ${ask} once this card is answered.`
}

/**
 * What the Import dialog writes with every other question left at its default: an account or holding an earlier import
 * wrote to, else a new one as proposed. Refused while the dialog would ask about a split or a spin-off, since their
 * answers set a holding's cost and so its tax, and while the prices file lacks an ECB rate the rows need, which the
 * dialog fetches first. The rows that still wait, and those Kuna cannot read, are counted on a warned line. A report's
 * row that looks like a record Kuna has waits for its screen with the rest. Rows the AI copied have no screen to answer
 * them, so a row Kuna cannot read is refused, and a row that looks like a record Kuna has takes the person's answer from
 * the chat, or is listed on its own, or refused when nothing else is new so the model asks the person.
 */
function importedRows(
  unit: UnitOfWork,
  card: CardBooks,
  rows: WorkbookRows,
  { asked, accounts, lookAlikes, where }: ImportAnswers,
): { readonly written: StepWritten; readonly leftOut: readonly string[] } {
  const rates = card.rates ?? NO_RATES
  const lacking = ratesWanted(rows.rows, rates)
  if (lacking !== null) {
    const currencies = lacking.currencies.join(', ')
    throw new StepRefused(where.place === null ? words.proposals.transcribedRatesMissing(currencies, lacking.from) : words.proposals.ratesMissing(currencies, lacking.from, where.place))
  }
  const ids = new Map<string, string>()
  const newIds = (key: string): string => {
    const id = ids.get(key) ?? newRecordId()
    ids.set(key, id)
    return id
  }
  const closesOf: ClosesOf = (instrument) => card.pricesFile?.series[seriesKey(instrument.prices, instrument.sourceSymbol)]?.closes ?? []
  const leftOut = asked === 'leave-out' ? (rows.report?.asked ?? []).map((row) => row.key) : []
  const choices: ImportChoices = { ...NO_CHOICES, accounts, asked: Object.fromEntries(leftOut.map((key) => [key, asked])) }
  const unanswered = settledImport(rows, card.book, rates, choices, newIds, NO_SPLIT_LOOKUP, closesOf)
  const settled =
    lookAlikes.length === 0 ? unanswered : settledImport(rows, card.book, rates, { ...choices, lookAlikes: lookAlikeChoices(unanswered.dryRun, lookAlikes) }, newIds, NO_SPLIT_LOOKUP, closesOf)
  const askedAbout = holdingsAskedAbout(settled, card.book)
  if (askedAbout.length > 0) {
    const holdings = askedAbout.join(', ')
    throw new StepRefused(where.place === null ? words.proposals.transcribedHoldingsAsked(holdings) : words.proposals.holdingsAsked(holdings, where.place))
  }
  const { dryRun } = settled
  if (where.place === null && dryRun.skipped.length > 0) throw new StepRefused(copiedRowsText(dryRun.skipped.map(copiedRowRefusal)))
  const waits = dryRun.entries.flatMap((entry) => (entry.outcome.kind === 'waiting' ? [entry.outcome.reason] : []))
  const copied = where.place === null
  const stillLookAlike = new Set(dryRun.entries.flatMap((entry) => (copied && entry.outcome.kind === 'waiting' && entry.outcome.reason.kind === 'looks-in-kuna' ? [entry.key] : [])))
  if (stillLookAlike.size > 0 && importableRecords(dryRun.added).length === 0 && dryRun.matched.length === 0) {
    const rowsWaiting = dryRun.questions.lookAlikes.filter((question) => stillLookAlike.has(question.key)).map((question) => question.rows[0]!.fileRow)
    throw new StepRefused(lookAlikesWaitText(rowsWaiting, true))
  }
  writeWorkbookImport(unit, dryRun.added, dryRun.matched, [])
  const waiting = copied ? waits.filter((reason) => reason.kind !== 'looks-in-kuna') : waits
  const reasons = [...new Set(waiting.map(waitText))].join('. ')
  const held = asked === 'hold' ? (rows.report?.asked.length ?? 0) : 0
  const place = where.place
  const inKuna = dryRun.entries.flatMap((entry) => (entry.outcome.kind === 'in-kuna' ? entry.rows : [])).length
  const noun = firstNounOf(dryRun.added)
  const warned = noteOf(
    where.label,
    noun,
    [
      [waiting.length, (count) => (place === null ? words.proposals.transcribedWaiting(count, reasons) : words.proposals.rowsWaiting(count, place))],
      ...(place === null ? [] : ([[dryRun.skipped.length, (count: number) => words.proposals.rowsSkipped(count, place)]] as const)),
      [held, words.proposals.rowsAsked],
    ],
    where.lead,
  )
  const skippedInKuna: CardNote[] = place === null && inKuna > 0 ? [{ noun, note: { label: where.label, text: copiedInKunaText(inKuna), tone: 'neutral' } }] : []
  const accountName = (row: WorkbookRow): string => card.book.accounts.find((account) => account.id === row.account)?.name ?? row.account
  const waitingLookAlikes = lookAlikesOf(dryRun, card.book, rates, accountName).filter((lookAlike) => stillLookAlike.has(lookAlike.key))
  const lookAlikeRows = waitingLookAlikes.map((lookAlike) => lookAlike.fileRow)
  const questions: CardNote[] =
    waitingLookAlikes.length === 0
      ? []
      : [
          {
            noun,
            note: lookAlikesNote(
              waitingLookAlikes.map(({ row, record }) => ({ row, like: record })),
              words.proposals.lookAlike,
            ),
          },
        ]
  const heldBack = [
    ...(lookAlikeRows.length === 0 ? [] : [lookAlikesWaitText(lookAlikeRows, false)]),
    ...(waiting.length === 0 ? [] : [`${waiting.length} ${waiting.length === 1 ? 'row waits' : 'rows wait'} and ${waiting.length === 1 ? 'is' : 'are'} not imported: ${reasons}.`]),
    ...(place === null && inKuna > 0 ? [`${inKuna} ${inKuna === 1 ? 'row is' : 'rows are'} in Kuna already and skipped.`] : []),
    ...(place !== null && dryRun.skipped.length > 0
      ? [`${dryRun.skipped.length} ${dryRun.skipped.length === 1 ? 'row' : 'rows'} Kuna cannot read ${dryRun.skipped.length === 1 ? 'stays' : 'stay'} out.`]
      : []),
  ]
  const fetchesPricesOf = dryRun.added.instruments.filter((instrument) => instrument.prices !== 'manual').map((instrument) => instrument.name)
  return { written: { book: dryRun.planned, made: null, fetchesPricesOf, notes: [...questions, ...skippedInKuna, ...warned], heldBack }, leftOut }
}

/** Why copied rows cannot go in, row by row and by field, so the AI can copy them again. It quotes nothing that was copied. */
function copiedRowsText(refusals: readonly CopiedRowRefusal[]): string {
  return refusals.map(({ fileRow, problem }) => `Row ${fileRow}: ${copiedProblemText(problem)}.`).join(' ')
}

function copiedProblemText(problem: CopiedRowRefusal['problem']): string {
  switch (problem.kind) {
    case 'unreadable':
      return `${problem.field} cannot be read`
    case 'missing':
      return `${problem.field} is missing`
    case 'commission-below-zero':
      return 'commission is below zero, and a commission is copied above zero'
    case 'commission-currency':
      return "commissionCurrency is neither the row's currency nor, for an FX row, its counterCurrency, so copy the commission as a FEE row of its own"
    case 'against-sign':
      return 'its amount is signed against its type, and Kuna has no record for that'
    case 'below-a-cent':
      return 'it exchanges less than a cent'
    case 'unknown-type':
      return 'type is not one Kuna reads'
    case 'refused':
      return problem.reason
  }
}

/** The printed cash balances the rows do not reach, with how far off each ends. */
function cashOffText(off: readonly CashOff[]): string {
  const amount = (cents: AccountMoney): string => decimalText(decimalOfAccountMoney(cents))
  const lines = off.map(
    ({ currency, tie }) =>
      `Cash in ${currency} does not add up: from the opening ${amount(tie.statement.opening)} the rows reach ${amount(tie.reached)}, but the closing is ${amount(tie.statement.closing)}, a gap of ${amount(tie.gap)}.`,
  )
  return `${lines.join(' ')} Copy the rows of that currency again, or give the balances the file prints before this card's first row and after its last.`
}

/**
 * The account the copied rows go to: the one named, or a new one the import names after the broker. A new one is refused
 * while Kuna has an account of that name, so the rows of a broker Kuna knows never land in a second account unasked.
 */
function transcribedAccount(card: CardBooks, named: unknown, broker: string): RecordId | null {
  if (named !== null) return found(card.book.accounts, card.idOf(named), 'account').id
  const same = card.book.accounts.find((account) => fold(account.name) === fold(broker))
  if (same !== undefined)
    throw new StepRefused(`Kuna has an account called ${same.name}. If the rows are on it, name it in account. If the person says they are on another account, give broker a name no account has.`)
  return null
}

/**
 * Rows the AI copied from a file or the chat, through the same dry run as a workbook, with a warned line that the
 * AI read them, and that Kuna could not check that they add up unless the file's printed cash balances tie. Refused with
 * the rows Kuna cannot read or keep, so the AI copies them again, and when the card holds only part of a day Kuna has
 * rows of from the same file.
 */
function importedTranscribed(unit: UnitOfWork, card: CardBooks, field: Readonly<Record<string, unknown>>): StepWritten {
  const file = field['file']
  const fileName = isAttachment(file) ? file.name : ''
  const rows = field['rows'] as readonly TranscribedRow[]
  if (rows.length === 0) throw new StepRefused('rows is empty. Copy the rows of the file onto the card.')
  const broker = String(field['broker']).trim()
  const account = transcribedAccount(card, field['account'], broker)
  if (account === null && broker === '') throw new StepRefused('A new account is named after its broker, so broker is not blank.')
  const accountText = account ?? broker
  const balances = field['balances'] as readonly TranscribedBalance[]
  const lookAlikes = choiceOf(LOOK_ALIKES, field['lookAlikes'] as string, 'lookAlikes')!
  const answers = (field['lookAlikeAnswers'] as readonly { readonly row: number; readonly answer: string }[]).map(({ row, answer }) => ({
    row,
    same: choiceOf(LOOK_ALIKE_ANSWERS, answer, 'answer') === 'same-record',
  }))
  if (lookAlikes === 'import' && answers.length > 0) throw new StepRefused('lookAlikes import imports every row without asking, so lookAlikeAnswers is [].')
  const read = transcribedRows({ fileName, broker, account: accountText, rows, balances }, lookAlikes)
  if (read.kind === 'refused') throw new StepRefused(copiedRowsText(read.rows))
  if (read.kind === 'balance-unread') throw new StepRefused(`${read.field} cannot be read.`)
  if (read.kind === 'cash-off') throw new StepRefused(cashOffText(read.off))
  const partDays = daysPartlyOnCard(read.rows, card.book, fileName)
  if (partDays.length > 0)
    throw new StepRefused(
      `Kuna has rows of ${partDays.join(', ')} from this file that this card does not give, so the card holds only part of those days. Give every row of a day on one card, the ones Kuna has too, since Kuna skips them.`,
    )
  const source = copiedRowsSource(fileName || null)
  const lead = plural(read.cashChecked ? words.proposals.transcribedTied(rows.length, source) : words.proposals.transcribedRead(rows.length, source), rows.length)
  const accounts: ImportChoices['accounts'] = account === null ? {} : { [accountText]: { kind: 'existing', account } }
  return importedRows(unit, card, read.rows, { ...ANSWERED_BY_DEFAULTS, accounts, lookAlikes: answers, where: { label: words.proposals.transcribed, place: null, lead } }).written
}

/** The IBKR mail reader's plain settings, the review of its mailed report and rows the AI copied from any file, as the mail card and the Import dialog write them. Turning the reader on needs Google's consent, so only the person does it. Switching it off needs none. */
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
      name: IMPORT_TRANSCRIBED,
      about: [
        "Imports rows you copied from any broker file, such as a CSV, a PDF statement, a photo, the portfolio workbook or an IBKR report, through the same dry run as Overview, Import: rows already in Kuna are skipped, a sale beyond the units held waits, and accounts and holdings are matched or named as Kuna proposes them. Copy a workbook's Transactions rows as its columns name them.",
        'file names the file by its id, or null for rows typed in the chat. account names the Kuna account the rows are on, or null for a new one named after broker, which is refused while Kuna has an account of that name. A later card of the same file names the account the first card made.',
        'Copy every row as the file prints it, one card at a time: a type of the workbook, numbers with a dot for decimals and no thousands separators, money out below zero in netCash, and blank fields as null. An FX row gives the currency sold in currency and netCash, and the one bought in counterCurrency and counterAmount.',
        "commission is above zero, and commissionCurrency names its currency: the row's currency, or for an FX row its counterCurrency. A commission in any other currency is a FEE row of its own.",
        "balances gives the cash balance the file prints for a currency before this card's first row and after its last, and each must add up with the rows' netCash in that currency. Give [] when the file prints none.",
        "Keep a day's rows on one card, with a dividend beside its tax and both sides of a transfer together. Propose the next rows once the card before is accepted.",
        'lookAlikes says what becomes of a row that looks like a record Kuna has from another file: a trade of the same holding, day, side and units, income of the same holding, day and gross, a cash movement of the same day, kind, currency and amount, or an exchange of the same day and amounts, each in the same account or, for a new account, in any. ask keeps it waiting and lists it on the card, which asks the person to say in the chat whether it is the same record or another one. import imports every such row without asking.',
        'lookAlikeAnswers gives what the person said of each row a card listed as waiting, by its number on that card, with lookAlikes ask: same-record when it is the record Kuna has, which keeps that record and adds nothing for the row, and another-record when it is another record, which imports it. Once the card is answered, propose the same rows again with the answers, and Kuna skips the rows it has. Give [] until the person answers, and always with import.',
      ].join(' '),
      input: inputOf({
        file: TEXT_OR_NULL,
        account: TEXT_OR_NULL,
        broker: TEXT,
        lookAlikes: { type: 'string', enum: [...LOOK_ALIKES] },
        lookAlikeAnswers: { type: 'array', items: inputOf({ row: { type: 'integer' }, answer: { type: 'string', enum: [...LOOK_ALIKE_ANSWERS] } }) },
        rows: {
          type: 'array',
          items: inputOf({
            date: TEXT,
            type: { type: 'string', enum: [...WORKBOOK_TYPES] },
            symbol: TEXT,
            isin: TEXT,
            name: TEXT,
            quantity: TEXT_OR_NULL,
            price: TEXT_OR_NULL,
            currency: TEXT_OR_NULL,
            gross: TEXT_OR_NULL,
            commission: TEXT_OR_NULL,
            commissionCurrency: TEXT_OR_NULL,
            netCash: TEXT_OR_NULL,
            counterCurrency: TEXT_OR_NULL,
            counterAmount: TEXT_OR_NULL,
            note: TEXT,
          }),
        },
        balances: { type: 'array', items: inputOf({ currency: TEXT, opening: TEXT, closing: TEXT }) },
      }),
      refs: { file: ATTACHMENT_REF, account: INVESTMENT_ACCOUNT_RECORDS.name },
      creates: null,
      alone: true,
      example: {
        file: null,
        account: 'account',
        broker: 'Example Broker',
        lookAlikes: 'ask',
        lookAlikeAnswers: [],
        rows: [
          {
            date: '2026-10-12',
            type: 'DEPOSIT',
            symbol: '',
            isin: '',
            name: '',
            quantity: null,
            price: null,
            currency: 'EUR',
            gross: null,
            commission: null,
            commissionCurrency: null,
            netCash: '500',
            counterCurrency: null,
            counterAmount: null,
            note: 'Top-up',
          },
        ],
        balances: [],
      },
    },
  ],
  write(unit, card, { operation, input }) {
    const field = input as Readonly<Record<string, unknown>>
    if (operation === IMPORT_TRANSCRIBED) return importedTranscribed(unit, card, field)
    const held = ibkrMailReader(card.book)
    if (operation === ACCEPT_MAIL_REPORT) {
      const read = field['report']
      if (!isRowsRead(read) || held === null) throw new StepRefused('No mailed report waits.')
      const { written, leftOut } = importedRows(unit, card, read.rows, { ...ANSWERED_BY_DEFAULTS, asked: askedOf(field), where: { ...words.proposals.mailReport, lead: null } })
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
    return { book: { ...card.book, mailReaders: [...card.book.mailReaders.filter((reader) => reader.id !== after.id), after] }, made: null, fetchesPricesOf: [], notes: [], heldBack: [] }
  },
}
