import { OWNER_SHARE_ROLES } from '../../../../owner-share/domain/ownerShare'
import { RECEIVABLE_ROLES } from '../../../../receivables/domain/invoiceMatching'
import type { DefinedBucket } from '../../../../workbook/domain/bucket'
import type { VatTreatment } from '../../../../workbook/domain/vatTreatment'
import { PACK_ROLES, TAX_FREE_ROLES } from '../../domain/packRoles'
import type { PackRole } from '../../domain/packRoles'
import type { RuleId, RuleValues } from '../../ruleset/ruleset'
import type { RateTerm } from '../../ruleset/schema'

/** A rule whose value carries the share of a cost the profit tax adds back. */
export type AddBackRuleId = { readonly [Id in RuleId]: RuleValues[Id] extends { readonly addBackShare: RateTerm } ? Id : never }[RuleId]

/** The roles a category carries beside its class: when it is paid, what Kuna waits for, and whose cost or balance it counts in. */
type ModifierRole = typeof PACK_ROLES.arrears | typeof PACK_ROLES.prepaidAnnual | typeof PACK_ROLES.watched | typeof PACK_ROLES.ownerPayTax | typeof PACK_ROLES.reimbursement

/** The tax-free payments' class, one role per payment of the caps table. */
export const TAX_FREE_CLASS = 'tax-free:*'

/** A class is named by the role that carries it, the tax-free class by its pattern. */
export type TaxClassId = Exclude<PackRole, ModifierRole> | typeof RECEIVABLE_ROLES.clientRefund | typeof OWNER_SHARE_ROLES.ownerBenefit | typeof TAX_FREE_CLASS

/**
 * How Kuna counts a category for the Croatian profit tax and VAT. A category carries one class as
 * one of its roles. The rates stay in the ruleset, so a class names the rules it reads.
 */
export interface TaxClass {
  readonly id: TaxClassId
  /** The roles that carry the class. Every class has one, but the tax-free class has one per payment of the caps table. */
  readonly roles: readonly string[]
  /** The rules the class's figures come from. */
  readonly rules: readonly RuleId[]
  /** The rule whose share of the cost Kuna adds back to the tax base, or null when Kuna adds none back. */
  readonly addBack: AddBackRuleId | null
  /** The VAT treatments a category of the class may have. */
  readonly vat: readonly VatTreatment[]
  readonly buckets: readonly DefinedBucket[]
  /** The file and heading under docs/law that states the class. */
  readonly law: `company/${string}.md#${string}`
}

/** A class one role carries, named by that role. */
function carriedBy(role: Exclude<TaxClassId, typeof TAX_FREE_CLASS>, terms: Omit<TaxClass, 'id' | 'roles'>): TaxClass {
  return { id: role, roles: [role], ...terms }
}

const DEDUCTIBLE_VAT: readonly VatTreatment[] = ['deductible-25', 'deductible-13', 'deductible-5', 'reverse-charge', 'foreign-vat', 'none']

