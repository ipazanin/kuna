import { ZERO, addMoney, plainAmount } from '../../../shared/money/money'
import type { Money } from '../../../shared/money/money'
import { ownerShareProblem, ownerShareText, storedOwnerShare } from '../../owner-share/domain/ownerShare'
import type { OwnerShare } from '../../owner-share/domain/ownerShare'
import { dayText, labelWords, numberText, withIdField } from './recordCodec'
import type { RecordCodec } from './recordCodec'
import { amountText, filledFields } from './recordFields'
import type { RecordId } from './recordId'
import { SPLIT_PART_RECORDS } from './recordKind'
import { SHARED_ID_REASON, idSharing, problemOf } from './recordsRead'
import type { ReadRecord, Reading, RecordsRead } from './recordsRead'
import { holdsSplitKey, partOrder } from './splits'
import type { LedgerSplit, SplitKey, SplitPart } from './splits'
import { ownId, refusalOr, refuse, requiredDate, requiredMoney, slugOf, textOf } from './storedFields'
import type { StoredFields } from './storedFields'
import type { Category, RecordProblem, Transaction } from './workbook'

/** One record of the `splits` tab: the key of a ledger row and one part of it. */
export interface SplitTabRow {
  readonly key: SplitKey
  readonly amount: Money
  /** Blank when the field is. */
  readonly category: string
  readonly note: string
  readonly ownerShare: OwnerShare | null
  readonly id: RecordId
}

interface SplitsReading extends Reading<SplitTabRow> {
  /** Each split whose guards pass, in the order its first part comes, its parts larger first. */
  readonly splits: readonly LedgerSplit[]
}

interface SplitParts {
  readonly key: SplitKey
  readonly parts: ReadRecord<SplitTabRow>[]
  /** How many records with this key cannot be read as a part. */
  unreadable: number
}

export function splitPartOf(fields: StoredFields, id: RecordId | null): SplitTabRow {
  const key = splitKeyOf(fields)
  return { key, amount: requiredMoney(fields, 'amount'), category: slugOf(fields.category), note: textOf(fields.note), ownerShare: storedOwnerShare(fields.owner_share), id: ownId(id) }
}

export const SPLIT_PART_CODEC: RecordCodec<SplitTabRow> = withIdField(
  SPLIT_PART_RECORDS,
  (fields) => labelWords([textOf(fields.category), numberText(fields.amount), dayText(fields.date)]),
  splitPartOf,
  (part) =>
    filledFields({
      date: part.key.date,
      account: part.key.account,
      row_amount: amountText(part.key.rowAmount),
      row_balance: amountText(part.key.rowBalance),
      amount: amountText(part.amount),
      category: part.category,
      note: part.note,
      owner_share: ownerShareText(part.ownerShare),
    }),
)

function splitKeyOf(fields: StoredFields): SplitKey {
  const date = requiredDate(fields, 'date')
  const account = slugOf(fields.account)
  if (account === '') refuse('no account')
  return { date, account, rowAmount: requiredMoney(fields, 'row_amount'), rowBalance: requiredMoney(fields, 'row_balance') }
}

/**
 * The parts of split ledger rows. The parts that share a date, account, row amount and row balance
 * make one split of the ledger row those four find. A split is refused whole, each of its parts
 * reported, when the key finds no row or several, a part of it cannot be read, it has fewer than
 * two parts, a part is zero or has the other sign to the row, the parts do not add up to the row, a
 * part's category is not on the categories tab, or a part has no id or one another part holds. The
 * bank row then counts whole. A part whose owner share cannot be read is reported and counts with none.
 */
