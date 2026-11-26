import { accountSources } from './accountIntake'
import { goneRecords } from './goneRecords'
import type { ImportedRecord } from './importedRecords'
import { accountQuestions, instrumentQuestions, splitQuestion, waitingQuestions } from './importQuestions'
import type { LikelyAccount, LookAlikeQuestion, ReportFacts, ReportQuestion, SpinOffQuestion, SplitRatio, WorkbookQuestions } from './importQuestions'
import { accountsOfReportScope, importedByKey, knownAccountsOf, knownInstrumentsOf, matchedWithKey, withMatchedKeys } from './importKeys'
import { likelyAccounts, lookAlikesOffered, lostWorkbookKey, recordLike, sameAmount } from './lookAlikes'
import type { RoundedCell, SkipReason, SkippedRow, WorkbookColumn, WorkbookRow, WorkbookType } from './portfolioWorkbook'
import { isIncomeReversal, isWithheldRefund, workbookEntries } from './workbookEntries'
import type { RowEntry } from './workbookEntries'
import { words } from './words'
import { bookedWorth, brokerWorthKept, investmentLots } from '../../holdings/domain/lots'
import { priceOfWorth, tradeWorth } from '../../holdings/domain/quoting'
import type { RateBook } from '../../../../shared/money/rateBook'
import { addsCash } from '../../workbook/domain/cashMovement'
import type { CashMovement, CashMovementKind } from '../../workbook/domain/cashMovement'
import { CASH_MOVEMENT_CODEC } from '../../workbook/domain/cashMovementReading'
import type { Exchange } from '../../workbook/domain/exchange'
import { EXCHANGE_CODEC } from '../../workbook/domain/exchangeReading'
import type { Income } from '../../workbook/domain/income'
import { INCOME_CODEC } from '../../workbook/domain/incomeReading'
import type { Instrument } from '../../workbook/domain/instrument'
import { BY_HAND_SOURCES } from '../../workbook/domain/investmentAccount'
import type { InvestmentAccount, InvestmentPeriod } from '../../workbook/domain/investmentAccount'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import { earliestFrom, sourceOn, takesRowOn } from '../../../../shared/app/accountSource'
import {
  CASH_MOVEMENT_RECORDS,
  EXCHANGE_RECORDS,
  INCOME_RECORDS,
  INVESTMENT_ACCOUNT_RECORDS,
  SPIN_OFF_RECORDS,
  SPLIT_RECORDS,
  TRADE_RECORDS,
  TRANSFER_RECORDS,
} from '../../workbook/domain/investmentKinds'
import type { SpinOff } from '../../workbook/domain/spinOff'
import { SPIN_OFF_CODEC } from '../../workbook/domain/spinOffReading'
import type { Split } from '../../workbook/domain/split'
import { SPLIT_CODEC } from '../../workbook/domain/splitReading'
import type { Trade } from '../../workbook/domain/trade'
import { TRADE_CODEC } from '../../workbook/domain/tradeReading'
import type { Transfer } from '../../workbook/domain/transfer'
import { TRANSFER_CODEC } from '../../workbook/domain/transferReading'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { EURO } from '../../../../shared/money/currencyCode'
import type { CurrencyCode } from '../../../../shared/money/currencyCode'
import { DECIMAL_ZERO, addDecimal, decimalOfText, decimalText, magnitude, negateDecimal, scaledDecimal, subtractDecimal, sumDecimal, timesDecimal } from '../../../../shared/money/decimal'
import type { Decimal } from '../../../../shared/money/decimal'
import type { LookAlikes } from '../../../../shared/money/lookAlikeBookings'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import { newRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { refusalOr, storedFieldsOfValues } from '../../../../shared/storage/domain/storedFields'
import { fold } from '../../../../shared/text/fold'

export interface SpinOffAnswer {
  readonly parent: RecordId
  /** The fraction of the parent's cost that moves to the units received. */
  readonly costShare: Decimal
}

/** What the person has said so far. A new account or instrument comes with its own id, so two of the workbook's can name the same one. */
export interface WorkbookAnswers {
  /** By the workbook's Account text. */
  readonly accounts: ReadonlyMap<string, InvestmentAccount>
  /** By the instrument's identity in the workbook, as its question gives it. */
  readonly instruments: ReadonlyMap<string, Instrument>
  /** By the key of the split's entry. */
  readonly splits: ReadonlyMap<string, SplitRatio>
  /** By the key of the spin-off's entry. */
  readonly spinOffs: ReadonlyMap<string, SpinOffAnswer>
  /** By the key of the row's entry. */
  readonly lookAlikes: ReadonlyMap<string, LookAlikeAnswer>
}

/** Whether a row that looks like a record Kuna has is that record. It answers only while the row looks like that same record. */
export interface LookAlikeAnswer {
  readonly like: RecordId
  readonly same: boolean
}

export const NO_ANSWERS: WorkbookAnswers = { accounts: new Map(), instruments: new Map(), splits: new Map(), spinOffs: new Map(), lookAlikes: new Map() }

export interface DryRunInputs {
  /** The records already in Kuna. */
  readonly book: InvestmentBook
  /** The ECB rates of the prices file, which every foreign row but a Revolut top-up carries. */
  readonly rates: RateBook
  readonly answers: WorkbookAnswers
}

/** Why an entry is not imported yet. Each clears once the person answers, the missing row arrives or the job writes the rate. */
export type WaitReason =
  | { readonly kind: 'account' }
  | { readonly kind: 'instrument' }
  | { readonly kind: 'split-ratio' }
  | { readonly kind: 'spin-off' }
  | { readonly kind: 'no-partner' }
  | { readonly kind: 'no-rate'; readonly currency: CurrencyCode }
  | { readonly kind: 'other-currency'; readonly currency: CurrencyCode }
  | { readonly kind: 'same-account' }
  /** A sale or transfer of more units than its account holds on its day. */
  | { readonly kind: 'beyond-held' }
  /** A rolling report now gives other figures for a record Kuna has, such as tax withheld a day after its dividend. */
  | { readonly kind: 'differs-from-kuna' }
  /** A row like a record Kuna has from elsewhere, which may be the same record or a second one. `like` is that record. */
  | { readonly kind: 'looks-in-kuna'; readonly like: ImportedRecord }

export type EntryOutcome =
  | { readonly kind: 'new'; readonly imported: ImportedRecord }
  | { readonly kind: 'in-kuna' }
  /** The person said the row is this record Kuna has, which takes the row's import key. */
  | { readonly kind: 'same-record'; readonly kept: ImportedRecord }
  | { readonly kind: 'waiting'; readonly reason: WaitReason }

export interface DryRunEntry extends RowEntry {
  readonly outcome: EntryOutcome
}

/** A record Kuna has that the person said a row is, before and after it takes the row's import key. */
export interface MatchedRecord {
  readonly kept: ImportedRecord
  readonly keyed: ImportedRecord
}

/** A trade whose fees from its net cash differ from its Commission cell by more than a cent. The fees from the net cash are imported. */
export interface CommissionDifference {
  readonly fileRow: number
  readonly currency: CurrencyCode
  readonly commission: Decimal | null
  readonly fees: Decimal
}

/** A row signed against its type that imports as what it reverses, with the words its record's note gives it. */
export interface ReversedRow {
  readonly fileRow: number
  readonly record: RecordId
  readonly note: string
}

export interface WorkbookDryRun {
  readonly entries: readonly DryRunEntry[]
  readonly skipped: readonly SkippedRow[]
  readonly rounded: readonly RoundedCell[]
  /** Records an earlier import of the workbook wrote that the file no longer has, for the person to keep or delete. */
  readonly gone: readonly ImportedRecord[]
  readonly questions: WorkbookQuestions
  readonly commissionDifferences: readonly CommissionDifference[]
  readonly reversals: readonly ReversedRow[]
  /** What a rolling report held back from its recipe for the person, none for a workbook. */
  readonly report: DryRunReport | null
  /** What Import writes in one unit of work: the new accounts and instruments the new entries name, then their records. */
  readonly added: InvestmentBook
  /** The records in Kuna the person said are rows of the file, which Import gives the rows' import keys in the same unit of work. */
  readonly matched: readonly MatchedRecord[]
  /** The records in Kuna with those added and matched. */
  readonly planned: InvestmentBook
}

/** A report's facts as the dry run leaves them: its questions without those a booked record answers, and what was left out for an account's start day or for its rows coming in by hand. */
export interface DryRunReport extends Omit<ReportFacts, 'asked'> {
  readonly asked: readonly ReportQuestion[]
}

export interface WorkbookRows {
  readonly rows: readonly WorkbookRow[]
  readonly skipped: readonly SkippedRow[]
  readonly rounded: readonly RoundedCell[]
  /** Set for rows of a rolling report, whose files overlap and leave out almost everything, so absence from them means nothing. */
  readonly report?: ReportFacts
  /** Set for rows the AI copied from a file Kuna does not read, which cover only what one card holds, so absence from them means nothing either. */
  readonly transcribed?: { readonly lookAlikes: LookAlikes }
}

const CENT = decimalOfText('0.01')!
/** A price is taken as rounded to the cent at the coarsest. */
const CENT_PLACES = 2
/** A net cash may itself be rounded to the cent. */
const HALF_CENT = decimalOfText('0.005')!
const ONE = decimalOfText('1')!
const CASH_KINDS: Partial<Record<WorkbookRow['type'], CashMovementKind>> = { DEPOSIT: 'deposit', WITHDRAWAL: 'withdrawal', FEE: 'fee', 'FEE REFUND': 'fee-refund' }
const PAID_IN: ReadonlySet<CashMovementKind> = new Set(['deposit', 'fee-refund'])

/** What a lone row signed against its type imports as, with the words its note starts with. */
const REVERSED: Partial<Record<WorkbookType, { readonly kind: CashMovementKind; readonly note: string }>> = {
  INTEREST: { kind: 'fee', note: words.debitInterest },
  FEE: { kind: 'fee-refund', note: words.againstSign('FEE') },
  'FEE REFUND': { kind: 'fee', note: words.againstSign('FEE REFUND') },
  DEPOSIT: { kind: 'withdrawal', note: words.againstSign('DEPOSIT') },
  WITHDRAWAL: { kind: 'deposit', note: words.againstSign('WITHDRAWAL') },
}

const CODECS: { readonly [Kind in ImportedRecord['kind']]: RecordCodec<Extract<ImportedRecord, { readonly kind: Kind }>['record']> } = {
  trade: TRADE_CODEC,
  income: INCOME_CODEC,
  'cash-movement': CASH_MOVEMENT_CODEC,
  exchange: EXCHANGE_CODEC,
  transfer: TRANSFER_CODEC,
  split: SPLIT_CODEC,
  'spin-off': SPIN_OFF_CODEC,
}

class EntryWaits extends Error {
  readonly reason: WaitReason

  constructor(reason: WaitReason) {
    super(reason.kind)
    this.reason = reason
  }
}

class EntrySkipped extends Error {
  readonly fileRow: number
  readonly reason: SkipReason

  constructor(fileRow: number, reason: SkipReason) {
    super(reason.kind)
    this.fileRow = fileRow
    this.reason = reason
  }
}

/**
 * What importing the workbook's rows would do, written nowhere. An entry whose key a record in Kuna carries is in Kuna
 * already, so a second import of the same file adds nothing. Every other entry becomes a record once its account and
 * instrument are answered, its partner is found, its split or spin-off is answered and the ECB series has a rate for a
 * foreign row's day. A sale or transfer beyond what its account holds waits for the row that is missing. A row signed
 * against its type imports as what it reverses, such as debit interest as a fee, a deposit that pays out as a
 * withdrawal or a dividend that pays out as income below zero, and is listed so it is seen. A buy or a sale whose cash
 * goes the other way from its units, and a row whose record the write rules of its kind would refuse, is skipped. A record an earlier import wrote, of an account
 * and dates the file covers, whose key the file no longer gives, is listed as gone. A rolling report lists nothing as
 * gone, and a record of one is never gone from a workbook. A record a report's row now gives other figures for waits.
 * Copied rows list nothing as gone either. A report's row or a copied row whose key no record carries, but which looks
 * like a record Kuna has, waits until the person says whether it is that record or another one, and so does a workbook
 * row like a record that lost its workbook key to a report. A record that is the row takes the row's key beside its keys
 * from other sources, so the next file finds it by its key. A mailed row of an account Kuna does not know yet, dated
 * before the earliest start day of the accounts the mail fills, counts as before the start day and asks nothing. Any
 * other row of a report account Kuna does not know yet asks for its account before any start day leaves it out, so an
 * answer cannot take its own question away.
 */
export function workbookDryRun(reading: WorkbookRows, inputs: DryRunInputs): WorkbookDryRun {
  const { book, answers } = inputs
  const rolling = reading.report !== undefined
  const asksLookAlikes = rolling || reading.transcribed?.lookAlikes === 'ask'
  const workbook = !rolling && reading.transcribed === undefined
  const entries = workbookEntries(reading.rows, rolling)
  const keyed = importedByKey(book)
  const offered = lookAlikesOffered(keyed, rolling)
  const identityOf = identities(reading.rows)
  const inKuna = entries.filter((entry) => keyed.has(entry.key))
  const knownAccounts = rolling ? new Map([...knownAccountsOf(inKuna, keyed), ...accountsOfReportScope(reading.rows, keyed)]) : knownAccountsOf(inKuna, keyed)
  const knownInstruments = knownInstrumentsOf(inKuna, keyed, identityOf)
  const accountOf = (row: WorkbookRow): InvestmentAccount | null => answers.accounts.get(row.account) ?? book.accounts.find((account) => account.id === knownAccounts.get(row.account)) ?? null
  const sources = accountSources(book)
  const sourcesOf = (account: InvestmentAccount): readonly InvestmentPeriod[] => account.sources ?? sources.get(account.id) ?? BY_HAND_SOURCES
  const accountsSoFar = [...book.accounts, ...answers.accounts.values()]
  const instrumentsSoFar = [...book.instruments, ...answers.instruments.values()]
  const instrumentOf = (row: WorkbookRow): Instrument | null =>
    answers.instruments.get(identityOf(row)) ?? book.instruments.find((instrument) => instrument.id === knownInstruments.get(identityOf(row))) ?? null

  const mailed = reading.report?.mailed === true
  const mailStart = mailed ? earliestFrom(sources.values(), 'mail') : null
  // No account the mail fills takes a mailed row dated before the earliest of their start days, so such a row of an account Kuna does not know yet asks nothing.
  const beforeEveryStart = (entry: RowEntry): boolean => mailStart !== null && !knownAccounts.has(entry.rows[0].account) && entry.rows[0].date < mailStart
  const skipped: SkippedRow[] = [...reading.skipped]
  const leftOut = { beforeStart: 0, byHand: 0 }
  // A mailed report brings only the days the mail fills its account. Another report is the broker's own file, which goes on a day an uploaded report or by hand fills, and any other row is by hand, which goes only on a day kept by hand.
  const taken = entries.filter((entry) => {
    const account = accountOf(entry.rows[0])
    if (account === null) {
      if (!beforeEveryStart(entry)) return true
      leftOut.beforeStart += entry.rows.length
      return false
    }
    const periods = sourcesOf(account)
    const day = entry.rows[0].date
    if (mailed) {
      if (takesRowOn(periods, day, 'automation')) return true
      if (sourceOn(periods, day) === null) leftOut.beforeStart += entry.rows.length
      else leftOut.byHand += entry.rows.length
      return false
    }
    if (keyed.has(entry.key) || takesRowOn(periods, day, reading.report === undefined ? 'by-hand' : 'provider-file')) return true
    entry.rows.forEach((row) => skipped.push({ fileRow: row.fileRow, reason: { kind: 'mail-owns', account: account.name } }))
    return false
  })
  const questions: Mapping['questions'] = { spinOffs: [] }
  const mapping: Mapping = { inputs, accountOf, instrumentOf, identityOf, questions, instruments: instrumentsSoFar }
  const claimed = new Set<RecordId>()
  const lookAlikes: LookAlikeQuestion[] = []

  const firstPass = taken.flatMap((entry): { entry: RowEntry; outcome: EntryOutcome }[] => {
    if (keyed.has(entry.key)) {
      return [{ entry, outcome: rolling && differsFromKuna(entry, keyed.get(entry.key)!, mapping) ? { kind: 'waiting', reason: { kind: 'differs-from-kuna' } } : { kind: 'in-kuna' } }]
    }
    try {
      const imported = importedRecord(entry, mapping)
      const like = asksLookAlikes
        ? recordLike(imported, book, offered(entry, claimed))
        : workbook
          ? recordLike(imported, book, (record) => lostWorkbookKey(record) && offered(entry, claimed)(record))
          : null
      if (like === null) return [{ entry, outcome: { kind: 'new', imported } }]
      claimed.add(like.record.id)
      lookAlikes.push({ key: entry.key, rows: entry.rows, like })
      const answer = answers.lookAlikes.get(entry.key)
      if (answer === undefined || answer.like !== like.record.id) return [{ entry, outcome: { kind: 'waiting', reason: { kind: 'looks-in-kuna', like } } }]
      return [{ entry, outcome: answer.same ? { kind: 'same-record', kept: like } : { kind: 'new', imported } }]
    } catch (failure) {
      if (failure instanceof EntryWaits) {
        return [{ entry, outcome: { kind: 'waiting', reason: failure.reason } }]
      }
      if (failure instanceof EntrySkipped) {
        skipped.push({ fileRow: failure.fileRow, reason: failure.reason })
        return []
      }
      throw failure
    }
  })

  const matched = firstPass.flatMap(({ entry, outcome }): MatchedRecord[] => (outcome.kind === 'same-record' ? [{ kept: outcome.kept, keyed: matchedWithKey(outcome.kept, entry.key) }] : []))
  const plannedOf = (outcomes: readonly { outcome: EntryOutcome }[]): InvestmentBook =>
    withMatchedKeys(
      withRecords(
        book,
        outcomes.flatMap(({ outcome }) => (outcome.kind === 'new' ? [outcome.imported] : [])),
        accountsSoFar,
        instrumentsSoFar,
      ),
      matched,
    )
  const refused = new Set([...investmentLots(plannedOf(firstPass)).values()].flatMap((lots) => lots.refused.map((record) => record.id)))
  const outcomes = firstPass.map(({ entry, outcome }): DryRunEntry => {
    const beyondHeld = outcome.kind === 'new' && (outcome.imported.kind === 'trade' || outcome.imported.kind === 'transfer') && refused.has(outcome.imported.record.id)
    return { ...entry, outcome: beyondHeld ? { kind: 'waiting', reason: { kind: 'beyond-held' } } : outcome }
  })
  const planned = plannedOf(outcomes)
  // A row the person matched to a record still asks its account, or the answer that made the match would go.
  const toImport = outcomes.filter((entry) => entry.outcome.kind !== 'in-kuna')
  // An account Kuna does not know yet is asked about by all its rows, so the start day of the account picked for it cannot take its own question away.
  const askingAccount = [
    ...toImport.filter((entry) => knownAccounts.has(entry.rows[0].account)),
    ...entries.filter((entry) => !knownAccounts.has(entry.rows[0].account) && !keyed.has(entry.key) && !beforeEveryStart(entry)),
  ]
  const likely = rolling ? likelyAccounts(askingAccount, book, knownAccounts, offered, (entry) => recordInAnyAccount(entry, mapping)) : new Map<string, LikelyAccount>()

  return {
    entries: outcomes,
    skipped: skipped.sort((first, second) => first.fileRow - second.fileRow),
    rounded: reading.rounded,
    gone: rolling || reading.transcribed !== undefined ? [] : goneRecords(reading.rows, entries, keyed, accountOf),
    questions: {
      accounts: accountQuestions(askingAccount, knownAccounts, likely, book.accounts),
      instruments: instrumentQuestions(toImport, book, knownInstruments, identityOf),
      splits: toImport.filter((entry) => entry.rows[0].type === 'SPLIT').map((entry) => splitQuestion(entry, planned, instrumentOf, identityOf)),
      spinOffs: questions.spinOffs,
      lookAlikes,
    },
    commissionDifferences: commissionDifferences(outcomes),
    reversals: reversedRows(outcomes),
    report:
      reading.report === undefined
        ? null
        : { ...reading.report, asked: waitingQuestions(reading.report, keyed), beforeStart: reading.report.beforeStart + leftOut.beforeStart, byHand: leftOut.byHand },
    added: addedRecords(book, planned),
    matched,
    planned,
  }
}

interface Mapping {
  readonly inputs: DryRunInputs
  readonly accountOf: (row: WorkbookRow) => InvestmentAccount | null
  readonly instrumentOf: (row: WorkbookRow) => Instrument | null
  readonly identityOf: (row: WorkbookRow) => string
  readonly questions: { readonly spinOffs: SpinOffQuestion[] }
  readonly instruments: readonly Instrument[]
}

/**
 * Whether the record a report's row would make now differs in its figures from the one Kuna has. Units and prices have to
 * be equal, and amounts the same by `sameAmount`, so a record kept to the cent does not differ from the report's fractions.
 * A row that cannot make a record yet says nothing.
 */
function differsFromKuna(entry: RowEntry, kept: ImportedRecord, mapping: Mapping): boolean {
  try {
    const now = figuresOf(recordOf(entry, mapping))
    const before = figuresOf(kept)
    return (
      now.units.length !== before.units.length ||
      now.amounts.length !== before.amounts.length ||
      now.units.some((units, at) => units !== before.units[at]) ||
      now.amounts.some((amount, at) => !sameAmount(amount, before.amounts[at]!))
    )
  } catch (failure) {
    if (failure instanceof EntryWaits || failure instanceof EntrySkipped) return false
    throw failure
  }
}

/** The units, prices and amounts of a record a report can change. */
function figuresOf(imported: ImportedRecord): { readonly units: readonly Decimal[]; readonly amounts: readonly Decimal[] } {
  switch (imported.kind) {
    case 'trade':
      return { units: [imported.record.quantity, imported.record.price], amounts: [] }
    case 'income':
      return { units: [], amounts: [imported.record.gross, imported.record.withheld] }
    case 'cash-movement':
      return { units: [], amounts: [imported.record.amount] }
    case 'exchange':
      return { units: [], amounts: [imported.record.sold, imported.record.bought] }
    default:
      return { units: [], amounts: [] }
  }
}

/** The entry's record, skipped when the write rules of its kind would refuse it, so Import never fails on one row. */
function importedRecord(entry: RowEntry, mapping: Mapping): ImportedRecord {
  const imported = recordOf(entry, mapping)
  const codec = CODECS[imported.kind] as RecordCodec<ImportedRecord['record']>
  const read = refusalOr(() => codec.make(storedFieldsOfValues(codec.fieldsOf(imported.record)), imported.record.id))
  if ('refused' in read) {
    throw new EntrySkipped(entry.rows[0].fileRow, { kind: 'refused', reason: read.refused })
  }
  return imported
}

function recordOf(entry: RowEntry, mapping: Mapping): ImportedRecord {
  const row = entry.rows[0]
  const reversed = reversalOf(entry)
  if (reversed !== null) {
    return { kind: 'cash-movement', record: cashMovementOf(row, reversed.kind, entry.key, mapping, reversed.note) }
  }
  const cashKind = CASH_KINDS[row.type]
  if (cashKind !== undefined) {
    return { kind: 'cash-movement', record: cashMovementOf(row, cashKind, entry.key, mapping, '') }
  }
  switch (row.type) {
    case 'BUY':
    case 'SELL':
      return { kind: 'trade', record: tradeOf(row, entry.key, mapping) }
    case 'DIVIDEND':
    case 'INTEREST':
    case 'STOCK YIELD INCOME':
    case 'REFERRAL CREDIT':
      return { kind: 'income', record: incomeOf(entry, mapping) }
    case 'FX':
      return { kind: 'exchange', record: exchangeOf(row, entry.key, mapping) }
    case 'TRANSFER OUT':
    case 'INTERNAL CASH TRANSFER':
      return { kind: 'transfer', record: transferOf(entry, mapping) }
    case 'SPLIT':
      return { kind: 'split', record: splitOf(entry, mapping) }
    case 'SPINOFF':
      return { kind: 'spin-off', record: spinOffOf(row, entry.key, mapping) }
    case 'WITHHOLDING TAX':
      if (isWithheldRefund(row)) {
        return { kind: 'income', record: withheldRefundOf(row, entry.key, mapping) }
      }
      throw new EntryWaits({ kind: 'no-partner' })
    default:
      // A transfer in that pairing left alone.
      throw new EntryWaits({ kind: 'no-partner' })
  }
}

/** The kind a lone row signed against its type imports as, null for a row signed as its type moves money or one with partners. */
function reversalOf(entry: RowEntry): { readonly kind: CashMovementKind; readonly note: string } | null {
  const [row, ...partners] = entry.rows
  const reversed = REVERSED[row.type]
  const amount = row.netCash ?? row.gross
  if (reversed === undefined || partners.length > 0 || amount === null || amount === DECIMAL_ZERO) {
    return null
  }
  const paysIn = amount > DECIMAL_ZERO
  return paysIn === addsCash(reversed.kind) ? reversed : null
}

/** The rows of the new entries signed against their type, with the words each gives its record's note. */
function reversedRows(entries: readonly DryRunEntry[]): ReversedRow[] {
  return entries.flatMap((entry) => {
    if (entry.outcome.kind !== 'new') {
      return []
    }
    const record = entry.outcome.imported.record.id
    const [lead, ...partners] = entry.rows
    const reversed = incomeReversalNote(lead)
    const leadNote = reversalOf(entry)?.note ?? (isWithheldRefund(lead) ? words.withheldRefund : reversed)
    return [
      ...(leadNote === null ? [] : [{ fileRow: lead.fileRow, record, note: leadNote }]),
      ...(reversed === null ? partners.filter(isWithheldRefund).map((row) => ({ fileRow: row.fileRow, record, note: words.withheldLowered })) : []),
    ]
  })
}

/** The words that start the note of income whose row pays out, reversing an earlier payment, null for any other row. */
function incomeReversalNote(row: WorkbookRow): string | null {
  if (!isIncomeReversal(row)) {
    return null
  }
  return row.type === 'DIVIDEND' ? words.reversesDividend : words.reversesPayment
}

function required<Column extends WorkbookColumn & keyof WorkbookRow>(row: WorkbookRow, column: Column): NonNullable<WorkbookRow[Column]> {
  const value = row[column]
  if (value === null || value === '') {
    throw new EntrySkipped(row.fileRow, { kind: 'missing', column })
  }
  return value as NonNullable<WorkbookRow[Column]>
}

/** The amount without its sign, which has to be the way the row's type moves money. Zero passes either way. */
function directed(row: WorkbookRow, amount: Decimal, paidIn: boolean): Decimal {
  if (paidIn ? amount < DECIMAL_ZERO : amount > DECIMAL_ZERO) {
    throw new EntrySkipped(row.fileRow, { kind: 'against-sign' })
  }
  return magnitude(amount)
}

function accountFor(row: WorkbookRow, mapping: Mapping): InvestmentAccount {
  const account = mapping.accountOf(row)
  if (account === null) {
    throw new EntryWaits({ kind: 'account' })
  }
  return account
}

function instrumentFor(row: WorkbookRow, mapping: Mapping): Instrument {
  const instrument = mapping.instrumentOf(row)
  if (instrument === null) {
    throw new EntryWaits({ kind: 'instrument' })
  }
  return instrument
}

/** The ECB rate of the day, or of the latest earlier day it published one. Null for euros. */
function ecbRate(currency: CurrencyCode, date: CivilDate, mapping: Mapping): Decimal | null {
  if (currency === EURO) {
    return null
  }
  const rate = mapping.inputs.rates.unitsPerEuroOnOrBefore(currency, date)
  if (rate === null) {
    throw new EntryWaits({ kind: 'no-rate', currency })
  }
  return rate
}

/**
 * A buy's fees are what its net cash paid beyond its booked worth, a sale's what its booked worth got beyond its net
 * cash, so the trade moves its net cash exactly. The booked worth is the one the row gives, kept on the trade when it is
 * not quantity × price to the cent, and otherwise quantity × price to the cent. Without a net cash the fees are the
 * Commission cell. A trade with no commission and no worth of its own whose net cash and quantity × price differ by no
 * more than the price's rounding, as a broker that shows the price to the cent books it, takes its price from the net
 * cash and has no fees.
 */
function tradeOf(row: WorkbookRow, key: string, mapping: Mapping): Trade {
  const quantity = magnitude(required(row, 'quantity'))
  const price = required(row, 'price')
  const currency = required(row, 'currency')
  const side = row.type === 'BUY' ? 'buy' : 'sell'
  const netCash = row.netCash === null ? null : directed(row, row.netCash, side === 'sell')
  const account = accountFor(row, mapping)
  const instrument = instrumentFor(row, mapping)
  if (instrument.currency !== currency) {
    throw new EntryWaits({ kind: 'other-currency', currency })
  }
  const worth = tradeWorth(instrument.quoted, quantity, price)
  const brokerWorth = brokerWorthKept(instrument.quoted, quantity, price, row.worth === null ? null : magnitude(row.worth))
  const pricedByNet =
    netCash !== null &&
    row.worth === null &&
    quantity > DECIMAL_ZERO &&
    (row.commission ?? DECIMAL_ZERO) === DECIMAL_ZERO &&
    magnitude(subtractDecimal(netCash, worth)) <= addDecimal(tradeWorth(instrument.quoted, quantity, halfStepOf(price)), HALF_CENT)
  const booked = bookedWorth(instrument.quoted, quantity, price, brokerWorth)
  const fees = netCash === null ? row.commission : pricedByNet ? DECIMAL_ZERO : side === 'buy' ? subtractDecimal(netCash, booked) : subtractDecimal(booked, netCash)
  return {
    id: recordIdOf(TRADE_RECORDS, newRecordId()),
    account: account.id,
    instrument: instrument.id,
    side,
    date: row.date,
    quantity,
    price: pricedByNet ? priceOfWorth(instrument.quoted, netCash, quantity) : price,
    ...(brokerWorth === undefined ? {} : { brokerWorth }),
    fees,
    rate: ecbRate(currency, row.date, mapping),
    accrued: null,
    importKeys: [key],
    note: row.note,
    ...(row.settles === null ? {} : { settles: row.settles }),
  }
}

/** Half a unit of the price's last decimal place, taking a price as rounded to the cent at the coarsest. */
function halfStepOf(price: Decimal): Decimal {
  const places = Math.max(decimalText(price).split('.')[1]?.length ?? 0, CENT_PLACES)
  return scaledDecimal(ONE, 1n, 2n * 10n ** BigInt(places))
}

/**
 * Income with the tax its withholding rows took. A Revolut dividend comes booked net of the tax withheld, so without a
 * withholding row its gross is its net and its note says so. A workbook that gives the tax adds its withholding row.
 * A row that pays out reverses an earlier payment, so its gross is below zero and a refund with it gives the tax back.
 */
function incomeOf(entry: RowEntry, mapping: Mapping): Income {
  const [row, ...withholdings] = entry.rows
  const currency = required(row, 'currency')
  const amount = row.gross ?? required(row, 'netCash')
  const reversal = incomeReversalNote(row)
  const received = reversal === null ? directed(row, amount, true) : amount
  const withheld = negateDecimal(sumDecimal(withholdings.map((withholding) => withholding.netCash ?? required(withholding, 'gross'))))
  const isDividend = row.type === 'DIVIDEND'
  const bookedNet = isDividend && withholdings.length === 0 && fold(row.broker) === 'REVOLUT'
  const account = accountFor(row, mapping)
  const instrument = isDividend ? instrumentFor(row, mapping) : null
  const rate = ecbRate(currency, row.date, mapping)
  const label = row.type === 'STOCK YIELD INCOME' ? words.stockYieldIncome : row.type === 'REFERRAL CREDIT' ? words.referralCredit : bookedNet ? words.bookedNet : ''
  const lowered = reversal === null && withholdings.some(isWithheldRefund) ? words.withheldLowered : ''
  return {
    id: recordIdOf(INCOME_RECORDS, newRecordId()),
    account: account.id,
    kind: isDividend ? 'dividend' : row.type === 'INTEREST' ? 'interest' : row.type === 'STOCK YIELD INCOME' ? 'lending' : row.type === 'REFERRAL CREDIT' ? 'referral' : 'other',
    instrument: instrument?.id ?? null,
    date: row.date,
    currency,
    gross: received,
    withheld,
    rate,
    importKeys: [entry.key],
    note: [reversal ?? '', label, lowered, row.note].filter((part) => part !== '').join('. '),
    ...(row.dividend === null ? {} : { dividend: row.dividend }),
  }
}

/** A refund of withheld tax with no taxed income on its day to lower, as other income of its account. */
function withheldRefundOf(row: WorkbookRow, key: string, mapping: Mapping): Income {
  const currency = required(row, 'currency')
  const refunded = magnitude(row.netCash ?? required(row, 'gross'))
  const account = accountFor(row, mapping)
  return {
    id: recordIdOf(INCOME_RECORDS, newRecordId()),
    account: account.id,
    kind: 'other',
    instrument: null,
    date: row.date,
    currency,
    gross: refunded,
    withheld: DECIMAL_ZERO,
    rate: ecbRate(currency, row.date, mapping),
    importKeys: [key],
    note: [words.withheldRefund, row.note].filter((part) => part !== '').join('. '),
  }
}

/**
 * A deposit or withdrawal carries the rate Revolut changed it at, where the row gives one, and anything else the ECB
 * rate. `label` starts the note of a row imported as what it reverses.
 */
function cashMovementOf(row: WorkbookRow, kind: CashMovementKind, key: string, mapping: Mapping, label: string): CashMovement {
  const amount = directed(row, row.netCash ?? required(row, 'gross'), PAID_IN.has(kind))
  const currency = required(row, 'currency')
  const account = accountFor(row, mapping)
  const ownRate = (kind === 'deposit' || kind === 'withdrawal') && currency !== EURO ? row.revolutRate : null
  return {
    id: recordIdOf(CASH_MOVEMENT_RECORDS, newRecordId()),
    account: account.id,
    kind,
    date: row.date,
    currency,
    amount,
    rate: ownRate ?? ecbRate(currency, row.date, mapping),
    importKeys: [key],
    note: [label, row.note].filter((part) => part !== '').join('. '),
  }
}

/**
 * The net cash is one leg and the FX counter amount the other, each after fees. The Commission cell is the exchange's
 * fee in euros. A report's conversion of dust keeps its fractions of a cent and is booked. A leg at zero, such as one a
 * workbook's rounding to the cent left there, is skipped.
 */
function exchangeOf(row: WorkbookRow, key: string, mapping: Mapping): Exchange {
  const net = required(row, 'netCash')
  const currency = required(row, 'currency')
  const counter = magnitude(required(row, 'counterAmount'))
  const counterCurrency = required(row, 'counterCurrency')
  if (net === DECIMAL_ZERO || counter === DECIMAL_ZERO) {
    throw new EntrySkipped(row.fileRow, { kind: 'below-a-cent' })
  }
  const account = accountFor(row, mapping)
  const sells = net < DECIMAL_ZERO
  return {
    id: recordIdOf(EXCHANGE_RECORDS, newRecordId()),
    account: account.id,
    date: row.date,
    sold: sells ? magnitude(net) : counter,
    soldCurrency: sells ? currency : counterCurrency,
    bought: sells ? counter : net,
    boughtCurrency: sells ? counterCurrency : currency,
    fees: row.commission !== null && row.commission > DECIMAL_ZERO ? { amount: row.commission, currency: row.commissionCurrency ?? EURO } : null,
    importKeys: [key],
    note: row.note,
  }
}

function transferOf(entry: RowEntry, mapping: Mapping): Transfer {
  const [out, into] = entry.rows
  if (into === undefined) {
    throw new EntryWaits({ kind: 'no-partner' })
  }
  const moved: Transfer['moved'] =
    out.type === 'TRANSFER OUT'
      ? { kind: 'units', instrument: instrumentFor(out, mapping).id, quantity: magnitude(required(out, 'quantity')) }
      : { kind: 'cash', currency: required(out, 'currency'), amount: magnitude(out.netCash ?? required(out, 'gross')) }
  const from = accountFor(out, mapping)
  const to = accountFor(into, mapping)
  if (from.id === to.id) {
    throw new EntryWaits({ kind: 'same-account' })
  }
  return { id: recordIdOf(TRANSFER_RECORDS, newRecordId()), from: from.id, to: to.id, date: out.date, moved, importKeys: [entry.key], note: out.note }
}

function splitOf(entry: RowEntry, mapping: Mapping): Split {
  const row = entry.rows[0]
  const instrument = instrumentFor(row, mapping)
  const ratio = mapping.inputs.answers.splits.get(entry.key)
  if (ratio === undefined) {
    throw new EntryWaits({ kind: 'split-ratio' })
  }
  return { id: recordIdOf(SPLIT_RECORDS, newRecordId()), instrument: instrument.id, date: row.date, ...ratio, importKeys: [entry.key], note: row.note }
}

/** The row names the instrument received. Its parent and the share of the parent's cost come from the row's own columns or the person. */
function spinOffOf(row: WorkbookRow, key: string, mapping: Mapping): SpinOff {
  const quantity = magnitude(required(row, 'quantity'))
  const price = required(row, 'price')
  mapping.questions.spinOffs.push({
    key,
    identity: mapping.identityOf(row),
    date: row.date,
    quantity,
    worth: timesDecimal(quantity, price),
    currency: row.currency,
    from: row.spinOffFrom,
    costShare: row.costShare,
    costShareUnclear: row.costShareUnclear,
    costShareText: row.costShareText,
  })
  const received = instrumentFor(row, mapping)
  const answer = mapping.inputs.answers.spinOffs.get(key)
  const parent = mapping.instruments.find((instrument) => instrument.id === answer?.parent)
  if (answer === undefined || parent === undefined) {
    throw new EntryWaits({ kind: 'spin-off' })
  }
  if (parent.currency !== received.currency) {
    throw new EntryWaits({ kind: 'other-currency', currency: received.currency })
  }
  return { id: recordIdOf(SPIN_OFF_RECORDS, newRecordId()), instrument: parent.id, received: received.id, date: row.date, quantity, costShare: answer.costShare, importKeys: [key], note: row.note }
}

/**
 * Each row's instrument identity: its ISIN, else the ISIN another row gives its Yahoo symbol, else the Yahoo symbol,
 * else the broker symbol. So a fund booked under two symbols with one ISIN is one instrument.
 */
function identities(rows: readonly WorkbookRow[]): (row: WorkbookRow) => string {
  const isinOfSymbol = new Map(rows.filter((row) => row.isin !== '' && row.yahooSymbol !== '').map((row) => [fold(row.yahooSymbol), row.isin]))
  return (row) => (row.isin !== '' ? row.isin : (isinOfSymbol.get(fold(row.yahooSymbol)) ?? (row.yahooSymbol !== '' ? fold(row.yahooSymbol) : fold(row.brokerSymbol))))
}

/** An account no record is in, so a row of it may look like a record of any account. */
const ANY_ACCOUNT: InvestmentAccount = { id: recordIdOf(INVESTMENT_ACCOUNT_RECORDS, 'any-account'), name: '', note: '', sources: BY_HAND_SOURCES }

/** The record a row would make in an account no record is in, or null for a row that cannot make one yet. */
function recordInAnyAccount(entry: RowEntry, mapping: Mapping): ImportedRecord | null {
  try {
    return recordOf(entry, { ...mapping, accountOf: () => ANY_ACCOUNT, questions: { spinOffs: [] } })
  } catch (failure) {
    if (failure instanceof EntryWaits || failure instanceof EntrySkipped) return null
    throw failure
  }
}

function commissionDifferences(entries: readonly DryRunEntry[]): CommissionDifference[] {
  return entries.flatMap(({ rows: [row], outcome }) => {
    if (outcome.kind !== 'new' || outcome.imported.kind !== 'trade' || row.netCash === null || row.currency === null) {
      return []
    }
    const fees = outcome.imported.record.fees ?? DECIMAL_ZERO
    return magnitude(subtractDecimal(fees, row.commission ?? DECIMAL_ZERO)) > CENT ? [{ fileRow: row.fileRow, currency: row.currency, commission: row.commission, fees }] : []
  })
}

/** Kuna's records with the imported ones after them, and the accounts and instruments they name. */
function withRecords(book: InvestmentBook, imported: readonly ImportedRecord[], accounts: readonly InvestmentAccount[], instruments: readonly Instrument[]): InvestmentBook {
  const records = {
    trades: [...book.trades],
    income: [...book.income],
    cashMovements: [...book.cashMovements],
    exchanges: [...book.exchanges],
    transfers: [...book.transfers],
    splits: [...book.splits],
    spinOffs: [...book.spinOffs],
  }
  for (const item of imported) {
    switch (item.kind) {
      case 'trade':
        records.trades.push(item.record)
        break
      case 'income':
        records.income.push(item.record)
        break
      case 'cash-movement':
        records.cashMovements.push(item.record)
        break
      case 'exchange':
        records.exchanges.push(item.record)
        break
      case 'transfer':
        records.transfers.push(item.record)
        break
      case 'split':
        records.splits.push(item.record)
        break
      case 'spin-off':
        records.spinOffs.push(item.record)
        break
    }
  }
  const named = new Set<RecordId>([
    ...records.trades.flatMap((trade) => [trade.account, trade.instrument]),
    ...records.income.flatMap((payment) => [payment.account, ...(payment.instrument === null ? [] : [payment.instrument])]),
    ...records.cashMovements.map((movement) => movement.account),
    ...records.exchanges.map((exchange) => exchange.account),
    ...records.transfers.flatMap((transfer) => [transfer.from, transfer.to, ...(transfer.moved.kind === 'units' ? [transfer.moved.instrument] : [])]),
    ...records.splits.map((split) => split.instrument),
    ...records.spinOffs.flatMap((spinOff) => [spinOff.instrument, spinOff.received]),
  ])
  const inBookOrNamed = <Named extends { readonly id: RecordId }>(inBook: readonly Named[], candidates: readonly Named[]): Named[] =>
    uniqueById([...inBook, ...candidates.filter((candidate) => named.has(candidate.id))])
  return { ...book, ...records, accounts: inBookOrNamed(book.accounts, accounts), instruments: inBookOrNamed(book.instruments, instruments) }
}

function uniqueById<Record extends { readonly id: RecordId }>(records: readonly Record[]): Record[] {
  return [...new Map(records.map((record) => [record.id, record])).values()]
}

function addedRecords(book: InvestmentBook, planned: InvestmentBook): InvestmentBook {
  const after = <Record>(before: readonly Record[], all: readonly Record[]): Record[] => all.slice(before.length)
  const inBook = new Set([...book.accounts, ...book.instruments].map((record) => record.id))
  return {
    accounts: planned.accounts.filter((account) => !inBook.has(account.id)),
    instruments: planned.instruments.filter((instrument) => !inBook.has(instrument.id)),
    trades: after(book.trades, planned.trades),
    income: after(book.income, planned.income),
    cashMovements: after(book.cashMovements, planned.cashMovements),
    exchanges: after(book.exchanges, planned.exchanges),
    transfers: after(book.transfers, planned.transfers),
    splits: after(book.splits, planned.splits),
    spinOffs: after(book.spinOffs, planned.spinOffs),
    prices: [],
    fundMixes: [],
    targets: [],
    checks: [],
    mailReaders: [],
    settings: [],
  }
}