export const TAX_CLASSES: readonly TaxClass[] = [
  carriedBy(PACK_ROLES.revenue, {
    rules: ['hr.cit.base', 'hr.cit.rate-test-revenue', 'hr.acc.accrual-basis'],
    addBack: null,
    vat: ['none'],
    buckets: ['income'],
    law: 'company/tax-classes.md#revenue',
  }),
  carriedBy(RECEIVABLE_ROLES.clientRefund, {
    rules: ['hr.cit.base'],
    addBack: null,
    vat: ['none'],
    buckets: ['income'],
    law: 'company/tax-classes.md#client-refund',
  }),
  carriedBy(PACK_ROLES.grant, {
    rules: ['hr.acc.grant-recognition', 'hr.cit.grant-revenue'],
    addBack: null,
    vat: ['none'],
    buckets: ['income'],
    law: 'company/tax-classes.md#grant',
  }),
  carriedBy(PACK_ROLES.otherIncome, {
    rules: ['hr.cit.base'],
    addBack: null,
    vat: ['none'],
    buckets: ['income'],
    law: 'company/tax-classes.md#other-income',
  }),
  carriedBy(PACK_ROLES.deductibleCost, {
    rules: ['hr.cit.base', 'hr.vat.input-deduction', 'hr.vat.reverse-charge'],
    addBack: null,
    vat: DEDUCTIBLE_VAT,
    buckets: ['operating', 'taxes'],
    law: 'company/tax-classes.md#deductible-cost',
  }),
  carriedBy(PACK_ROLES.representation, {
    rules: ['hr.cit.representation-add-back', 'hr.vat.input-deduction'],
    addBack: 'hr.cit.representation-add-back',
    vat: ['representation'],
    buckets: ['operating'],
    law: 'company/tax-classes.md#representation',
  }),
  carriedBy(PACK_ROLES.personalTransport, {
    rules: ['hr.cit.personal-transport-add-back', 'hr.vat.input-deduction'],
    addBack: 'hr.cit.personal-transport-add-back',
    // A registration fee carries no VAT. It stays last, after the treatments a car's running costs carry.
    vat: ['car-50', 'foreign-vat', 'none'],
    buckets: ['operating'],
    law: 'company/tax-classes.md#personal-transport',
  }),
  carriedBy(PACK_ROLES.vehicleInsuranceAndInterest, {
    rules: ['hr.cit.personal-transport-add-back', 'hr.cit.base'],
    addBack: null,
    vat: ['none'],
    buckets: ['operating'],
    law: 'company/tax-classes.md#vehicle-insurance-and-interest',
  }),
  carriedBy(PACK_ROLES.nonDeductible, {
    rules: ['hr.cit.fines-add-back', 'hr.cit.private-cost-add-back'],
    addBack: 'hr.cit.private-cost-add-back',
    vat: ['none'],
    buckets: ['operating', 'taxes'],
    law: 'company/tax-classes.md#non-deductible',
  }),
  carriedBy(PACK_ROLES.capitalPurchase, {
    rules: ['hr.acc.capitalisation', 'hr.cit.asset-threshold'],
    addBack: null,
    vat: ['deductible-25', 'deductible-13', 'deductible-5', 'car-50', 'reverse-charge', 'foreign-vat', 'none'],
    buckets: ['operating'],
    law: 'company/tax-classes.md#capital-purchase',
  }),
  carriedBy(PACK_ROLES.corporateIncomeTax, {
    rules: ['hr.cit.balance-due', 'hr.cit.monthly-advance'],
    addBack: null,
    vat: ['none'],
    buckets: ['taxes'],
    law: 'company/tax-classes.md#corporate-income-tax',
  }),
  carriedBy(PACK_ROLES.vatSettlement, {
    rules: ['hr.vat.credit'],
    addBack: null,
    vat: ['none'],
    buckets: ['operating', 'taxes'],
    law: 'company/tax-classes.md#vat-settlement',
  }),
  carriedBy(PACK_ROLES.profitDistribution, {
    rules: ['hr.ztd.distributable-profit', 'hr.pit.dividend'],
    addBack: null,
    vat: ['none'],
    buckets: ['owner-pay', 'taxes'],
    law: 'company/tax-classes.md#profit-distribution',
  }),
  carriedBy(PACK_ROLES.salary, {
    rules: ['hr.contrib.rates', 'hr.pit.brackets'],
    addBack: null,
    vat: ['none'],
    buckets: ['owner-pay'],
    law: 'company/tax-classes.md#salary',
  }),
  {
    id: TAX_FREE_CLASS,
    roles: TAX_FREE_ROLES,
    rules: ['hr.pit.nontaxable-caps'],
    addBack: null,
    vat: ['none'],
    buckets: ['owner-pay'],
    law: 'company/tax-classes.md#tax-free-payments',
  },
  carriedBy(PACK_ROLES.ownerRent, {
    rules: ['hr.pit.rent'],
    addBack: null,
    vat: ['none'],
    buckets: ['owner-pay'],
    law: 'company/tax-classes.md#owner-rent',
  }),
  carriedBy(OWNER_SHARE_ROLES.ownerBenefit, {
    rules: ['hr.pit.hidden-distribution', 'hr.cit.private-cost-add-back'],
    addBack: null,
    vat: ['none'],
    buckets: ['owner-pay'],
    law: 'company/tax-classes.md#owner-benefit',
  }),
  carriedBy(PACK_ROLES.ownerLoanOut, {
    rules: ['hr.cit.related-party-rate', 'hr.pit.loan-benefit', 'hr.ztd.sole-member-deals'],
    addBack: null,
    vat: ['none'],
    buckets: ['owner-pay', 'financing'],
    law: 'company/tax-classes.md#owner-loan-out',
  }),
  carriedBy(PACK_ROLES.ownerLoanRepaid, {
    rules: ['hr.cit.related-party-rate'],
    addBack: null,
    vat: ['none'],
    buckets: ['owner-pay', 'financing'],
    law: 'company/tax-classes.md#owner-loan-repaid',
  }),
  carriedBy(PACK_ROLES.outsideProfit, {
    rules: ['hr.cit.base'],
    addBack: null,
    vat: ['none'],
    buckets: ['financing', 'neutral'],
    law: 'company/tax-classes.md#outside-profit',
  }),
]
