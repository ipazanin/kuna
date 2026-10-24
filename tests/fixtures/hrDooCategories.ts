import type { Category, Transaction } from '../../src/features/workbook/domain/workbook'
import type { DefinedBucket } from '../../src/features/workbook/domain/bucket'
import { BUCKET_COLOUR } from '../../src/features/workbook/domain/categoryColour'

function category(slug: string, bucket: DefinedBucket, roles: readonly string[] = []): Category {
  return { slug, family: bucket, bucket, colour: BUCKET_COLOUR, roles, vat: 'none', ownerShare: null }
}

/** A d.o.o. category set with the pack's roles, tax refunds in the taxes bucket as the owner decided. */
export const PACK_CATEGORIES: readonly Category[] = [
  category('revenue', 'income', ['revenue']),
  category('grant-income', 'income'),
  category('payroll-contributions', 'taxes', ['watched', 'owner-pay-tax']),
  category('payroll-tax', 'taxes', ['owner-pay-tax']),
  category('corporate-income-tax', 'taxes'),
  category('dividend-tax', 'taxes', ['owner-pay-tax']),
  category('tax-refund', 'taxes'),
  category('salary-net', 'owner-pay'),
  category('dividend', 'owner-pay'),
  category('rent-owner', 'owner-pay', ['watched']),
  category('owner-loan-out', 'owner-pay', ['owner-loan-out']),
  category('owner-loan-repaid', 'owner-pay', ['owner-loan-repaid']),
  category('reimbursement-to-owner', 'financing', ['reimbursement']),
  category('reimbursement-from-owner', 'financing', ['reimbursement']),
  category('accounting', 'operating', ['watched']),
  category('travel', 'operating'),
  category('office-supplies', 'operating'),
]

/** The rows with family and bucket from these categories, as the workbook reader would give them. */
export function withPackBuckets(transactions: readonly Transaction[], categories: readonly Category[] = PACK_CATEGORIES): Transaction[] {
  return transactions.map((transaction) => {
    const defined = categories.find((candidate) => candidate.slug === transaction.category)
    return defined === undefined ? transaction : { ...transaction, family: defined.family, bucket: defined.bucket }
  })
}
