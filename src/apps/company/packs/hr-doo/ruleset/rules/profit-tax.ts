// Corporate income tax: the PD return, its base, rate, advances and filing.

import type { ActId } from '../acts'
import { basisPoints, cents, count, day, flag, table, text } from '../schema'
import type { CountTerm, FlagTerm, LegalSource, MoneyTerm, OpenItem, RateTerm, RuleIn, TableTerm, TextTerm } from '../schema'

export interface ProfitTaxValues {
  'hr.cit.base': {
    readonly startsFrom: TextTerm
    readonly nonBusinessCostsAreCosts: FlagTerm
  }
  'hr.cit.pd-lines': {
    readonly formIssue: TextTerm
    readonly hasSponsorshipDecreaseLine: FlagTerm
  }
  'hr.cit.rate': {
    /** Revenue of the tax period at or above which the high rate applies. */
    readonly threshold: MoneyTerm
    readonly lowRate: RateTerm
    readonly highRate: RateTerm
  }
  'hr.cit.rate-test-revenue': {
    readonly specialCircumstanceGrantsExcluded: FlagTerm
    readonly ordinaryGrantsCounted: FlagTerm
  }
  'hr.cit.cash-basis-eligibility': {
    readonly priorRevenueLimit: MoneyTerm
    readonly statementWithinDays: CountTerm
    readonly vatOnCashBasisRequired: FlagTerm
    readonly minimumPeriods: CountTerm
  }
  'hr.cit.representation-add-back': {
    readonly addBackShare: RateTerm
    readonly includesVat: FlagTerm
  }
  'hr.cit.promo-item-limit': {
    readonly limitPerItemWithoutVat: MoneyTerm
  }
  'hr.cit.personal-transport-add-back': {
    readonly addBackShare: RateTerm
    readonly noAddBackWhenTaxedAsBenefit: FlagTerm
  }
  'hr.cit.depreciation-rates': {
    readonly groups: TableTerm<{
      readonly group: TextTerm
      readonly maximumRate: RateTerm
      readonly lifeYears: CountTerm
    }>
    readonly doublingAllowed: FlagTerm
  }
  'hr.cit.depreciation-start': {
    readonly startsInMonthAfterUse: FlagTerm
    readonly endsInMonthOfDisposal: FlagTerm
  }
  'hr.cit.asset-threshold': {
    readonly unitCostAbove: MoneyTerm
    readonly lifeOverYears: CountTerm
  }
  'hr.cit.car-depreciation-cap': {
    readonly costCapPerCar: MoneyTerm
  }
  'hr.cit.vessel-test': {
    readonly vesselRevenueShareOfCost: RateTerm
    readonly holidayHomeRevenueShareOfCost: RateTerm
    readonly rentalRegistrationRequired: FlagTerm
  }
  'hr.cit.fines-add-back': {
    readonly addBackShare: RateTerm
  }
  'hr.cit.donation-cap': {
    readonly capShareOfRevenue: RateTerm
    readonly revenueBasis: TextTerm
  }
  'hr.cit.sponsorship-decrease': {
    readonly available: FlagTerm
  }
  'hr.cit.private-cost-add-back': {
    readonly addBackShare: RateTerm
    readonly noAddBackWhenIncomeTaxPaid: FlagTerm
  }
  'hr.cit.grant-revenue': {
    readonly taxableWhenRecognised: FlagTerm
    readonly decreaseApplies: FlagTerm
  }
  'hr.cit.loss-carry-forward': {
    readonly carryForwardYears: CountTerm
    readonly oldestFirst: FlagTerm
    readonly carryBack: FlagTerm
  }
  'hr.cit.related-party-rate': {
    readonly rate: RateTerm
  }
  'hr.cit.related-party-scope': {
    readonly betweenResidentsRequiresLossOrPreferentialStatus: FlagTerm
  }
  'hr.cit.thin-cap': {
    readonly multipleOfMemberShare: CountTerm
    readonly memberShareThreshold: RateTerm
  }
  'hr.cit.related-party-report': {
    readonly reportForm: TextTerm
    readonly domesticEInvoicedTransactionsLeftOut: FlagTerm
  }
  'hr.cit.filing': {
    readonly monthsAfterPeriodEnd: CountTerm
    readonly electronicForAll: FlagTerm
  }
  'hr.cit.balance-due': {
    readonly dueOnFilingDeadline: FlagTerm
    readonly overpaymentRefundedOrCredited: FlagTerm
  }
  'hr.cit.monthly-advance': {
    readonly advancesInFirstPeriod: FlagTerm
    readonly liabilityDividedBy: TextTerm
    readonly firstAdvanceMonthAtNewAmount: TextTerm
    readonly paidMonthsAfterMonthCovered: CountTerm
  }
  'hr.cit.advance-change': {
    readonly byDecisionOnRequest: FlagTerm
    readonly bindingUntilNextReturn: FlagTerm
  }
  'hr.cit.profit-advance-shortfall': {
    readonly shortfallTaxedToRecipient: FlagTerm
  }
  'hr.cit.withholding': {
    /** Interest and fees for copyright and other intellectual property rights. */
    readonly standardRate: RateTerm
    readonly dividendRate: RateTerm
    readonly listedJurisdictionRate: RateTerm
  }
  'hr.cit.penalties': {
    readonly companyFineFrom: MoneyTerm
    readonly companyFineTo: MoneyTerm
    readonly responsiblePersonFineFrom: MoneyTerm
    readonly responsiblePersonFineTo: MoneyTerm
    readonly deductible: FlagTerm
  }
}

