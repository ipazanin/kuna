import type { DefinedBucket } from '../../workbook/domain/bucket'
import { PROFIT_AND_LOSS_LINES } from '../../workbook/domain/bucketTotals'
import type { ProfitAndLossLine } from '../../workbook/domain/bucketTotals'
import type { Transaction } from '../../workbook/domain/workbook'
import type { Settings } from './settings'

/** The profit and loss lines a single bucket makes up, in reading order. */
export const BUCKET_LINES = [
  { line: 'income', bucket: 'income' },
  { line: 'operating', bucket: 'operating' },
  { line: 'taxes', bucket: 'taxes' },
  { line: 'ownerPay', bucket: 'owner-pay' },
] as const satisfies readonly { readonly line: ProfitAndLossLine; readonly bucket: DefinedBucket }[]

export type BucketLine = (typeof BUCKET_LINES)[number]

const DERIVED_LINE_LABELS: Readonly<Record<'cost' | 'net' | 'ownerEarns', string>> = {
  cost: 'All costs',
  net: 'Net',
  ownerEarns: 'Owner earns',
}

export function lineLabel(settings: Settings, line: ProfitAndLossLine): string {
  const single = BUCKET_LINES.find((candidate) => candidate.line === line)
  return single === undefined ? DERIVED_LINE_LABELS[line as keyof typeof DERIVED_LINE_LABELS] : settings.bucketLabels[single.bucket]
}

/** Owner pay and owner earns exist only with the owner-pay module on. */
export function lineShown(settings: Settings, line: ProfitAndLossLine): boolean {
  return settings.ownerPayModule || (line !== 'ownerPay' && line !== 'ownerEarns')
}

export function shownLines(settings: Settings): ProfitAndLossLine[] {
  return PROFIT_AND_LOSS_LINES.filter((line) => lineShown(settings, line))
}

/** The bucket lines on screen: income, then each cost line shown. */
export function shownBucketLines(settings: Settings): BucketLine[] {
  return BUCKET_LINES.filter((entry) => lineShown(settings, entry.line))
}

/** "operating cost, taxes and owner pay", for running text about what the costs are. */
export function costLabelsInSentence(settings: Settings): string {
  const labels = shownBucketLines(settings)
    .filter((entry) => entry.line !== 'income')
    .map((entry) => inSentence(settings.bucketLabels[entry.bucket]))
  return labels.length <= 1 ? (labels[0] ?? '') : `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`
}

/** A label inside a sentence: "Operating cost" becomes "operating cost", while "VAT" stays "VAT". */
export function inSentence(label: string): string {
  const [first = '', second = ''] = label
  return second !== '' && second === second.toUpperCase() && second !== second.toLowerCase() ? label : first.toLowerCase() + label.slice(1)
}

/**
 * The rows as the screens count them. With the owner-pay module off there is no owner pay line,
 * so an owner-pay row counts as operating cost: costs and net stay what they are, and every cost
 * on screen still adds up to the total. The workbook itself keeps the row's bucket.
 */
export function presentedTransactions(transactions: readonly Transaction[], settings: Settings): readonly Transaction[] {
  if (settings.ownerPayModule) {
    return transactions
  }
  return transactions.map((transaction) => (transaction.bucket === 'owner-pay' ? { ...transaction, bucket: 'operating' } : transaction))
}