export function readSplits(read: RecordsRead<SplitTabRow>, transactions: readonly Transaction[], categories: readonly Category[]): SplitsReading {
  const problems: RecordProblem[] = []
  const groups = new Map<string, SplitParts>()
  const groupOf = (key: SplitKey): SplitParts => {
    const id = `${key.date}|${key.account}|${key.rowAmount}|${key.rowBalance}`
    const group = groups.get(id) ?? { key, parts: [], unreadable: 0 }
    groups.set(id, group)
    return group
  }
  for (const refused of read.refused) {
    problems.push(problemOf(refused, refused.reason))
    const key = refusalOr(() => splitKeyOf(refused.fields))
    if ('made' in key) {
      groupOf(key.made).unreadable += 1
    }
  }
  const sharesId = idSharing(read)
  for (const stored of read.records) {
    const share = ownerShareProblem(stored.fields.owner_share)
    if (share !== null) {
      problems.push(problemOf(stored, share))
    }
    if (sharesId(stored)) {
      problems.push(problemOf(stored, SHARED_ID_REASON))
      groupOf(stored.record.key).unreadable += 1
    } else {
      groupOf(stored.record.key).parts.push(stored)
    }
  }

  const categoryBySlug = new Map(categories.map((category) => [category.slug, category]))
  const facts: SplitTabRow[] = []
  const splits: LedgerSplit[] = []
  for (const group of groups.values()) {
    const found = transactions.filter((transaction) => holdsSplitKey(transaction, group.key))
    const reasons = [...rowReasons(group, found, transactions), ...partReasons(group, categoryBySlug)]
    if (reasons.length > 0) {
      const reason = `${reasons.join(', ')}, so the ledger row counts whole`
      problems.push(...group.parts.map((stored) => problemOf(stored, reason)))
      continue
    }
    facts.push(...group.parts.map((stored) => stored.record))
    splits.push({
      row: found[0]!,
      parts: group.parts
        .map(({ record: part }): SplitPart => {
          const category = categoryBySlug.get(part.category)!
          return { amount: part.amount, category: part.category, family: category.family, bucket: category.bucket, note: part.note, ownerShare: part.ownerShare, id: part.id }
        })
        .sort(partOrder),
    })
  }
  return { facts, problems, splits }
}

/** A split counts only on a ledger row that no other row shares its key with, since the split is kept by that key. */
function rowReasons(group: SplitParts, found: readonly Transaction[], transactions: readonly Transaction[]): string[] {
  const { key, unreadable } = group
  const row = `${key.account} row of ${key.date} with the amount ${plainAmount(key.rowAmount)} and the balance ${plainAmount(key.rowBalance)}`
  const sharing = found.length === 1 ? transactions.filter((transaction) => transaction.id === found[0]!.id).length : 0
  return [
    ...(found.length === 0 ? [`the ledger holds no ${row}`] : []),
    ...(found.length > 1 ? [`${found.length} ledger rows are the ${row}`] : []),
    ...(sharing > 1 ? [`the ${row} shares its key with another ledger row`] : []),
    ...(unreadable > 0 ? [`${unreadable === 1 ? 'a part' : `${unreadable} parts`} of this split cannot be read`] : []),
  ]
}

function partReasons(group: SplitParts, categoryBySlug: ReadonlyMap<string, Category>): string[] {
  const { key, parts } = group
  const reasons: string[] = []
  if (parts.length + group.unreadable < 2) {
    reasons.push('a split has at least two parts, and this one has one')
  }
  for (const stored of parts) {
    const part = stored.record
    const named = `the part "${stored.label}"`
    if (part.amount === 0) {
      reasons.push(`${named} is zero`)
    } else if (Math.sign(part.amount) !== Math.sign(key.rowAmount)) {
      reasons.push(`${named} has the other sign to the row`)
    }
    if (part.category === '') {
      reasons.push(`${named} has no category`)
    } else if (!categoryBySlug.has(part.category)) {
      reasons.push(`"${part.category}" of ${named} is not on the categories tab`)
    }
  }
  const total = parts.reduce((sum, stored) => addMoney(sum, stored.record.amount), ZERO)
  if (group.unreadable === 0 && parts.length >= 2 && total !== key.rowAmount) {
    reasons.push(`the parts add up to ${plainAmount(total)} and the row is ${plainAmount(key.rowAmount)}`)
  }
  return reasons
}