const LOADED_ON = day('2026-10-18')

const ZPD_ISSUES: readonly string[] = [
  '177/04', '90/05', '57/06', '146/08', '80/10', '22/12', '148/13', '143/14', '50/16',
  '115/16', '106/18', '121/19', '32/20', '138/20', '114/22', '114/23', '151/25',
]
const PRAV_PD_ISSUES: readonly string[] = ['95/05', '156/23', '16/25', '39/26']
const ZPDOH_ISSUES: readonly string[] = ['115/16', '106/18', '121/19', '32/20', '138/20', '151/22', '114/23', '152/24']

const ZPD_TEXT_URL = 'https://www.zakon.hr/z/99/zakon-o-porezu-na-dobit'
const PRAV_PD_TEXT_URL = 'https://www.zakon.hr/cms.htm?id=60061'
const ZPDOH_TEXT_URL = 'https://www.zakon.hr/z/85/zakon-o-porezu-na-dohodak'
const AMENDING_ACT_URLS = {
  '115/16': 'https://narodne-novine.nn.hr/clanci/sluzbeni/2016_12_115_2527.html',
  '114/23': 'https://narodne-novine.nn.hr/clanci/sluzbeni/2023_10_114_1613.html',
  '151/25': 'https://narodne-novine.nn.hr/clanci/sluzbeni/2025_12_151_2261.html',
  '156/23': 'https://narodne-novine.nn.hr/clanci/sluzbeni/2023_12_156_2396.html',
  '39/26': 'https://narodne-novine.nn.hr/clanci/sluzbeni/2026_04_39_469.html',
} as const

const ASSUMED_FOR_2027 = '2027 is assumed: no enacted change was found through NN 109/26.'
const ACCOUNTANT_FIGURES_MATCH = "The accountant's figures apply it and match."

function zpdSource(article: string, issues: readonly string[] = ZPD_ISSUES, quote?: string): LegalSource {
  return { act: 'ZPD', nn: issues, article, url: ZPD_TEXT_URL, loadedOn: LOADED_ON, ...(quote === undefined ? {} : { quote }) }
}

function pravPdSource(article: string): LegalSource {
  return { act: 'PravPD', nn: PRAV_PD_ISSUES, article, url: PRAV_PD_TEXT_URL, loadedOn: LOADED_ON }
}

function amendingActSource(act: ActId, issue: keyof typeof AMENDING_ACT_URLS, article: string): LegalSource {
  return { act, nn: [issue], article, ofAmendingAct: true, url: AMENDING_ACT_URLS[issue], loadedOn: LOADED_ON }
}

