import type { CivilDate } from '../../../../../../shared/calendar/civilDate'
import { formatMoney } from '../../../../../../shared/money/moneyFormat'
import { language } from '../../../../../../shared/text/language'
import { uncapitalised } from '../../../../../../shared/text/capitalised'
import { listInWords } from '../../../../../../shared/text/listInWords'
import type { CroatianForms, EnglishForms, Translation } from '../../../../../../shared/text/translation'
import { OWNER_SHARE_ROLES } from '../../../../owner-share/domain/ownerShare'
import { RECEIVABLE_ROLES } from '../../../../receivables/domain/invoiceMatching'
import { PACK_ROLES, paymentOfTaxFreeRole } from '../../domain/packRoles'
import { percentText } from '../../domain/payroll/payrollArithmetic'
import { RULESET_FIRST_DAY, ruleValue } from '../../ruleset/ruleset'
import { TAX_FREE_CLASS } from '../domain/taxClasses'
import type { TaxClass } from '../domain/taxClasses'

// A tax-free payment keeps its key as the ruleset's caps table names it, such as results-bonus.
// Croatian calls a class porezni tretman, since porezni razred reads as an income tax bracket.

export const en = {
  /** The name of each class in the categories editor, with the shares in force on the day. */
  classes: {
    revenue: 'Sales revenue',
    clientRefund: 'A refund of sales',
    grant: 'A grant, income as it is used',
    otherIncome: 'Other income',
    deductibleCost: 'A cost the profit tax allows',
    representation: (share: string) => `Representation: ${share} added back to the profit tax base, no VAT back`,
    personalTransport: (share: string, vatShare: string) => `Personal car costs: ${share} added back, ${vatShare} of the VAT back`,
    vehicleInsuranceAndInterest: 'Car insurance and loan interest: allowed, no VAT',
    nonDeductible: 'Fines and private costs: all added back',
    capitalPurchase: (threshold: string) => `An asset above ${threshold}, depreciated`,
    corporateIncomeTax: 'Profit tax paid or refunded, not a cost',
    vatSettlement: 'VAT paid or refunded, not a cost',
    profitDistribution: 'A profit payout or its tax, not a cost',
    salary: "An employee's net salary",
    taxFree: (payment: string) => `Tax-free payment: ${payment}`,
    ownerRent: 'Rent paid to the owner',
    ownerBenefit: "The owner's private share of company costs",
    ownerLoanOut: 'A loan to the owner',
    ownerLoanRepaid: 'The owner repaying a loan',
    outsideProfit: 'Outside profit: transfers, bank loans and capital',
  },
  countsAs: (name: string) => `Kuna counts this as ${uncapitalised(name)}.`,
  ruleLink: 'Rule on Tax rules',
  /** The lines of the categories that do not count one way yet. Names and treatments come as the screens show them. */
  toSort: {
    unclassedLabel: 'No tax class yet',
    unclassed: (names: readonly string[]): EnglishForms => ({
      one: `${listInWords(names)}. Pick one for it on Settings, Categories.`,
      other: `${listInWords(names)}. Pick one for each on Settings, Categories.`,
    }),
    classes: (classes: readonly string[]) => `It carries ${listInWords(classes.map((name) => `"${name}"`))}. Kuna counts a category one way, so keep one on Settings, Categories.`,
    vat: (taxClass: string, treatments: readonly string[], vat: string) =>
      `It carries "${taxClass}", which takes ${listInWords(treatments, 'or')}, and its VAT reads ${vat}. Change one of them on Settings, Categories.`,
    bucket: (taxClass: string, buckets: readonly string[], bucket: string) =>
      `It carries "${taxClass}", which sits in ${listInWords(buckets, 'or')}, and the category sits in ${bucket}. Change one of them on Settings, Categories.`,
  },
}

