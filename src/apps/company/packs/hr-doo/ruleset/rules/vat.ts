// VAT: status, rates, place of supply, deduction, periods and deadlines.

import { basisPoints, cents, count, day, flag, text } from '../schema'
import type { CountTerm, FlagTerm, MoneyTerm, OpenItem, RateTerm, RuleIn, TextTerm } from '../schema'

export interface VatValues {
  'hr.vat.small-business-threshold': {
    /** Domestic turnover of the year, without VAT, above which a company is a VAT payer. */
    readonly domesticTurnoverThreshold: MoneyTerm
    readonly foreignBusinessServicesCount: FlagTerm
  }
  'hr.vat.voluntary-entry-binding': {
    readonly bindsCurrentYear: FlagTerm
    readonly bindsFollowingYears: CountTerm
  }
  'hr.vat.rates': {
    readonly standardRate: RateTerm
    readonly reducedRate: RateTerm
    readonly lowestRate: RateTerm
  }
  'hr.vat.place-of-supply-b2b': {
    readonly placeOfSupply: TextTerm
    readonly croatianVatOnServiceToForeignBusiness: FlagTerm
    readonly valueReportedOnReturn: FlagTerm
    readonly euRecapitulativeStatementForNonEuClient: FlagTerm
  }
  'hr.vat.input-deduction': {
    readonly deductibleOnBusinessPurchases: FlagTerm
    readonly deductibleForSuppliesMadeAbroad: FlagTerm
    readonly representationDeductible: FlagTerm
    readonly personalCarDeductibleShare: RateTerm
    readonly mixedUseDeductibleForBusinessShareOnly: FlagTerm
  }
  'hr.vat.reverse-charge': {
    readonly appliesToForeignBusinessServices: FlagTerm
    readonly outputAndInputOnSameReturn: FlagTerm
    readonly summaryStatementForEuSuppliers: FlagTerm
    readonly cashPrincipleAllowed: FlagTerm
  }
  'hr.vat.tax-point': {
    readonly defaultPrinciple: TextTerm
    /** Supplies of the previous year, without VAT, up to which the cash principle may be used. */
    readonly cashPrincipleSuppliesLimit: MoneyTerm
    readonly cashPrincipleBindingYears: CountTerm
    readonly cashPrincipleByStatement: FlagTerm
  }
  'hr.vat.deadlines': {
    readonly returnDue: TextTerm
    readonly summaryStatementDue: TextTerm
    readonly paymentDue: TextTerm
  }
  'hr.vat.period': {
    readonly standardPeriod: TextTerm
    /** Supplies of the previous year, with VAT, below which a quarterly period is open. */
    readonly quarterlySuppliesLimit: MoneyTerm
    readonly quarterlyExcludedWithEuTransactions: FlagTerm
  }
  'hr.vat.credit': {
    readonly refundOnRequest: FlagTerm
    readonly refundDueWithinDays: CountTerm
    readonly refundAfterAuditStartMaxDays: CountTerm
    readonly carryForwardAllowed: FlagTerm
  }
  'hr.vat.fx': {
    readonly rateSource: TextTerm
    readonly optionalRateSource: TextTerm
    readonly rateDate: TextTerm
  }
  'hr.vat.einvoicing': {
    readonly vatPayersIssueAndReceiveDomesticB2b: FlagTerm
    readonly buyerConsentNeeded: FlagTerm
  }
}

const LOADED_ON = day('2026-10-18')

const ZPDV_TEXT_URL = 'https://www.zakon.hr/z/1455/zakon-o-porezu-na-dodanu-vrijednost'
const ZPDV_NN_152_24_URL = 'https://narodne-novine.nn.hr/clanci/sluzbeni/2024_12_152_2508.html'
const ZPDV_NN_151_25_URL = 'https://narodne-novine.nn.hr/clanci/sluzbeni/2025_12_151_2262.html'
const ZPDV_CONSOLIDATED_ISSUES = ['73/13', '152/24', '52/25', '151/25', '32/26', '48/26']