export const profitTaxRules: readonly RuleIn<ProfitTaxValues>[] = [
  {
    id: 'hr.cit.base',
    area: 'profit-tax',
    title: 'Tax base starts from accounting profit',
    appliesBy: 'tax-period',
    versions: [
      {
        validFrom: day('2025-01-01'),
        validTo: null,
        value: {
          startsFrom: text('accounting-profit'),
          nonBusinessCostsAreCosts: flag(false),
        },
        sources: [zpdSource('5(1), 5(6), 33(1)'), pravPdSource('9, 11, 47(3)')],
        confidence: 'confirmed-consolidated',
        note: `The base is revenue less expenses before tax, increased and decreased as the act says. Art. 33 is read as amended by NN 151/25. ${ASSUMED_FOR_2027}`,
      },
    ],
  },
  {
    id: 'hr.cit.pd-lines',
    area: 'profit-tax',
    title: 'PD return form and its lines',
    appliesBy: 'tax-period',
    versions: [
      {
        validFrom: day('2025-01-01'),
        validTo: day('2025-12-31'),
        value: {
          formIssue: text('156/23'),
          hasSponsorshipDecreaseLine: flag(false),
        },
        sources: [pravPdSource('47(3)'), amendingActSource('PravPD', '156/23', '20')],
        confidence: 'confirmed-nn',
        note: 'The form of NN 156/23 serves tax years 2024 and 2025.',
      },
      {
        validFrom: day('2026-01-01'),
        validTo: null,
        value: {
          formIssue: text('39/26'),
          hasSponsorshipDecreaseLine: flag(true),
        },
        sources: [pravPdSource('47(3)'), amendingActSource('PravPD', '39/26', '10, 11')],
        confidence: 'confirmed-nn',
        note: 'The form of NN 39/26 serves tax year 2026 onward. It keeps the line numbers and adds line 33.a for qualifying sponsorships. 2027 uses it unless a new form replaces it.',
      },
    ],
  },
  {
    id: 'hr.cit.rate',
    area: 'profit-tax',
    title: 'Corporate income tax rate',
    appliesBy: 'tax-period',
    versions: [
      {
        validFrom: day('2025-01-01'),
        validTo: null,
        value: {
          threshold: cents(100_000_000),
          lowRate: basisPoints(1000),
          highRate: basisPoints(1800),
        },
        sources: [zpdSource('28', ['115/16', '138/20', '114/22', '114/23']), amendingActSource('ZPD', '114/23', '8')],
        confidence: 'confirmed-consolidated',
        note: `Revenue of exactly 1,000,000.00 is taxed at 18%. The threshold has applied since tax year 2024. ${ASSUMED_FOR_2027}`,
      },
    ],
  },
  {
    id: 'hr.cit.rate-test-revenue',
    area: 'profit-tax',
    title: 'Revenue that is tested against the rate threshold',
    appliesBy: 'tax-period',
    versions: [
      {
        validFrom: day('2025-01-01'),
        validTo: null,
        value: {
          specialCircumstanceGrantsExcluded: flag(true),
          ordinaryGrantsCounted: flag(true),
        },
        sources: [zpdSource('6(6), 6(7)'), pravPdSource('9(7), 47(3) line 43')],
        confidence: 'reading',
        note: 'The test uses PD line 1 less line 28. Line 28 holds only grants for special circumstances, so an ordinary grant such as a self-employment grant counts toward the threshold. This is a reading of the closed list in Art. 6. ' + ASSUMED_FOR_2027,
      },
    ],
  },
  {
    id: 'hr.cit.cash-basis-eligibility',
    area: 'profit-tax',
    title: 'Cash-basis tax base (PD-NN) eligibility',
    appliesBy: 'tax-period',
    versions: [
      {
        validFrom: day('2025-01-01'),
        validTo: null,
        value: {
          priorRevenueLimit: cents(100_000_000),
          statementWithinDays: count(15),
          vatOnCashBasisRequired: flag(true),
          minimumPeriods: count(3),
        },
        sources: [zpdSource('5(7) to 5(14), 16(4)'), pravPdSource('11.b, 41(4), 46(1), 47.c')],
        confidence: 'confirmed-consolidated',
        note: `The limit is the revenue of the previous period, and the statement is due within 15 days of the start of the period. Used only when the company files the cash-basis return PD-NN. ${ASSUMED_FOR_2027}`,
      },
    ],
  },
  {
    id: 'hr.cit.representation-add-back',
    area: 'profit-tax',
    title: 'Representation costs added back',
    appliesBy: 'tax-period',
    versions: [
      {
        validFrom: day('2025-01-01'),
        validTo: null,
        value: {
          addBackShare: basisPoints(5000),
          includesVat: flag(true),
        },
        sources: [zpdSource('7(1)(3), 7(2)', ['115/16']), amendingActSource('ZPD', '115/16', '4'), pravPdSource('23')],
        confidence: 'confirmed-nn',
        note: `Half of representation costs including VAT is added back. No add-back applies when income tax was paid on the item. ${ASSUMED_FOR_2027}`,
      },
    ],
  },
  {
    id: 'hr.cit.promo-item-limit',
    area: 'profit-tax',
    title: 'Promotional item value that is not representation',
    appliesBy: 'tax-period',
    versions: [
      {
        validFrom: day('2025-01-01'),
        validTo: null,
        value: {
          limitPerItemWithoutVat: cents(2200),
        },
        sources: [zpdSource('7(6)', ['114/23']), amendingActSource('ZPD', '114/23', '4')],
        confidence: 'confirmed-nn',
        note: `A promotional item with the company name given to consumers is not representation when it is worth up to 22.00 without VAT. ${ASSUMED_FOR_2027}`,
      },
    ],
  },
  {
    id: 'hr.cit.personal-transport-add-back',
    area: 'profit-tax',
    title: 'Personal transport costs added back',
    appliesBy: 'tax-period',
    versions: [
      {
        validFrom: day('2025-01-01'),
        validTo: null,
        value: {
          addBackShare: basisPoints(5000),
          noAddBackWhenTaxedAsBenefit: flag(true),
        },
        sources: [zpdSource('7(1)(4), 7(2), 7(3)', ['115/16']), amendingActSource('ZPD', '115/16', '4, 15'), pravPdSource('25')],
        confidence: 'confirmed-nn',
        note: `The share has been 50% since 1 January 2018. The zakon.hr consolidated text still prints 30% with a remark that 50% applies after that date. Insurance, interest, vehicle tax and registration fees are left out of the base of the add-back. ${ASSUMED_FOR_2027}`,
      },
    ],
  },
  {
    id: 'hr.cit.depreciation-rates',
    area: 'profit-tax',
    title: 'Maximum depreciation rates by asset group',
    appliesBy: 'tax-period',
    versions: [
      {
        validFrom: day('2025-01-01'),
        validTo: null,
        value: {
          groups: table([
            { group: text('building'), maximumRate: basisPoints(500), lifeYears: count(20) },
            { group: text('car'), maximumRate: basisPoints(2000), lifeYears: count(5) },
            { group: text('equipment'), maximumRate: basisPoints(2500), lifeYears: count(4) },
            { group: text('computers'), maximumRate: basisPoints(5000), lifeYears: count(2) },
            { group: text('other'), maximumRate: basisPoints(1000), lifeYears: count(10) },
          ]),
          doublingAllowed: flag(true),
        },
        sources: [zpdSource('12(5), 12(6)', ['143/14', '114/22', '114/23'])],
        confidence: 'confirmed-consolidated',
        note: `Straight-line depreciation per asset, at no more than these rates, which may be doubled. Equipment covers intangible assets, machinery and vehicles other than cars. Computers cover hardware, software and phones. The group names match the assets tab. ${ASSUMED_FOR_2027}`,
      },
    ],
  },
  {
    id: 'hr.cit.depreciation-start',
    area: 'profit-tax',
    title: 'When depreciation starts and stops',
    appliesBy: 'tax-period',
    versions: [
      {
        validFrom: day('2025-01-01'),
        validTo: null,
        value: {
          startsInMonthAfterUse: flag(true),
          endsInMonthOfDisposal: flag(true),
        },
        sources: [zpdSource('12(8)')],
        confidence: 'confirmed-consolidated',
        note: `Depreciation starts on the first day of the month after the asset is put in use. ${ACCOUNTANT_FIGURES_MATCH} Depreciation running to the month of disposal is the usual reading and is not quoted from Art. 12(8). ${ASSUMED_FOR_2027}`,
      },
    ],
  },
  {
    id: 'hr.cit.asset-threshold',
    area: 'profit-tax',
    title: 'Long-term asset threshold',
    appliesBy: 'tax-period',
    versions: [
      {
        validFrom: day('2025-01-01'),
        validTo: null,
        value: {
          unitCostAbove: cents(66_500),
          lifeOverYears: count(1),
        },
        sources: [zpdSource('12(3)', ['114/23']), amendingActSource('ZPD', '114/23', '7')],
        confidence: 'confirmed-nn',
        note: `An item is a long-term asset when its unit cost is above 665.00 and its life is over one year. The threshold has applied since 1 January 2024. ${ASSUMED_FOR_2027}`,
      },
    ],
  },
  {
    id: 'hr.cit.car-depreciation-cap',
    area: 'profit-tax',
    title: 'Cost cap for depreciating a car',
    appliesBy: 'tax-period',
    versions: [
      {
        validFrom: day('2025-01-01'),
        validTo: null,
        value: {
          costCapPerCar: cents(5_400_000),
        },
        sources: [zpdSource('12(13)', ['114/23']), pravPdSource('22(3)')],
        confidence: 'confirmed-nn',
        note: `Depreciation counts only up to a cost of 54,000.00 per car, unless the car serves only a registered rental or transport activity. The 50% personal transport add-back then applies to what remains. ${ASSUMED_FOR_2027}`,
      },
    ],
  },
  {
    id: 'hr.cit.vessel-test',
    area: 'profit-tax',
    title: 'Revenue test for vessels, flats and holiday houses',
    appliesBy: 'tax-period',
    versions: [
      {
        validFrom: day('2025-01-01'),
        validTo: null,
        value: {
          vesselRevenueShareOfCost: basisPoints(700),
          holidayHomeRevenueShareOfCost: basisPoints(500),
          rentalRegistrationRequired: flag(true),
        },
        sources: [zpdSource('12(16) to 12(21)'), pravPdSource('22(7) to 22(11)')],
        confidence: 'confirmed-consolidated',
        note: `Depreciation and all related costs are added back unless the company is registered for rental and earns at least 7% of the asset's cost from it (5% for flats and holiday houses). A watch item only. ${ASSUMED_FOR_2027}`,
      },
    ],
  },
  {
    id: 'hr.cit.fines-add-back',
    area: 'profit-tax',
    title: 'Fines and forced-collection costs added back',
    appliesBy: 'tax-period',
    versions: [
      {
        validFrom: day('2025-01-01'),
        validTo: null,
        value: {
          addBackShare: basisPoints(10_000),
        },
        sources: [zpdSource('7(1)(6) to 7(1)(8)'), pravPdSource('27 to 29')],
        confidence: 'confirmed-consolidated',
        note: `Covers fines imposed by a competent body, the costs of forced collection and default interest between related persons. Late-payment interest charged by the tax authority is not on the list, so it is read as deductible. ${ASSUMED_FOR_2027}`,
      },
    ],
  },
  {
    id: 'hr.cit.donation-cap',
    area: 'profit-tax',
    title: 'Deductible donations',
    appliesBy: 'tax-period',
    versions: [
      {
        validFrom: day('2025-01-01'),
        validTo: null,
        value: {
          capShareOfRevenue: basisPoints(200),
          revenueBasis: text('prior-or-current-period'),
        },
        sources: [
          zpdSource('7(7) to 7(9), 7(1)(10)', ['114/23', '151/25']),
          amendingActSource('ZPD', '114/23', '4'),
          amendingActSource('ZPD', '151/25', '3'),
        ],
        confidence: 'confirmed-nn',
        note: `Donations up to 2% of the revenue of the previous or the current period are deductible. The excess, and any donation with a direct or indirect benefit to the company or a related person, is added back. ${ASSUMED_FOR_2027}`,
      },
    ],
  },
  {
    id: 'hr.cit.sponsorship-decrease',
    area: 'profit-tax',
    title: 'Base decrease for sponsorships',
    appliesBy: 'tax-period',
    versions: [
      {
        validFrom: day('2025-01-01'),
        validTo: day('2025-12-31'),
        value: {
          available: flag(false),
        },
        sources: [amendingActSource('ZPD', '151/25', '2')],
        confidence: 'confirmed-nn',
        note: 'The decrease was added by NN 151/25 and starts with tax year 2026.',
      },
      {
        validFrom: day('2026-01-01'),
        validTo: null,
        value: {
          available: flag(true),
        },
        sources: [zpdSource('6(1)(6), 6(8)', ['151/25']), amendingActSource('ZPD', '151/25', '2')],
        confidence: 'confirmed-nn',
        note: `The base is decreased by sponsorships made in Croatia for public-benefit purposes to subjects on a ministry list. It is PD line 33.a. ${ASSUMED_FOR_2027}`,
      },
    ],
  },
  {
    id: 'hr.cit.private-cost-add-back',
    area: 'profit-tax',
    title: 'Private and hidden-distribution costs added back',
    appliesBy: 'tax-period',
    versions: [
      {
        validFrom: day('2025-01-01'),
        validTo: null,
        value: {
          addBackShare: basisPoints(10_000),
          noAddBackWhenIncomeTaxPaid: flag(true),
        },
        sources: [zpdSource('5(6), 7(1)(12), 7(1)(13), 7(2), 7.a'), pravPdSource('26.a, 31')],
        confidence: 'confirmed-consolidated',
        note: `Costs not connected to the business are not costs. No add-back applies where income tax was calculated and paid, except for points 9 and 12 of Art. 7(1). The company keeps a record of costs paid for the private needs of natural persons. ${ASSUMED_FOR_2027}`,
      },
    ],
  },
  {
    id: 'hr.cit.grant-revenue',
    area: 'profit-tax',
    title: 'Tax treatment of an operating grant',
    appliesBy: 'tax-period',
    versions: [
      {
        validFrom: day('2025-01-01'),
        validTo: null,
        value: {
          taxableWhenRecognised: flag(true),
          decreaseApplies: flag(false),
        },
        sources: [zpdSource('5(1), 6(1)(5), 6(6), 6(7)'), pravPdSource('9(1), 9(7)')],
        confidence: 'reading',
        note: `The act has no exemption for a self-employment grant paid to a company, and the list of decreases in Art. 6 is closed. The grant is therefore revenue when accounting recognises it. No Porezna uprava opinion on a company was found. ${ACCOUNTANT_FIGURES_MATCH} ${ASSUMED_FOR_2027}`,
      },
    ],
  },
  {
    id: 'hr.cit.loss-carry-forward',
    area: 'profit-tax',
    title: 'Tax loss carry-forward',
    appliesBy: 'tax-period',
    versions: [
      {
        validFrom: day('2025-01-01'),
        validTo: null,
        value: {
          carryForwardYears: count(5),
          oldestFirst: flag(true),
          carryBack: flag(false),
        },
        sources: [zpdSource('17'), pravPdSource('38')],
        confidence: 'confirmed-consolidated',
        note: `Art. 17 has not been amended since 2004, so it was read in the consolidated text only. ${ASSUMED_FOR_2027}`,
      },
    ],
  },
  {
    id: 'hr.cit.related-party-rate',
    area: 'profit-tax',
    title: 'Interest rate on loans between related persons',
    appliesBy: 'tax-period',
    versions: [
      {
        validFrom: day('2025-01-01'),
        validTo: day('2025-12-31'),
        value: {
          rate: basisPoints(438),
        },
        sources: [
          zpdSource('14(3)', ['115/16']),
          pravPdSource('37(1)'),
          {
            act: 'OdlukaKamataPovezane2025',
            nn: ['151/24'],
            article: 'whole decision',
            url: 'https://narodne-novine.nn.hr/clanci/sluzbeni/2024_12_151_2486.html',
            loadedOn: LOADED_ON,
          },
        ],
        confidence: 'confirmed-nn',
        note: 'The decision text names the year 2024. A correction notice moved it to 2025, published 30 December 2024. Whether the correction is NN 153/24 or NN 154/24 is unconfirmed, and it was read only through secondary summaries.',
      },
      {
        validFrom: day('2026-01-01'),
        validTo: day('2026-12-31'),
        value: {
          rate: basisPoints(265),
        },
        sources: [
          zpdSource('14(3)', ['115/16']),
          pravPdSource('37(1)'),
          {
            act: 'OdlukaKamataPovezane2026',
            nn: ['150/25'],
            article: 'whole decision',
            url: 'https://narodne-novine.nn.hr/clanci/sluzbeni/2025_12_150_2236.html',
            loadedOn: LOADED_ON,
          },
        ],
        confidence: 'confirmed-nn',
        note: 'In force from 31 December 2025.',
      },
      {
        validFrom: day('2027-01-01'),
        validTo: day('2027-12-31'),
        value: {
          rate: basisPoints(240),
        },
        sources: [zpdSource('14(3)', ['115/16']), pravPdSource('37(1)')],
        confidence: 'estimate',
        note: 'A placeholder of about 2.40%, the simple mean of the ECB main refinancing rates of 2.15, 2.40 and 2.65 that applied in 2026. The published method is not reproducible from the text. Replace it with the 2027 Odluka, expected in NN in December 2026.',
      },
    ],
  },
  {
    id: 'hr.cit.related-party-scope',
    area: 'profit-tax',
    title: 'When the related-party interest rule reaches residents',
    appliesBy: 'tax-period',
    versions: [
      {
        validFrom: day('2025-01-01'),
        validTo: null,
        value: {
          betweenResidentsRequiresLossOrPreferentialStatus: flag(true),
        },
        sources: [zpdSource('13(5)', ['138/20', '151/25']), zpdSource('14(5)', ['115/16']), pravPdSource('37(3)')],
        confidence: 'confirmed-consolidated',
        note: `Between two residents the rule applies only when one of them has a preferential tax status or a tax loss to carry forward in that period. A loan between a company and its resident owner gives no corporate tax adjustment while the company has no tax loss. The cost of a cheap owner loan falls under the income tax benefit-in-kind rule instead. ${ASSUMED_FOR_2027}`,
      },
    ],
  },
  {
    id: 'hr.cit.thin-cap',
    area: 'profit-tax',
    title: 'Interest on a member loan above four times the share',
    appliesBy: 'tax-period',
    versions: [
      {
        validFrom: day('2025-01-01'),
        validTo: null,
        value: {
          multipleOfMemberShare: count(4),
          memberShareThreshold: basisPoints(2500),
        },
        sources: [zpdSource('8'), pravPdSource('32')],
        confidence: 'confirmed-consolidated',
        note: `Interest on a loan from a member holding 25% or more is not deductible to the extent the loan exceeds four times the member's share in capital. No add-back applies where income tax on capital income was paid on the interest. A watch item that matters only when a member lends to the company. ${ASSUMED_FOR_2027}`,
      },
    ],
  },
  {
    id: 'hr.cit.related-party-report',
    area: 'profit-tax',
    title: 'Related-party report attached to the PD',
    appliesBy: 'tax-period',
    versions: [
      {
        validFrom: day('2025-01-01'),
        validTo: day('2025-12-31'),
        value: {
          reportForm: text('PD-IPO'),
          domesticEInvoicedTransactionsLeftOut: flag(false),
        },
        sources: [pravPdSource('46(2), 47.b')],
        confidence: 'confirmed-nn',
        note: 'Attached when the books record transactions with related persons, such as loans and a lease. Whether a lease from a private landlord belongs in the report is a reading.',
      },
      {
        validFrom: day('2026-01-01'),
        validTo: null,
        value: {
          reportForm: text('PD-IPO'),
          domesticEInvoicedTransactionsLeftOut: flag(true),
        },
        sources: [pravPdSource('46(2), 47.b, 47.b(5)')],
        confidence: 'confirmed-nn',
        note: `From tax year 2026, domestic transactions shown in eRačun with related persons who are themselves fiscalised are left out of parts II.1 and II.2. A lease from a landlord who issues no eRačun stays in, which is a reading. ${ASSUMED_FOR_2027}`,
      },
    ],
  },
  {
    id: 'hr.cit.filing',
    area: 'profit-tax',
    title: 'Filing deadline and method for the PD return',
    appliesBy: 'tax-period',
    versions: [
      {
        validFrom: day('2025-01-01'),
        validTo: null,
        value: {
          monthsAfterPeriodEnd: count(4),
          electronicForAll: flag(true),
        },
        sources: [zpdSource('35(1), 35(3)', ['114/23', '151/25']), amendingActSource('ZPD', '151/25', '10'), pravPdSource('46')],
        confidence: 'confirmed-consolidated',
        note: `The return is due four months after the period ends, which is 30 April for a calendar year. Electronic filing for every taxpayer starts on 1 January 2026, so the 2025 return filed in 2026 already falls under it. That application is a reading. 30 April 2028 is a Sunday and whether the deadline then moves to the next working day is unconfirmed. ${ASSUMED_FOR_2027}`,
      },
    ],
  },
  {
    id: 'hr.cit.balance-due',
    area: 'profit-tax',
    title: 'Balance due or refund on the PD return',
    appliesBy: 'tax-period',
    versions: [
      {
        validFrom: day('2025-01-01'),
        validTo: null,
        value: {
          dueOnFilingDeadline: flag(true),
          overpaymentRefundedOrCredited: flag(true),
        },
        sources: [zpdSource('32(2), 35(2), 35(4), 35(5)', ['151/25']), pravPdSource('47(3) lines 53 to 58, 47(6)')],
        confidence: 'confirmed-consolidated',
        note: `The liability less the advances paid falls due on the last day of the filing deadline. An overpayment is refunded on request or credited to the next period. ${ASSUMED_FOR_2027}`,
      },
    ],
  },
  {
    id: 'hr.cit.monthly-advance',
    area: 'profit-tax',
    title: 'Monthly advance payments of the tax',
    appliesBy: 'tax-period',
    versions: [
      {
        validFrom: day('2025-01-01'),
        validTo: null,
        value: {
          advancesInFirstPeriod: flag(false),
          liabilityDividedBy: text('months-of-prior-period'),
          firstAdvanceMonthAtNewAmount: text('april'),
          paidMonthsAfterMonthCovered: count(1),
        },
        sources: [zpdSource('34(1), 34(3)', ['148/13', '115/16']), pravPdSource('47(3) line 59, 48(1), 48(9)')],
        confidence: 'confirmed-consolidated',
        note: `A company in its first tax period pays no advances. Each later advance is the prior liability divided by the months of operation of the prior period. The accountant's figures apply it and match, with the April advance the first at the new amount and due on 31 May. For 2027 the divisor is 12 once the prior period is a full year, and the April start is the likely reading but unconfirmed. ${ASSUMED_FOR_2027}`,
      },
    ],
  },
  {
    id: 'hr.cit.advance-change',
    area: 'profit-tax',
    title: 'Changing the advance by decision',
    appliesBy: 'tax-period',
    versions: [
      {
        validFrom: day('2025-01-01'),
        validTo: null,
        value: {
          byDecisionOnRequest: flag(true),
          bindingUntilNextReturn: flag(true),
        },
        sources: [zpdSource('34(2)'), pravPdSource('48(2), 48(5)')],
        confidence: 'confirmed-consolidated',
        note: `The tax office may change the advance on request or after an audit. A request for a lower advance states reasons and, after a significant drop in activity, attaches the balance sheet and income statement. ${ASSUMED_FOR_2027}`,
      },
    ],
  },
  {
    id: 'hr.cit.profit-advance-shortfall',
    area: 'profit-tax',
    title: 'Interim profit payout that the profit does not cover',
    appliesBy: 'tax-period',
    versions: [
      {
        validFrom: day('2025-01-01'),
        validTo: null,
        value: {
          shortfallTaxedToRecipient: flag(true),
        },
        sources: [
          zpdSource('10.a'),
          pravPdSource('35.a'),
          { act: 'ZPDoh', nn: ZPDOH_ISSUES, article: '66(2)', url: ZPDOH_TEXT_URL, loadedOn: LOADED_ON },
        ],
        confidence: 'confirmed-consolidated',
        note: `When a natural person receives an advance on profit and the profit of the period does not cover it, the difference is a receipt taxed under the income tax act. The company should pay advances only up to an interim income statement. ${ASSUMED_FOR_2027}`,
      },
    ],
  },
  {
    id: 'hr.cit.withholding',
    area: 'profit-tax',
    title: 'Withholding tax on payments to foreign legal persons',
    appliesBy: 'event-date',
    versions: [
      {
        validFrom: day('2025-01-01'),
        validTo: null,
        value: {
          standardRate: basisPoints(1500),
          dividendRate: basisPoints(1000),
          listedJurisdictionRate: basisPoints(2500),
        },
        sources: [zpdSource('31', ['148/13', '115/16', '106/18', '121/19', '138/20', '114/23'])],
        confidence: 'confirmed-consolidated',
        note: `Applies to interest, dividends, profit shares and fees for copyright and other intellectual property rights. Dividends and profit shares are taxed at 10% under Art. 31(7), the rest at 15% under Art. 31(6). The 25% rate applies to residents of jurisdictions on the EU list of non-cooperative jurisdictions without a tax treaty with Croatia. Treaties and EU directives can reduce or remove the tax. Whether software and SaaS subscriptions bought abroad are royalties in this sense is unconfirmed and a question for the accountant. ${ASSUMED_FOR_2027}`,
      },
    ],
  },
  {
    id: 'hr.cit.penalties',
    area: 'profit-tax',
    title: 'Fines for tax misdemeanours',
    appliesBy: 'event-date',
    versions: [
      {
        validFrom: day('2025-01-01'),
        validTo: null,
        value: {
          companyFineFrom: cents(26_000),
          companyFineTo: cents(2_654_000),
          responsiblePersonFineFrom: cents(26_000),
          responsiblePersonFineTo: cents(265_000),
          deductible: flag(false),
        },
        sources: [zpdSource('38', ['115/16', '114/22'])],
        confidence: 'confirmed-consolidated',
        note: `Shown as context only. Repeat offences carry higher fines under Art. 38(3). ${ASSUMED_FOR_2027}`,
      },
    ],
  },
]

export const profitTaxOpenItems: readonly OpenItem[] = [
  {
    id: 'hr.cit.excess-margin-2026',
    area: 'profit-tax',
    title: 'One-off tax on excess profit margins for 2026',
    status: 'unconfirmed',
    note: 'A draft amendment to the profit tax act, in consultation from 31 July to 30 August 2026 (e-Savjetovanja 10189). The draft text did not load. Secondary sources say it adds a one-off 50% tax on excessive margins of large and medium entrepreneurs for tax period 2026 and leaves rates, advances and add-backs alone. A micro or small company would be outside it. Recheck NN before the end of 2026.',
    url: 'https://porezna-uprava.gov.hr/hr/poziv-na-javno-savjetovanje-8833/8833',
  },
]
