import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { amountOf as unitsOf } from '../../../../shared/money/money'
import { normaliseIban } from '../../../../shared/text/fold'
import { ownerShareProblem, ownerShareText, storedOwnerShare } from '../../owner-share/domain/ownerShare'
import { bookingOrder } from './bookingOrder'
import { UNCLASSIFIED } from './bucket'
import { LEDGER_RECORDS } from './coreKinds'
import { ID_FIELD, dayText, labelWords, labelled, numberText } from '../../../../shared/storage/domain/recordCodec'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import { amountText, filledFields } from '../../../../shared/storage/domain/recordFields'
import { recordIdOf } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { problemOf, refusedProblems } from '../../../../shared/storage/domain/recordsRead'
import type { ReadRecord, Reading, RecordProblem, RecordsRead } from '../../../../shared/storage/domain/recordsRead'
import { sharedKeys } from '../../../../shared/storage/domain/sharedKeys'
import { keyedId, refuse, slugOf, textOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredField, StoredFields } from '../../../../shared/storage/domain/storedFields'
import type { Category, Transaction } from './workbook'

/** A ledger row as stored: a transaction before its category is looked up and its booking order derived. */
export type LedgerEntry = Omit<Transaction, 'sequence' | 'family' | 'bucket' | 'split'>

/** What a ledger row's key is made of, its amounts as the number of currency units stored. */
export interface LedgerKeyParts {
  readonly account: string
  readonly reference: string
  readonly date: CivilDate
  readonly amount: number
  readonly balance: number
  readonly description: string
}

/**
 * What a ledger row is kept by: its account and reference, or for a row without a reference its
 * account, day, amount, balance and description.
 */
export function ledgerKeyOf(parts: LedgerKeyParts): string {
  return parts.reference === '' ? JSON.stringify([parts.account, parts.date, parts.amount, parts.balance, parts.description]) : referencedLedgerKey(parts.account, parts.reference)
}

/** The key of a row that names its reference, whatever else the row holds, so a row the reader refuses keeps its identity too. */
export function referencedLedgerKey(account: string, reference: string): string {
  return JSON.stringify([account, reference])
}

/** The id of a ledger entry the app makes, by its key. */
export function ledgerIdOf(entry: Pick<LedgerEntry, 'account' | 'reference' | 'date' | 'amount' | 'balance' | 'description'>): RecordId {
  return recordIdOf(LEDGER_RECORDS, ledgerKeyOf({ ...entry, amount: unitsOf(entry.amount), balance: unitsOf(entry.balance) }))
}

/**
 * The transaction on one ledger row. The ledger's `family`, `bucket` and `month` columns are the
 * Sheet's own formulas and are not read: family and bucket come from `categories`, the way those
 * formulas derive them.
 */
export function ledgerEntryOf(fields: StoredFields, id: RecordId | null): LedgerEntry {
  const date = fields.date === undefined ? refuse('no date') : (fields.date.date ?? refuse(`the date "${fields.date.text}" is not a date cell`))
  const account = slugOf(fields.account)
  if (account === '') {
    refuse('no account')
  }
  return {
    account,
    date,
    statement: textOf(fields.statement),
    counterparty: textOf(fields.counterparty),
    counterpartyIban: normaliseIban(textOf(fields.counterparty_iban)),
    description: textOf(fields.description),
    amount: amountOf(fields.amount, 'amount'),
    balance: amountOf(fields.balance, 'balance'),
    category: slugOf(fields.category),
    flaggedBy: slugOf(fields.flagged_by),
    // The column holds numbers on some rows and text on others, so it is always read as text.
    reference: textOf(fields.reference),
    signals: {
      purpose: textOf(fields.purpose),
      txDomain: textOf(fields.tx_domain),
      txFamily: textOf(fields.tx_family),
      txSubFamily: textOf(fields.tx_sub_family),
      creditorReference: textOf(fields.creditor_reference),
      instructedCurrency: textOf(fields.instructed_currency),
    },
    reviewReasons: reviewReasonsOf(fields.review_reasons),
    ownerShare: storedOwnerShare(fields.owner_share),
    id: keyedId(id),
    rowId: textOf(fields[ID_FIELD]) || null,
  }
}

/**
 * The ledger row's key. A row with a reference is known by it even when the ledger's factory refuses
 * the row, so a statement carrying that reference is never added beside it. Null for a refused row
 * without one.
 */