export const vatRules: readonly RuleIn<VatValues>[] = [
  {
    id: 'hr.vat.small-business-threshold',
    area: 'vat',
    title: 'Small business VAT threshold',
    appliesBy: 'tax-period',
    versions: [
      {
        validFrom: day('2025-01-01'),
        validTo: null,
        value: {
          domesticTurnoverThreshold: cents(6_000_000),
          foreignBusinessServicesCount: flag(false),
        },
        sources: [
          {
            act: 'ZPDV',
            nn: ['152/24'],
            article: '90(1), 90(3)',
            url: ZPDV_NN_152_24_URL,
            loadedOn: LOADED_ON,
          },
        ],
        confidence: 'confirmed-nn',
        note: 'A domestic taxpayer at or below the threshold is exempt on domestic supplies and has no input VAT deduction. That foreign B2B services do not count towards the turnover is a reading of Art. 90(3)(a), since their place of supply is abroad. The amount applies from 1 January 2025. 2027 is assumed: no enacted change was found through NN 109/26.',
      },
    ],
  },
  {
    id: 'hr.vat.voluntary-entry-binding',
    area: 'vat',
    title: 'Binding period of voluntary VAT registration',
    appliesBy: 'event-date',
    versions: [
      {
        validFrom: day('2025-01-01'),
        validTo: null,
        value: {
          bindsCurrentYear: flag(true),
          bindsFollowingYears: count(1),
        },
        sources: [
          {
            act: 'ZPDV',
            nn: ['152/24'],
            article: '90.h',
            url: ZPDV_TEXT_URL,
            loadedOn: LOADED_ON,
          },
        ],
        confidence: 'confirmed-consolidated',
        note: 'A small taxpayer who asks for the regular regime is bound for the current and the next calendar year. Leaving ends the input VAT deduction, while VAT on services received from abroad stays payable. 2027 is assumed: no enacted change was found through NN 109/26.',
      },
    ],
  },
  {
    id: 'hr.vat.rates',
    area: 'vat',
    title: 'VAT rates',
    appliesBy: 'supply-date',
    versions: [
      {
        validFrom: day('2025-01-01'),
        validTo: null,
        value: {
          standardRate: basisPoints(2500),
          reducedRate: basisPoints(1300),
          lowestRate: basisPoints(500),
        },
        sources: [
          {
            act: 'ZPDV',
            nn: ['73/13', '99/13', '143/14', '115/16', '106/18', '121/19', '39/22', '113/22', '33/23', '35/24', '152/24', '52/25', '32/26'],
            article: '38(1) to 38(3)',
            url: ZPDV_TEXT_URL,
            loadedOn: LOADED_ON,
          },
        ],
        confidence: 'confirmed-consolidated',
        note: 'Art. 38(1) sets 25%, 38(2) the reduced 5% and 38(3) the reduced 13%. The NN issues are those the consolidated text lists for Art. 38. The amending acts for the rates were not loaded, so this is the consolidated reading. A temporary 5% on natural gas runs to 31 March 2027 under Art. 38(4) and does not matter for a services company. 2027 is assumed: no enacted change was found through NN 109/26.',
      },
    ],
  },
  {
    id: 'hr.vat.place-of-supply-b2b',
    area: 'vat',
    title: 'Place of supply of B2B services',
    appliesBy: 'supply-date',
    versions: [
      {
        validFrom: day('2025-01-01'),
        validTo: null,
        value: {
          placeOfSupply: text('recipient-establishment'),
          croatianVatOnServiceToForeignBusiness: flag(false),
          valueReportedOnReturn: flag(true),
          euRecapitulativeStatementForNonEuClient: flag(false),
        },
        sources: [
          {
            act: 'ZPDV',
            nn: ZPDV_CONSOLIDATED_ISSUES,
            article: '17(1), 85(1)',
            url: ZPDV_TEXT_URL,
            loadedOn: LOADED_ON,
          },
        ],
        confidence: 'confirmed-consolidated',
        note: 'A service to a business established abroad is supplied there, so it carries no Croatian VAT, but its value is still reported on the VAT return. A client outside the EU needs no recapitulative statement. Whether the invoice wording about Art. 17 satisfies Art. 79 is unconfirmed, and the accountant can settle it. 2027 is assumed: no enacted change was found through NN 109/26.',
      },
    ],
  },
  {
    id: 'hr.vat.input-deduction',
    area: 'vat',
    title: 'Input VAT deduction and its limits',
    appliesBy: 'tax-period',
    versions: [
      {
        validFrom: day('2025-01-01'),
        validTo: null,
        value: {
          deductibleOnBusinessPurchases: flag(true),
          deductibleForSuppliesMadeAbroad: flag(true),
          representationDeductible: flag(false),
          personalCarDeductibleShare: basisPoints(5000),
          mixedUseDeductibleForBusinessShareOnly: flag(true),
        },
        sources: [
          {
            act: 'ZPDV',
            nn: ['152/24'],
            article: '58(1), 58(5), 58(8)',
            url: ZPDV_NN_152_24_URL,
            loadedOn: LOADED_ON,
          },
          {
            act: 'ZPDV',
            nn: ZPDV_CONSOLIDATED_ISSUES,
            article: '57(1), 61(1) to 61(3)',
            url: ZPDV_TEXT_URL,
            loadedOn: LOADED_ON,
          },
        ],
        confidence: 'confirmed-nn',
        note: 'Art. 58(5) was read in NN 152/24 and Art. 61 only in the consolidated text. Input VAT is deductible on business purchases, also for supplies made abroad that would carry a deduction right in Croatia. That is why a company with only foreign sales has a structural VAT credit. There is no deduction on representation. Half of the VAT on personal cars and their running costs is deductible, with narrow exceptions. An asset also used privately gives a deduction for the business share only. The right arises when the VAT becomes chargeable. 2027 is assumed: no enacted change was found through NN 109/26.',
      },
    ],
  },
  {
    id: 'hr.vat.reverse-charge',
    area: 'vat',
    title: 'Reverse charge on services from abroad',
    appliesBy: 'tax-period',
    versions: [
      {
        validFrom: day('2025-01-01'),
        validTo: null,
        value: {
          appliesToForeignBusinessServices: flag(true),
          outputAndInputOnSameReturn: flag(true),
          summaryStatementForEuSuppliers: flag(true),
          cashPrincipleAllowed: flag(false),
        },
        sources: [
          {
            act: 'ZPDV',
            nn: ZPDV_CONSOLIDATED_ISSUES,
            article: '58(2), 75(1)(6), 76(4), 86, 125.j(d)',
            url: ZPDV_TEXT_URL,
            loadedOn: LOADED_ON,
          },
        ],
        confidence: 'confirmed-consolidated',
        note: "A registered Croatian recipient pays the VAT on a business service from a non-resident supplier, EU or not. The VAT is shown on the return and deducted on the same return, so the net cash effect is zero. Services from EU suppliers also go on the PDV-S form. VAT charged by a foreign supplier on its own country's rules stays a cost and is not deductible in Croatia. 2027 is assumed: no enacted change was found through NN 109/26.",
      },
    ],
  },
  {
    id: 'hr.vat.tax-point',
    area: 'vat',
    title: 'Tax point and the cash principle',
    appliesBy: 'supply-date',
    versions: [
      {
        validFrom: day('2025-01-01'),
        validTo: null,
        value: {
          defaultPrinciple: text('invoice'),
          cashPrincipleSuppliesLimit: cents(200_000_000),
          cashPrincipleBindingYears: count(3),
          cashPrincipleByStatement: flag(true),
        },
        sources: [
          {
            act: 'ZPDV',
            nn: ['152/24', '151/25'],
            article: '30, 125.i, 125.k',
            url: ZPDV_TEXT_URL,
            loadedOn: LOADED_ON,
          },
        ],
        confidence: 'confirmed-consolidated',
        note: 'VAT is chargeable when the supply is made, and a continuous service billed periodically is supplied at the end of each billing period. The cash principle needs a written statement by the end of the year, applies from 1 January and binds for three years. The NN issue that set the 2,000,000.00 limit was not loaded. Which principle a company uses is a workbook setting. 2027 is assumed: no enacted change was found through NN 109/26.',
      },
    ],
  },
  {
    id: 'hr.vat.deadlines',
    area: 'vat',
    title: 'VAT return, PDV-S and payment deadlines',
    appliesBy: 'tax-period',
    versions: [
      {
        validFrom: day('2025-01-01'),
        validTo: day('2025-12-31'),
        value: {
          returnDue: text('20th-of-following-month'),
          summaryStatementDue: text('20th-of-following-month'),
          paymentDue: text('last-day-of-following-month'),
        },
        sources: [
          {
            act: 'ZPDV',
            nn: ['73/13', '152/24'],
            article: '76(1), 85(6), 86(2)',
            url: ZPDV_TEXT_URL,
            loadedOn: LOADED_ON,
          },
          {
            act: 'ZPDV',
            nn: ['151/25'],
            article: '10',
            ofAmendingAct: true,
            url: ZPDV_NN_151_25_URL,
            loadedOn: LOADED_ON,
          },
        ],
        confidence: 'confirmed-nn',
        note: 'Applies to VAT periods up to and including December 2025. The returns for the last 2025 period are filed under these old deadlines.',
      },
      {
        validFrom: day('2026-01-01'),
        validTo: null,
        value: {
          returnDue: text('last-day-of-following-month'),
          summaryStatementDue: text('last-day-of-following-month'),
          paymentDue: text('last-day-of-following-month'),
        },
        sources: [
          {
            act: 'ZPDV',
            nn: ['151/25'],
            article: '76(1), 85(6), 86(2)',
            url: ZPDV_NN_151_25_URL,
            loadedOn: LOADED_ON,
          },
          {
            act: 'ZPDV',
            nn: ['151/25'],
            article: '4, 5, 10',
            ofAmendingAct: true,
            url: ZPDV_NN_151_25_URL,
            loadedOn: LOADED_ON,
          },
        ],
        confidence: 'confirmed-nn',
        note: 'Applies to VAT periods from January 2026, in force from 1 January 2026. 2027 is assumed: no enacted change was found through NN 109/26.',
      },
    ],
  },
  {
    id: 'hr.vat.period',
    area: 'vat',
    title: 'VAT tax period',
    appliesBy: 'tax-period',
    versions: [
      {
        validFrom: day('2025-01-01'),
        validTo: null,
        value: {
          standardPeriod: text('month'),
          quarterlySuppliesLimit: cents(11_000_000),
          quarterlyExcludedWithEuTransactions: flag(true),
        },
        sources: [
          {
            act: 'ZPDV',
            nn: ZPDV_CONSOLIDATED_ISSUES,
            article: '84(1) to 84(3)',
            url: ZPDV_TEXT_URL,
            loadedOn: LOADED_ON,
          },
        ],
        confidence: 'confirmed-consolidated',
        note: 'The period is the calendar month. A quarterly period is open below the limit and not to a taxpayer with transactions within the EU. That receiving services from EU suppliers counts as such a transaction is a reading, since the definition in the Pravilnik was not loaded. The NN issue that set the 110,000.00 limit was not loaded either. 2027 is assumed: no enacted change was found through NN 109/26.',
      },
    ],
  },
  {
    id: 'hr.vat.credit',
    area: 'vat',
    title: 'VAT credit: refund or carry forward',
    appliesBy: 'tax-period',
    versions: [
      {
        validFrom: day('2025-01-01'),
        validTo: null,
        value: {
          refundOnRequest: flag(true),
          refundDueWithinDays: count(30),
          refundAfterAuditStartMaxDays: count(90),
          carryForwardAllowed: flag(true),
        },
        sources: [
          {
            act: 'ZPDV',
            nn: ZPDV_CONSOLIDATED_ISSUES,
            article: '66(1), 66(2)',
            url: ZPDV_TEXT_URL,
            loadedOn: LOADED_ON,
          },
        ],
        confidence: 'confirmed-consolidated',
        note: 'When input VAT exceeds output VAT the taxpayer may ask for a refund or carry the credit forward. A requested refund is due within 30 days of the return. No legal minimum refund amount was found in the act, so any minimum an accountant applies is practice. A secondary source warns that carrying a credit forward without ever asking for a refund may let the limitation period run, and that is not checked against the general tax act. A refund settles a receivable and is not a lower tax cost. 2027 is assumed: no enacted change was found through NN 109/26.',
      },
    ],
  },
  {
    id: 'hr.vat.fx',
    area: 'vat',
    title: 'Foreign currency on VAT',
    appliesBy: 'supply-date',
    versions: [
      {
        validFrom: day('2025-01-01'),
        validTo: null,
        value: {
          rateSource: text('hnb-middle-rate'),
          optionalRateSource: text('ecb-rate'),
          rateDate: text('chargeable-date'),
        },
        sources: [
          {
            act: 'ZPDV',
            nn: ZPDV_CONSOLIDATED_ISSUES,
            article: '36(2), 36(3)',
            url: ZPDV_TEXT_URL,
            loadedOn: LOADED_ON,
          },
        ],
        confidence: 'confirmed-consolidated',
        note: 'An amount in a foreign currency converts at the HNB middle rate on the day the VAT becomes chargeable, or optionally at the ECB rate. This matters for subscriptions priced in a foreign currency under reverse charge. 2027 is assumed: no enacted change was found through NN 109/26.',
      },
    ],
  },
  {
    id: 'hr.vat.einvoicing',
    area: 'vat',
    title: 'eRačun for domestic B2B invoices',
    appliesBy: 'supply-date',
    versions: [
      {
        validFrom: day('2026-01-01'),
        validTo: null,
        value: {
          vatPayersIssueAndReceiveDomesticB2b: flag(true),
          buyerConsentNeeded: flag(false),
        },
        sources: [
          {
            act: 'ZPDV',
            nn: ZPDV_CONSOLIDATED_ISSUES,
            article: '80(2)',
            url: ZPDV_TEXT_URL,
            loadedOn: LOADED_ON,
          },
          {
            act: 'ZPDV',
            nn: ['151/25'],
            article: '3',
            ofAmendingAct: true,
            url: ZPDV_NN_151_25_URL,
            loadedOn: LOADED_ON,
          },
        ],
        confidence: 'unconfirmed',
        note: 'From 1 January 2026 every VAT payer issues and receives eRačun for domestic transactions between Croatian taxpayers and fiscalises them. Non-VAT payers must receive from 2026 and issue from 1 January 2027. Invoices to buyers abroad may stay on paper or another accepted format. The dates come from the Porezna uprava guide to Fiskalizacija 2.0, which is not a source here. The Zakon o fiskalizaciji itself was never loaded. Information only until the Zakon o fiskalizaciji and its NN issue are loaded.',
      },
    ],
  },
]

export const vatOpenItems: readonly OpenItem[] = []
