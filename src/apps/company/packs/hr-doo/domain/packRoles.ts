import type { DefinedBucket } from '../../../workbook/domain/bucket'
import type { Category } from '../../../workbook/domain/workbook'
import { RULESET_FIRST_DAY, ruleValue } from '../ruleset/ruleset'

/** The category roles the pack selects by, as the `roles` column of `categories` spells them. */
export const PACK_ROLES = {
  revenue: 'revenue',
  ownerLoanOut: 'owner-loan-out',
  ownerLoanRepaid: 'owner-loan-repaid',
  ownerPayTax: 'owner-pay-tax',
  /** Rent the company pays the owner, in the owner-pay bucket. The owner pays the rent tax on it. */
  ownerRent: 'owner-rent',
  reimbursement: 'reimbursement',
  watched: 'watched',
  /** Paid in the month after the work, such as salary, its taxes and rent. */
  arrears: 'arrears',
  /** An employee's net salary, with any tax-free payments paid in the same row. */
  salary: 'salary',
  representation: 'representation',
  personalTransport: 'personal-transport',
  /** A purchase kept as an asset on the assets tab. */
  capitalPurchase: 'capital-purchase',
  grant: 'grant',
  profitDistribution: 'profit-distribution',
  corporateIncomeTax: 'corporate-income-tax',
  /** VAT paid to the state or refunded by it. */
  vatSettlement: 'vat-settlement',
  /** Paid once for a year ahead, such as an annual insurance policy. */
  prepaidAnnual: 'prepaid-annual',
  /** A cost the corporate tax never allows, such as a fine or a private cost. */
  nonDeductible: 'non-deductible',
  /** An ordinary cost the corporate tax allows. */
  deductibleCost: 'deductible-cost',
  /** Operating income other than sales, such as interest on the company's account. */
  otherIncome: 'other-income',
  /** Money that never enters profit: transfers, bank loans, capital and reimbursements. */
  outsideProfit: 'outside-profit',
  /** Car insurance, car loan interest, vehicle tax and registration fees, which the personal transport add-back leaves out. */
  vehicleInsuranceInterestTaxAndFees: 'vehicle-insurance-interest-tax-and-fees',
} as const

export type PackRole = (typeof PACK_ROLES)[keyof typeof PACK_ROLES]

const TAX_FREE_ROLE = 'tax-free:'

/**
 * A role per tax-free payment of the ruleset, such as `tax-free:results-bonus`: the category holds
 * that payment to an employee, paid in a row of its own.
 */
export const TAX_FREE_ROLES: readonly string[] = [...new Set(ruleValue('hr.pit.nontaxable-caps', RULESET_FIRST_DAY).value.caps.rows.map((row) => `${TAX_FREE_ROLE}${row.payment.text}`))]

/** The ruleset's key of the tax-free payment the category holds, or null for a category with no such role. */
export function taxFreePaymentOf(category: Category): string | null {
  const role = category.roles.find((candidate) => TAX_FREE_ROLES.includes(candidate))
  return role === undefined ? null : paymentOfTaxFreeRole(role)
}

/** The ruleset's key of the payment a tax-free role names, such as `results-bonus` for `tax-free:results-bonus`. */
export function paymentOfTaxFreeRole(role: string): string {
  return role.slice(TAX_FREE_ROLE.length)
}

/** The taxes and contributions owed because an employee was paid, a dividend's tax left out. */
export function payrollTaxCategories(categories: readonly Category[]): string[] {
  return categories
    .filter((category) => category.bucket === 'taxes' && category.roles.includes(PACK_ROLES.ownerPayTax) && !category.roles.includes(PACK_ROLES.profitDistribution))
    .map((category) => category.slug)
}

/** The owner-pay categories that pay out profit to the owner, such as a dividend. Their tax sits in the taxes bucket. */
export function dividendCategories(categories: readonly Category[]): string[] {
  return categories.filter((category) => category.bucket === 'owner-pay' && category.roles.includes(PACK_ROLES.profitDistribution)).map((category) => category.slug)
}

/** The slugs of the categories that carry a role, in the order the tab lists them. */
export function categoriesWithRole(categories: readonly Category[], role: PackRole): string[] {
  return categories.filter((category) => category.roles.includes(role)).map((category) => category.slug)
}

/** The slugs of the categories in a bucket, in the order the tab lists them. */
export function categoriesInBucket(categories: readonly Category[], bucket: DefinedBucket): string[] {
  return categories.filter((category) => category.bucket === bucket).map((category) => category.slug)
}

/** A cost of paying the owner: the owner-pay bucket, and the taxes owed because the owner was paid. */
export function isOwnerPayCost(category: Category): boolean {
  return category.bucket === 'owner-pay' || (category.bucket === 'taxes' && category.roles.includes(PACK_ROLES.ownerPayTax))
}
