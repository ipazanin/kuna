import { OWNER_SHARE_ROLES } from '../../../../owner-share/domain/ownerShare'
import { RECEIVABLE_ROLES } from '../../../../receivables/domain/invoiceMatching'
import { classOf } from '../../../../settings/domain/categoryClasses'
import type { DefinedBucket } from '../../../../workbook/domain/bucket'
import { newerClassDismissed } from '../../../../workbook/domain/dismissals'
import type { Dismissal } from '../../../../workbook/domain/dismissals'
import type { StartingCategory } from '../../../../workbook/domain/packPart'
import type { VatTreatment } from '../../../../workbook/domain/vatTreatment'
import { PACK_ROLES } from '../../domain/packRoles'
import { CATEGORY_CLASSES } from './taxClassOf'

interface Family {
  readonly family: string
  readonly bucket: DefinedBucket
  readonly colour: string
  /**
   * Each with its class first and its modifiers after it, its VAT treatment, none when left out, and the class older
   * books gave it where new books give another.
   */
  readonly categories: readonly (readonly [slug: string, roles: readonly string[], vat?: VatTreatment, earlierClass?: string])[]
}

const FAMILIES: readonly Family[] = [
  {
    family: 'income',
    bucket: 'income',
    colour: '#d7f0e5',
    categories: [
      ['revenue', [PACK_ROLES.revenue]],
      ['grant-income', [PACK_ROLES.grant]],
      ['client-refund', [RECEIVABLE_ROLES.clientRefund]],
      ['other-income', [PACK_ROLES.otherIncome]],
      ['interest-income', [PACK_ROLES.interestIncome], 'none', PACK_ROLES.otherIncome],
    ],
  },
  {
    family: 'operating',
    bucket: 'operating',
    colour: '#dce9f9',
    categories: [
      ['software-subscriptions', [PACK_ROLES.deductibleCost], 'reverse-charge'],
      ['equipment', [PACK_ROLES.capitalPurchase], 'deductible-25'],
      ['contractors', [PACK_ROLES.deductibleCost], 'deductible-25'],
      ['accounting-and-legal', [PACK_ROLES.deductibleCost, PACK_ROLES.watched], 'deductible-25'],
      ['office-rent', [PACK_ROLES.deductibleCost, PACK_ROLES.arrears], 'deductible-25'],
      ['office-supplies', [PACK_ROLES.deductibleCost], 'deductible-25'],
      ['telecom', [PACK_ROLES.deductibleCost], 'deductible-25'],
      ['travel', [PACK_ROLES.deductibleCost, PACK_ROLES.otherCostsLine]],
      ['representation', [PACK_ROLES.representation], 'representation'],
      ['car-costs', [PACK_ROLES.personalTransport], 'car-50'],
      ['car-insurance-interest-tax-and-fees', [PACK_ROLES.vehicleInsuranceInterestTaxAndFees]],
      ['insurance', [PACK_ROLES.deductibleCost, PACK_ROLES.prepaidAnnual, PACK_ROLES.otherCostsLine]],
      ['training', [PACK_ROLES.deductibleCost, PACK_ROLES.otherCostsLine], 'deductible-25'],
      ['marketing', [PACK_ROLES.deductibleCost], 'deductible-25'],
      ['bank-fees', [PACK_ROLES.deductibleCost, PACK_ROLES.otherCostsLine]],
      ['fines', [PACK_ROLES.nonDeductible]],
      ['other-costs', [PACK_ROLES.deductibleCost]],
    ],
  },
  {
    family: 'taxes',
    bucket: 'taxes',
    colour: '#f9dcdc',
    categories: [
      ['vat', [PACK_ROLES.vatSettlement]],
      ['corporate-income-tax', [PACK_ROLES.corporateIncomeTax]],
      ['payroll-contributions', [PACK_ROLES.deductibleCost, PACK_ROLES.ownerPayTax, PACK_ROLES.watched, PACK_ROLES.arrears]],
      ['payroll-tax', [PACK_ROLES.deductibleCost, PACK_ROLES.ownerPayTax, PACK_ROLES.arrears]],
      ['dividend-tax', [PACK_ROLES.profitDistribution, PACK_ROLES.ownerPayTax]],
      ['local-fees', [PACK_ROLES.deductibleCost]],
    ],
  },
  {
    family: 'owner',
    bucket: 'owner-pay',
    colour: '#e4e1f6',
    categories: [
      ['salary-net', [PACK_ROLES.salary, PACK_ROLES.arrears]],
      ['dividend', [PACK_ROLES.profitDistribution]],
      ['rent-owner', [PACK_ROLES.ownerRent, PACK_ROLES.watched, PACK_ROLES.arrears]],
      ['benefits-from-company-costs', [OWNER_SHARE_ROLES.ownerBenefit]],
    ],
  },
  {
    family: 'financing',
    bucket: 'financing',
    colour: '#f6e1ee',
    categories: [
      ['owner-loan-out', [PACK_ROLES.ownerLoanOut]],
      ['owner-loan-repaid', [PACK_ROLES.ownerLoanRepaid]],
      ['loan-received', [PACK_ROLES.outsideProfit]],
      ['loan-repayment', [PACK_ROLES.outsideProfit]],
      ['reimbursement-to-owner', [PACK_ROLES.outsideProfit, PACK_ROLES.reimbursement]],
      ['reimbursement-from-owner', [PACK_ROLES.outsideProfit, PACK_ROLES.reimbursement]],
    ],
  },
  {
    family: 'neutral',
    bucket: 'neutral',
    colour: '#ececec',
    categories: [
      ['internal-transfer', [PACK_ROLES.outsideProfit]],
      ['share-capital', [PACK_ROLES.outsideProfit]],
    ],
  },
]

/** The categories new books of a Croatian d.o.o. start with, each with one tax class. The owner renames, splits and extends them, and picks the VAT rate a supplier charges. */
export const STARTING_CATEGORIES: readonly StartingCategory[] = FAMILIES.flatMap(({ family, bucket, colour, categories }) =>
  categories.map(([slug, roles, vat = 'none']) => ({ slug, family, bucket, colour, roles, vat })),
)

/** The class older books gave each starting category that new books give another, and the one new books give it, by the category's short name. */
const CLASS_CHANGES: ReadonlyMap<string, StartingClassChange> = new Map(
  FAMILIES.flatMap(({ categories }) => categories.flatMap(([slug, [newer], , earlier]) => (earlier === undefined || newer === undefined ? [] : [[slug, { from: earlier, to: newer }] as const]))),
)

/** The class a starting category counts by and the one new books give it. */
interface StartingClassChange {
  readonly from: string
  readonly to: string
}

/**
 * The change for a starting category that still counts by the class older books gave it, or null, and null too once the person
 * dismissed it. The figures count the class it carries, so the person picks the new one.
 */
export function startingClassChange(category: { readonly slug: string; readonly roles: readonly string[] }, dismissals: readonly Dismissal[]): StartingClassChange | null {
  const change = CLASS_CHANGES.get(category.slug)
  return change !== undefined && classOf(category.roles, CATEGORY_CLASSES)?.role === change.from && !newerClassDismissed(dismissals, category.slug) ? change : null
}