function ledgerKey(fields: StoredFields): string | null {
  const account = slugOf(fields.account)
  const reference = textOf(fields.reference)
  if (account !== '' && reference !== '') {
    return referencedLedgerKey(account, reference)
  }
  const date = fields.date?.date ?? null
  const amount = fields.amount?.number ?? null
  const balance = fields.balance?.number ?? null
  if (date === null || account === '' || amount === null || balance === null) {
    return null
  }
  return ledgerKeyOf({ account, reference, date, amount, balance, description: textOf(fields.description) })
}

export const LEDGER_CODEC: RecordCodec<LedgerEntry> = {
  kind: LEDGER_RECORDS,
  key: ledgerKey,
  label: (fields) => labelWords([dayText(fields.date), textOf(fields.counterparty) || textOf(fields.description), numberText(fields.amount), labelled('balance', numberText(fields.balance))]),
  make: ledgerEntryOf,
  fieldsOf: (entry) =>
    filledFields({
      date: entry.date,
      account: entry.account,
      statement: entry.statement,
      counterparty: entry.counterparty,
      counterparty_iban: entry.counterpartyIban,
      description: entry.description,
      amount: amountText(entry.amount),
      balance: amountText(entry.balance),
      category: entry.category,
      flagged_by: entry.flaggedBy,
      reference: entry.reference,
      purpose: entry.signals.purpose,
      tx_domain: entry.signals.txDomain,
      tx_family: entry.signals.txFamily,
      tx_sub_family: entry.signals.txSubFamily,
      creditor_reference: entry.signals.creditorReference,
      instructed_currency: entry.signals.instructedCurrency,
      review_reasons: entry.reviewReasons.join(' | '),
      owner_share: ownerShareText(entry.ownerShare),
      [ID_FIELD]: entry.rowId,
    }),
}

function amountOf(field: StoredField | undefined, name: string): Transaction['amount'] {
  if (field === undefined) {
    refuse(`no ${name}`)
  }
  return field.money ?? refuse(`the ${name} "${field.text}" is not a number`)
}

/** The statement parser's reasons, joined with `|` in one field. */
function reviewReasonsOf(field: StoredField | undefined): string[] {
  return textOf(field)
    .split('|')
    .map((reason) => reason.trim())
    .filter((reason) => reason !== '')
}

/**
 * The transactions of the ledger against these categories, each numbered in booking order, and why
 * the other rows were left out. A day whose balances do not chain is reported on the row the
 * guessed order closes it with. Rows that share their key still count, each with a problem, and so
 * does a row whose owner share cannot be read, which reads as none.
 */
export function readLedger(read: RecordsRead<LedgerEntry>, categories: readonly Category[]): Reading<Transaction> {
  const categoryBySlug = new Map(categories.map((category) => [category.slug, category]))
  const problems: RecordProblem[] = refusedProblems(read)
  const storedOf = new Map<Omit<Transaction, 'sequence'>, ReadRecord<LedgerEntry>>()
  const entries = read.records.map((stored) => {
    const share = ownerShareProblem(stored.fields.owner_share)
    if (share !== null) {
      problems.push(problemOf(stored, share))
    }
    const defined = categoryBySlug.get(stored.record.category)
    const entry: Omit<Transaction, 'sequence'> = { ...stored.record, family: defined?.family ?? UNCLASSIFIED, bucket: defined?.bucket ?? UNCLASSIFIED }
    storedOf.set(entry, stored)
    return entry
  })
  const shared = sharedKeys(entries, (entry) => entry.id)
  for (const entry of entries.filter((candidate) => shared.has(candidate.id))) {
    const same = entry.reference === '' ? 'the same account, day, amount, balance and description' : `the same account and reference ${entry.reference}`
    problems.push(problemOf(storedOf.get(entry)!, `another ledger row has ${same}, so the app cannot tell the two apart`))
  }
  const order = bookingOrder(entries)
  const sequenceOf = new Map(order.entries.map((entry, index) => [entry, index + 1]))
  for (const day of order.unchained) {
    problems.push(
      problemOf(
        storedOf.get(day.closing)!,
        `the balances of the ${day.account} rows of ${day.date} do not follow from one another, so they are ordered by reference and this row's balance closing the day is a guess`,
      ),
    )
  }
  return { facts: entries.map((entry): Transaction => ({ ...entry, sequence: sequenceOf.get(entry)! })), problems }
}
