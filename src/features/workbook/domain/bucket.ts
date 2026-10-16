/**
 * The six buckets the `categories` tab may assign. Every profit and loss figure filters on bucket,
 * and `financing` and `neutral` never enter one.
 */
export const BUCKETS = ['income', 'operating', 'taxes', 'owner-pay', 'financing', 'neutral'] as const

export type DefinedBucket = (typeof BUCKETS)[number]

/** What a transaction carries when its category is missing from `categories` or only half defined. */
export const UNCLASSIFIED = 'unclassified'

export type Bucket = DefinedBucket | typeof UNCLASSIFIED

export const PROFIT_AND_LOSS_BUCKETS = ['income', 'operating', 'taxes', 'owner-pay'] as const satisfies readonly Bucket[]

export const COST_BUCKETS = ['operating', 'taxes', 'owner-pay'] as const satisfies readonly Bucket[]

export function isDefinedBucket(candidate: string): candidate is DefinedBucket {
  return (BUCKETS as readonly string[]).includes(candidate)
}

export function isBucket(candidate: string): candidate is Bucket {
  return candidate === UNCLASSIFIED || isDefinedBucket(candidate)
}