export const hr: Translation<typeof en> = {
  classes: {
    revenue: 'Prihod od prodaje',
    clientRefund: 'Povrat prodaje',
    grant: 'Potpora, u prihod kako se koristi',
    otherIncome: 'Ostali prihodi',
    deductibleCost: 'Trošak koji porez na dobit priznaje',
    representation: (share) => `Reprezentacija: ${share} se dodaje poreznoj osnovici, bez odbitka PDV-a`,
    personalTransport: (share, vatShare) => `Troškovi osobnog automobila: ${share} se dodaje osnovici, odbija se ${vatShare} PDV-a`,
    vehicleInsuranceAndInterest: 'Osiguranje i kamate za automobil: priznati, bez PDV-a',
    nonDeductible: 'Kazne i privatni troškovi: sve se dodaje osnovici',
    capitalPurchase: (threshold) => `Imovina iznad ${threshold}, amortizira se`,
    corporateIncomeTax: 'Plaćeni ili vraćeni porez na dobit, nije trošak',
    vatSettlement: 'Plaćeni ili vraćeni PDV, nije trošak',
    profitDistribution: 'Isplata dobiti ili porez na nju, nije trošak',
    salary: 'Neto plaća zaposlenika',
    taxFree: (payment) => `Neoporezivi primitak: ${payment}`,
    ownerRent: 'Najamnina plaćena vlasniku',
    ownerBenefit: 'Vlasnikov privatni dio troškova tvrtke',
    ownerLoanOut: 'Zajam vlasniku',
    ownerLoanRepaid: 'Vlasnik vraća zajam',
    outsideProfit: 'Izvan dobiti: prijenosi, bankovni zajmovi i kapital',
  },
  countsAs: (name) => `Kuna ovo broji kao ${uncapitalised(name)}.`,
  ruleLink: 'Pravilo u Poreznim pravilima',
  toSort: {
    unclassedLabel: 'Još bez poreznog tretmana',
    unclassed: (names): CroatianForms => ({
      one: `${listInWords(names)}. Odaberite ga u Postavkama, Kategorije.`,
      few: `${listInWords(names)}. Odaberite ga za svaku u Postavkama, Kategorije.`,
      other: `${listInWords(names)}. Odaberite ga za svaku u Postavkama, Kategorije.`,
    }),
    classes: (classes) => `Ima ${listInWords(classes.map((name) => `„${name}”`))}. Kuna kategoriju broji na jedan način, pa zadržite jedan u Postavkama, Kategorije.`,
    vat: (taxClass, treatments, vat) => `Ima porezni tretman „${taxClass}”, koji uzima ${listInWords(treatments, 'or')}, a PDV glasi ${vat}. Promijenite jedno od toga u Postavkama, Kategorije.`,
    bucket: (taxClass, buckets, bucket) =>
      `Ima porezni tretman „${taxClass}”, koji ide u skupinu ${listInWords(buckets, 'or')}, a kategorija je u skupini ${bucket}. Promijenite jedno od toga u Postavkama, Kategorije.`,
  },
}

export const words = language === 'hr' ? hr : en

/** A class's name as the editor offers it, for the role that carries it, with the law's shares in force on the day. A day before the ruleset starts reads its first day. */
export function classNameOf(taxClass: TaxClass, role: string, day: CivilDate): string {
  const on = day < RULESET_FIRST_DAY ? RULESET_FIRST_DAY : day
  const names = words.classes
  const addBackShare = (): string => percentText(ruleValue(taxClass.addBack!, on).value.addBackShare.basisPoints)
  switch (taxClass.id) {
    case PACK_ROLES.revenue:
      return names.revenue
    case RECEIVABLE_ROLES.clientRefund:
      return names.clientRefund
    case PACK_ROLES.grant:
      return names.grant
    case PACK_ROLES.otherIncome:
      return names.otherIncome
    case PACK_ROLES.deductibleCost:
      return names.deductibleCost
    case PACK_ROLES.representation:
      return names.representation(addBackShare())
    case PACK_ROLES.personalTransport:
      return names.personalTransport(addBackShare(), percentText(ruleValue('hr.vat.input-deduction', on).value.personalCarDeductibleShare.basisPoints))
    case PACK_ROLES.vehicleInsuranceAndInterest:
      return names.vehicleInsuranceAndInterest
    case PACK_ROLES.nonDeductible:
      return names.nonDeductible
    case PACK_ROLES.capitalPurchase:
      return names.capitalPurchase(formatMoney(ruleValue('hr.cit.asset-threshold', on).value.unitCostAbove.cents))
    case PACK_ROLES.corporateIncomeTax:
      return names.corporateIncomeTax
    case PACK_ROLES.vatSettlement:
      return names.vatSettlement
    case PACK_ROLES.profitDistribution:
      return names.profitDistribution
    case PACK_ROLES.salary:
      return names.salary
    case TAX_FREE_CLASS:
      return names.taxFree(paymentOfTaxFreeRole(role))
    case PACK_ROLES.ownerRent:
      return names.ownerRent
    case OWNER_SHARE_ROLES.ownerBenefit:
      return names.ownerBenefit
    case PACK_ROLES.ownerLoanOut:
      return names.ownerLoanOut
    case PACK_ROLES.ownerLoanRepaid:
      return names.ownerLoanRepaid
    case PACK_ROLES.outsideProfit:
      return names.outsideProfit
  }
}
