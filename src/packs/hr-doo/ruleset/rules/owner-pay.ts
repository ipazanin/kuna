// Owner pay: personal income tax, contributions and the minimum wage.

import { ACTS } from '../acts'
import { basisPoints, cents, count, day, flag, table, text } from '../schema'
import type {
  CountTerm,
  FlagTerm,
  LegalSource,
  MoneyTerm,
  OpenItem,
  RateTerm,
  RuleIn,
  TableTerm,
  TextTerm,
} from '../schema'

export interface OwnerPayValues {
  'hr.contrib.average-wage': {
    /** Average monthly gross wage of January to August of the previous year, published by the statistics office. */
    readonly monthlyAmount: MoneyTerm
  }
  'hr.contrib.director-floor': {
    readonly coefficient: RateTerm
    readonly monthlyFloor: MoneyTerm
  }
  'hr.contrib.board-only-base': {
    readonly coefficient: RateTerm
    readonly monthlyBase: MoneyTerm
  }
  'hr.contrib.insurance-basis': {
    readonly employedByCompanyBasis: TextTerm
    readonly boardMemberOnlyBasis: TextTerm
    readonly insuredElsewhereBasis: TextTerm
  }
  'hr.contrib.rates': {
    readonly pillarOneRateWithPillarTwo: RateTerm
    readonly pillarOneRateWithoutPillarTwo: RateTerm
    readonly pillarTwoRate: RateTerm
    /** Paid by the employer on top of the gross. */
    readonly healthRate: RateTerm
  }
  'hr.contrib.max-base': {
    readonly coefficient: RateTerm
    readonly monthlyMaximum: MoneyTerm
    readonly annualMaximum: MoneyTerm
  }
  'hr.contrib.low-pay-relief': {
    /** Gross up to this amount gets the full reduction. */
    readonly fullReductionGrossLimit: MoneyTerm
    readonly fullReduction: MoneyTerm
    /** Gross above the full limit and up to this amount gets a share of the gap. */
    readonly partialReductionGrossLimit: MoneyTerm
    /** The share of the gap between the gross and the partial limit that is deducted. */
    readonly partialReductionShare: RateTerm
    readonly reducedContribution: TextTerm
  }
  'hr.contrib.minimum-base': {
    readonly coefficient: RateTerm
    readonly monthlyBase: MoneyTerm
  }
  'hr.contrib.due-dates': {
    readonly dueOn: TextTerm
    readonly dueIfUnpaid: TextTerm
    readonly joppdCodeDirectorAtMinimumBase: TextTerm
    readonly joppdCodeDirectorUnpaid: TextTerm
  }
  'hr.pit.allowance': {
    readonly basicMonthlyAllowance: MoneyTerm
    /** Multiples of the basic allowance for the first, second and further dependent family members or children. */
    readonly dependantCoefficients: TableTerm<{ readonly position: CountTerm; readonly coefficient: RateTerm }>
    readonly disabilityCoefficient: RateTerm
    readonly fullDisabilityCoefficient: RateTerm
  }
  'hr.pit.brackets': {
    readonly monthlyThreshold: MoneyTerm
    readonly annualThreshold: MoneyTerm
  }
  'hr.pit.local-rate-ranges': {
    readonly defaultLowerRate: RateTerm
    readonly defaultHigherRate: RateTerm
    readonly ranges: TableTerm<{
      readonly unitType: TextTerm
      readonly lowerRateFrom: RateTerm
      readonly lowerRateTo: RateTerm
      readonly higherRateFrom: RateTerm
      readonly higherRateTo: RateTerm
    }>
  }
  'hr.pit.local-rates': {
    readonly cityRates: TableTerm<{ readonly city: TextTerm; readonly lowerRate: RateTerm; readonly higherRate: RateTerm }>
  }
  'hr.pit.monthly-advance': {
    readonly baseDeductsPensionContributions: FlagTerm
    readonly baseDeductsPersonalAllowance: FlagTerm
    readonly youthReliefApplies: FlagTerm
    readonly thresholdPeriod: TextTerm
  }
  'hr.pit.annual-settlement': {
    readonly allowanceMonths: CountTerm
    readonly thresholdPeriod: TextTerm
    readonly unusedAllowanceUsed: FlagTerm
  }
  'hr.pit.youth-relief': {
    readonly appliedIn: TextTerm
    /** A band without `bornTo` is open: everyone born in `bornFrom` or later. */
    readonly bands: TableTerm<{ readonly reliefShare: RateTerm; readonly bornFrom: CountTerm; readonly bornTo?: CountTerm }>
  }
  'hr.pit.nontaxable-caps': {
    /** Keyed by the item number of the Pravilnik, Art. 7(2). A row without `cap` is paid at actual cost or by another rule. */
    readonly caps: TableTerm<{
      readonly item: CountTerm
      readonly payment: TextTerm
      readonly period: TextTerm
      readonly cap?: MoneyTerm
      readonly monthlyCap?: MoneyTerm
    }>
  }
  'hr.pit.foreign-per-diem': {
    readonly perDiems: TableTerm<{ readonly country: TextTerm; readonly fullDay: MoneyTerm; readonly halfDayShare: RateTerm }>
  }
  'hr.pit.loan-benefit': {
    /** A loan to an employee below this yearly interest rate gives a benefit in kind of the difference. */
    readonly minimumInterestRate: RateTerm
  }
  'hr.pit.rent': {
    readonly flatExpenseShare: RateTerm
    readonly taxRate: RateTerm
    readonly withheldByPayer: FlagTerm
    readonly dueOn: TextTerm
  }
  'hr.pit.dividend': {
    readonly rate: RateTerm
    readonly withheldAtPayout: FlagTerm
    readonly personalAllowanceApplies: FlagTerm
    readonly contributionsApply: FlagTerm
  }
  'hr.pit.hidden-distribution': {
    readonly withholdingRate: RateTerm
    readonly withheldBy: TextTerm
    readonly costDeductibleForCompany: FlagTerm
  }
  'hr.minwage': {
    readonly monthlyGrossAmount: MoneyTerm
    readonly appliesToSoleWorkerWhoIsDirector: FlagTerm
  }
}

const LOADED_ON = day('2026-10-18')

const ZDOP_URL = 'https://www.zakon.hr/z/365/Zakon-o-doprinosima'
const ZPDOH_URL = 'https://www.zakon.hr/z/85/zakon-o-porezu-na-dohodak'
const ZPD_URL = 'https://www.zakon.hr/z/99/zakon-o-porezu-na-dobit'
const ZMP_URL = 'https://www.zakon.hr/z/400/zakon-o-minimalnoj-placi'
const NN_152_24_URL = 'https://narodne-novine.nn.hr/clanci/sluzbeni/2024_12_152_2505.html'
const NN_16_25_URL = 'https://narodne-novine.nn.hr/eli/sluzbeni/2025/16/pdf'
const NN_16_25_PRAVILNIK_URL = 'https://narodne-novine.nn.hr/clanci/sluzbeni/2025_01_16_148.html'

function zdopSource(article: string, issues: readonly string[] = ACTS.ZDop.nn, quote?: string): LegalSource {
  return { act: 'ZDop', nn: issues, article, url: ZDOP_URL, loadedOn: LOADED_ON, ...(quote === undefined ? {} : { quote }) }
}

const directorFloorSource = zdopSource(
  '21(2)',
  ['115/16', '106/18'],
  'ne može biti niža od umnoška iznosa prosječne plaće i koeficijenta 0,65',
)

const contributionRateSources: readonly LegalSource[] = [
  zdopSource('13(1)', ['148/13', '115/16', '106/18']),
  zdopSource('14(1)(1)', ['148/13', '41/14', '115/16', '106/18', '33/23']),
  zdopSource('17(1)', ['115/16']),
]

function zpdohSource(article: string): LegalSource {
  return { act: 'ZPDoh', nn: ACTS.ZPDoh.nn, article, url: ZPDOH_URL, loadedOn: LOADED_ON }
}

function naredbaSource(year: 2025 | 2026, article: string): LegalSource {
  return year === 2025
    ? { act: 'Naredba2025', nn: ['137/24', '25/25'], article, url: 'https://www.zakon.hr/cms.htm?id=540573', loadedOn: LOADED_ON }
    : {
        act: 'Naredba2026',
        nn: ['150/25'],
        article,
        url: 'https://narodne-novine.nn.hr/clanci/sluzbeni/2025_12_150_2237.html',
        loadedOn: LOADED_ON,
      }
}

const AVERAGE_WAGE_ESTIMATE_NOTE =
  'An estimated 2027 average wage of 2,175.00, the midpoint of 2,160 to 2,190 from the statistics office release of 21 August 2026 (January to June 2026 averaged 2,163, July and August were not found).'

const NAREDBA_2027_NOTE = 'Replace with the 2027 Naredba, expected in the Narodne novine in December 2026.'

const allowanceSources: readonly LegalSource[] = [
  { act: 'ZPDoh', nn: ['152/24'], article: '14(1), 14(3)', url: ZPDOH_URL, loadedOn: LOADED_ON },
  { act: 'ZPDoh', nn: ['152/24'], article: '2', ofAmendingAct: true, url: NN_152_24_URL, loadedOn: LOADED_ON },
]

const bracketSources: readonly LegalSource[] = [
  { act: 'ZPDoh', nn: ['152/24'], article: '19, 24(3)', url: ZPDOH_URL, loadedOn: LOADED_ON },
  { act: 'ZPDoh', nn: ['152/24'], article: '3, 5', ofAmendingAct: true, url: NN_152_24_URL, loadedOn: LOADED_ON },
]

const youthReliefSources: readonly LegalSource[] = [
  zpdohSource('46(2)'),
  { act: 'PravPDoh', nn: ['16/25'], article: '58(6)', url: NN_16_25_PRAVILNIK_URL, loadedOn: LOADED_ON },
  { act: 'PravPDoh', nn: ['16/25'], article: '5', ofAmendingAct: true, url: NN_16_25_PRAVILNIK_URL, loadedOn: LOADED_ON },
]

const nontaxableCapSources: readonly LegalSource[] = [
  zpdohSource('9(1)(9), 9(2)'),
  { act: 'PravPDoh', nn: ['16/25'], article: '7(2), 7(3)', url: NN_16_25_PRAVILNIK_URL, loadedOn: LOADED_ON },
  { act: 'PravPDoh', nn: ['16/25'], article: '2', ofAmendingAct: true, url: NN_16_25_PRAVILNIK_URL, loadedOn: LOADED_ON },
]

const splitDecisionTransitionalSource: LegalSource = {
  act: 'ZPDoh',
  nn: ['152/24'],
  article: '14',
  ofAmendingAct: true,
  url: NN_152_24_URL,
  loadedOn: LOADED_ON,
}

const splitDecision2025Source: LegalSource = {
  act: 'OdlukaSplit',
  nn: ['35/25'],
  article: '1',
  ofAmendingAct: true,
  url: 'https://narodne-novine.nn.hr/clanci/sluzbeni/2025_02_35_434.html',
  loadedOn: LOADED_ON,
}

const minimumWageActSources: readonly LegalSource[] = [
  { act: 'ZMP', nn: ['120/21'], article: '4(2)', url: ZMP_URL, loadedOn: LOADED_ON },
  { act: 'ZMP', nn: ACTS.ZMP.nn, article: '5, 6(2)', url: ZMP_URL, loadedOn: LOADED_ON },
]

export const ownerPayRules: readonly RuleIn<OwnerPayValues>[] = [
  {
    id: 'hr.contrib.average-wage',
    area: 'owner-pay',
    title: 'Average wage behind the contribution bases',
    appliesBy: 'month-worked',
    versions: [
      {
        validFrom: day('2025-01-01'),
        validTo: day('2025-12-31'),
        value: { monthlyAmount: cents(179_800) },
        sources: [zdopSource('7 item 39'), naredbaSource(2025, '2')],
        confidence: 'confirmed-consolidated',
        note: 'Read in the zakon.hr consolidated text of the Naredba. The NN 137/24 page itself was not loaded.',
      },
      {
        validFrom: day('2026-01-01'),
        validTo: day('2026-12-31'),
        value: { monthlyAmount: cents(199_300) },
        sources: [zdopSource('7 item 39'), naredbaSource(2026, '2')],
        confidence: 'confirmed-nn',
      },
      {
        validFrom: day('2027-01-01'),
        validTo: day('2027-12-31'),
        value: { monthlyAmount: cents(217_500) },
        sources: [zdopSource('7 item 39')],
        confidence: 'estimate',
        note: `${AVERAGE_WAGE_ESTIMATE_NOTE} ${NAREDBA_2027_NOTE}`,
      },
    ],
  },
  {
    id: 'hr.contrib.director-floor',
    area: 'owner-pay',
    title: 'Contribution base floor for an employed director',
    appliesBy: 'month-worked',
    versions: [
      {
        validFrom: day('2025-01-01'),
        validTo: day('2025-12-31'),
        value: { coefficient: basisPoints(6500), monthlyFloor: cents(116_870) },
        sources: [
          directorFloorSource,
          naredbaSource(2025, '19(1)'),
        ],
        confidence: 'confirmed-consolidated',
        note: 'A part month is prorated by working days. The accountant\'s figures apply it and match.',
      },
      {
        validFrom: day('2026-01-01'),
        validTo: day('2026-12-31'),
        value: { coefficient: basisPoints(6500), monthlyFloor: cents(129_545) },
        sources: [
          directorFloorSource,
          naredbaSource(2026, '19(1)'),
        ],
        confidence: 'confirmed-nn',
        note: 'A part month is prorated by working days. The accountant\'s figures apply it and match.',
      },
      {
        validFrom: day('2027-01-01'),
        validTo: day('2027-12-31'),
        value: { coefficient: basisPoints(6500), monthlyFloor: cents(141_375) },
        sources: [directorFloorSource],
        confidence: 'estimate',
        note: '0.65 of an estimated 2027 average wage of 2,175.00, the midpoint of 2,160 to 2,190 from the statistics office release of 21 August 2026. The plan gives 1,405 to 1,425. Replace with the 2027 Naredba, expected in the Narodne novine in December 2026.',
      },
    ],
  },
  {
    id: 'hr.contrib.board-only-base',
    area: 'owner-pay',
    title: 'Contribution base of a board member who is not employed',
    appliesBy: 'month-worked',
    versions: [
      {
        validFrom: day('2025-01-01'),
        validTo: day('2025-12-31'),
        value: { coefficient: basisPoints(10_000), monthlyBase: cents(179_800) },
        sources: [zdopSource('90 to 93, 187.c to 187.g'), naredbaSource(2025, '7 item 6')],
        confidence: 'confirmed-consolidated',
        note: 'The person pays these contributions personally, set by a tax office decision. Whether the company bears any of the cost is unconfirmed, because only a secondary source says it does not.',
      },
      {
        validFrom: day('2026-01-01'),
        validTo: day('2026-12-31'),
        value: { coefficient: basisPoints(10_000), monthlyBase: cents(199_300) },
        sources: [zdopSource('90 to 93, 187.c to 187.g'), naredbaSource(2026, '7 item 6')],
        confidence: 'confirmed-nn',
        note: 'The person pays these contributions personally, set by a tax office decision. The act is read in the consolidated text. Whether the company bears any of the cost is unconfirmed, because only a secondary source says it does not.',
      },
      {
        validFrom: day('2027-01-01'),
        validTo: day('2027-12-31'),
        value: { coefficient: basisPoints(10_000), monthlyBase: cents(217_500) },
        sources: [zdopSource('90 to 93, 187.c to 187.g')],
        confidence: 'estimate',
        note: `1.0 of the estimated 2027 average wage. ${AVERAGE_WAGE_ESTIMATE_NOTE} ${NAREDBA_2027_NOTE}`,
      },
    ],
  },
  {
    id: 'hr.contrib.insurance-basis',
    area: 'owner-pay',
    title: 'Which insurance basis applies to a director',
    appliesBy: 'month-worked',
    versions: [
      {
        validFrom: day('2025-01-01'),
        validTo: null,
        value: {
          employedByCompanyBasis: text('employee'),
          boardMemberOnlyBasis: text('own-contributions-on-average-wage'),
          insuredElsewhereBasis: text('annual-difference'),
        },
        sources: [
          {
            act: 'ZOMO',
            nn: ['96/25'],
            article: '16',
            url: 'https://www.zakon.hr/z/91/Zakon-o-mirovinskom-osiguranju',
            loadedOn: LOADED_ON,
            quote: 'ako nisu obvezno osigurani po drugoj osnovi',
          },
          zdopSource('9(1)(15), 90 to 94'),
        ],
        confidence: 'confirmed-consolidated',
        note: 'A director employed by the company is insured as an employee. One who is not insured anywhere else is insured as a board member on own contributions. One insured elsewhere owes only the annual difference to the director floor. The ZOMO issue 96/25 is unconfirmed against the Narodne novine, and the Zakon o doprinosima still cites this rule as Art. 12 of the older text. 2027 is assumed, with no enacted change found through NN 109/26.',
      },
    ],
  },
  {
    id: 'hr.contrib.rates',
    area: 'owner-pay',
    title: 'Contribution rates on salary',
    appliesBy: 'month-worked',
    versions: [
      {
        validFrom: day('2025-01-01'),
        validTo: day('2026-12-31'),
        value: {
          pillarOneRateWithPillarTwo: basisPoints(1500),
          pillarOneRateWithoutPillarTwo: basisPoints(2000),
          pillarTwoRate: basisPoints(500),
          healthRate: basisPoints(1650),
        },
        sources: contributionRateSources,
        confidence: 'confirmed-consolidated',
        note: 'Pension is withheld from the gross and health is paid by the employer on top. A director insured as a board member only pays the same rates under Art. 91. The accountant\'s figures apply these rates and match.',
      },
      {
        validFrom: day('2027-01-01'),
        validTo: null,
        value: {
          pillarOneRateWithPillarTwo: basisPoints(1500),
          pillarOneRateWithoutPillarTwo: basisPoints(2000),
          pillarTwoRate: basisPoints(500),
          healthRate: basisPoints(1650),
        },
        sources: contributionRateSources,
        confidence: 'pending',
        note: 'The 2027 contributions draft 10198 on e-Savjetovanja was not loaded. A secondary summary says it changes only the base coefficients of flat-rate taxpayers. Recheck when the act is published in the Narodne novine.',
      },
    ],
  },
  {
    id: 'hr.contrib.max-base',
    area: 'owner-pay',
    title: 'Maximum contribution base for pension',
    appliesBy: 'month-worked',
    versions: [
      {
        validFrom: day('2025-01-01'),
        validTo: day('2025-12-31'),
        value: { coefficient: basisPoints(60_000), monthlyMaximum: cents(1_078_800), annualMaximum: cents(12_945_600) },
        sources: [zdopSource('7 item 18, 204 to 208'), naredbaSource(2025, '4, 5')],
        confidence: 'confirmed-consolidated',
        note: 'Health contributions have no cap in the definitions that were read.',
      },
      {
        validFrom: day('2026-01-01'),
        validTo: day('2026-12-31'),
        value: { coefficient: basisPoints(60_000), monthlyMaximum: cents(1_195_800), annualMaximum: cents(14_349_600) },
        sources: [zdopSource('7 item 18, 204 to 208'), naredbaSource(2026, '4, 5')],
        confidence: 'confirmed-nn',
        note: 'Health contributions have no cap in the definitions that were read.',
      },
      {
        validFrom: day('2027-01-01'),
        validTo: day('2027-12-31'),
        value: { coefficient: basisPoints(60_000), monthlyMaximum: cents(1_305_000), annualMaximum: cents(15_660_000) },
        sources: [zdopSource('7 item 18, 204 to 208')],
        confidence: 'estimate',
        note: `6.0 of the estimated 2027 average wage. ${AVERAGE_WAGE_ESTIMATE_NOTE} ${NAREDBA_2027_NOTE}`,
      },
    ],
  },
  {
    id: 'hr.contrib.low-pay-relief',
    area: 'owner-pay',
    title: 'Low-pay reduction of the pension contribution base',
    appliesBy: 'month-worked',
    versions: [
      {
        validFrom: day('2025-01-01'),
        validTo: day('2026-12-31'),
        value: {
          fullReductionGrossLimit: cents(70_000),
          fullReduction: cents(30_000),
          partialReductionGrossLimit: cents(130_000),
          partialReductionShare: basisPoints(5000),
          reducedContribution: text('pension-pillar-one'),
        },
        sources: [
          zdopSource('21.a', ['114/23']),
          { act: 'PravDop', nn: ['143/23'], article: '4', ofAmendingAct: true, url: 'https://narodne-novine.nn.hr/clanci/sluzbeni/2023_12_143_1957.html', loadedOn: LOADED_ON },
        ],
        confidence: 'confirmed-consolidated',
        note: 'Gross up to 700.00 reduces the base by 300.00. Gross from 700.01 to 1,300.00 reduces it by half of the gap to 1,300.00. The act says only "doprinos za mirovinsko osiguranje" and names no pillar, so applying it to pillar I only is practice, not statute. The accountant\'s figures apply it that way and match. Pension rights are computed on the unreduced base.',
      },
      {
        validFrom: day('2027-01-01'),
        validTo: null,
        value: {
          fullReductionGrossLimit: cents(70_000),
          fullReduction: cents(30_000),
          partialReductionGrossLimit: cents(130_000),
          partialReductionShare: basisPoints(5000),
          reducedContribution: text('pension-pillar-one'),
        },
        sources: [zdopSource('21.a', ['114/23'])],
        confidence: 'pending',
        note: 'The thresholds could change with the 2027 contributions draft 10198, which was not loaded. The 2027 director floor is expected above 1,300.00, so the reduction would fall to zero for a director at the floor. Recheck when the act is published in the Narodne novine.',
      },
    ],
  },
  {
    id: 'hr.contrib.minimum-base',
    area: 'owner-pay',
    title: 'Lowest monthly contribution base',
    appliesBy: 'month-worked',
    versions: [
      {
        validFrom: day('2025-01-01'),
        validTo: day('2025-12-31'),
        value: { coefficient: basisPoints(3800), monthlyBase: cents(68_324) },
        sources: [naredbaSource(2025, '3')],
        confidence: 'confirmed-consolidated',
        note: 'Reference only.',
      },
      {
        validFrom: day('2026-01-01'),
        validTo: day('2026-12-31'),
        value: { coefficient: basisPoints(3800), monthlyBase: cents(75_734) },
        sources: [naredbaSource(2026, '3')],
        confidence: 'confirmed-nn',
        note: 'Reference only.',
      },
      {
        validFrom: day('2027-01-01'),
        validTo: day('2027-12-31'),
        value: { coefficient: basisPoints(3800), monthlyBase: cents(82_650) },
        sources: [naredbaSource(2026, '3')],
        confidence: 'estimate',
        note: `0.38 of the estimated 2027 average wage. ${AVERAGE_WAGE_ESTIMATE_NOTE} The 2026 Naredba is cited for the coefficient only. ${NAREDBA_2027_NOTE}`,
      },
    ],
  },
  {
    id: 'hr.contrib.due-dates',
    area: 'owner-pay',
    title: 'Due date of contributions on salary',
    appliesBy: 'payment-date',
    versions: [
      {
        validFrom: day('2025-01-01'),
        validTo: null,
        value: {
          dueOn: text('payday'),
          dueIfUnpaid: text('last-day-of-following-month'),
          joppdCodeDirectorAtMinimumBase: text('0005'),
          joppdCodeDirectorUnpaid: text('0006'),
        },
        sources: [
          zdopSource('24(1), 24(2)'),
          { act: 'PravPDoh', nn: ['16/25'], article: 'JOPPD annex', url: NN_16_25_URL, loadedOn: LOADED_ON },
        ],
        confidence: 'confirmed-consolidated',
        note: 'The JOPPD codes were read in the NN 16/25 issue. 2027 is assumed, with no enacted change found through NN 109/26.',
      },
    ],
  },
  {
    id: 'hr.pit.allowance',
    area: 'owner-pay',
    title: 'Personal allowance',
    appliesBy: 'payment-date',
    versions: [
      {
        validFrom: day('2025-01-01'),
        validTo: day('2026-12-31'),
        value: {
          basicMonthlyAllowance: cents(60_000),
          dependantCoefficients: table([
            { position: count(1), coefficient: basisPoints(5000) },
            { position: count(2), coefficient: basisPoints(7000) },
            { position: count(3), coefficient: basisPoints(10_000) },
            { position: count(4), coefficient: basisPoints(14_000) },
            { position: count(5), coefficient: basisPoints(19_000) },
          ]),
          disabilityCoefficient: basisPoints(3000),
          fullDisabilityCoefficient: basisPoints(10_000),
        },
        sources: allowanceSources,
        confidence: 'confirmed-nn',
        note: 'The basic allowance rose from 560.00 to 600.00 on 1 January 2025. The coefficients continue for further children, and only the first five were transcribed.',
      },
      {
        validFrom: day('2027-01-01'),
        validTo: null,
        value: {
          basicMonthlyAllowance: cents(60_000),
          dependantCoefficients: table([
            { position: count(1), coefficient: basisPoints(5000) },
            { position: count(2), coefficient: basisPoints(7000) },
            { position: count(3), coefficient: basisPoints(10_000) },
            { position: count(4), coefficient: basisPoints(14_000) },
            { position: count(5), coefficient: basisPoints(19_000) },
          ]),
          disabilityCoefficient: basisPoints(3000),
          fullDisabilityCoefficient: basisPoints(10_000),
        },
        sources: allowanceSources,
        confidence: 'pending',
        note: 'The income tax bill PZ 339 leaves Art. 14 alone, so the same values are expected. It is not enacted. Recheck in the Narodne novine in December 2026.',
      },
    ],
  },
  {
    id: 'hr.pit.brackets',
    area: 'owner-pay',
    title: 'Income tax brackets',
    appliesBy: 'payment-date',
    versions: [
      {
        validFrom: day('2025-01-01'),
        validTo: day('2026-12-31'),
        value: { monthlyThreshold: cents(500_000), annualThreshold: cents(6_000_000) },
        sources: bracketSources,
        confidence: 'confirmed-nn',
        note: 'The lower rate applies up to the threshold and the higher rate to the excess. Monthly advances use the monthly threshold and the annual settlement uses the annual one. NN 152/24 raised them from 4,200.00 and 50,400.00.',
      },
      {
        validFrom: day('2027-01-01'),
        validTo: null,
        value: { monthlyThreshold: cents(500_000), annualThreshold: cents(6_000_000) },
        sources: bracketSources,
        confidence: 'pending',
        note: 'The income tax bill PZ 339 does not change Art. 19 or 24(3), so the same thresholds are expected. It is not enacted. Recheck in the Narodne novine in December 2026.',
      },
    ],
  },
  {
    id: 'hr.pit.local-rate-ranges',
    area: 'owner-pay',
    title: 'Statutory ranges for local income tax rates',
    appliesBy: 'payment-date',
    versions: [
      {
        validFrom: day('2025-01-01'),
        validTo: null,
        value: {
          defaultLowerRate: basisPoints(2000),
          defaultHigherRate: basisPoints(3000),
          ranges: table([
            { unitType: text('municipality'), lowerRateFrom: basisPoints(1500), lowerRateTo: basisPoints(2000), higherRateFrom: basisPoints(2500), higherRateTo: basisPoints(3000) },
            { unitType: text('town'), lowerRateFrom: basisPoints(1500), lowerRateTo: basisPoints(2100), higherRateFrom: basisPoints(2500), higherRateTo: basisPoints(3100) },
            { unitType: text('large-town-or-county-seat'), lowerRateFrom: basisPoints(1500), lowerRateTo: basisPoints(2200), higherRateFrom: basisPoints(2500), higherRateTo: basisPoints(3200) },
            { unitType: text('zagreb'), lowerRateFrom: basisPoints(1500), lowerRateTo: basisPoints(2300), higherRateFrom: basisPoints(2500), higherRateTo: basisPoints(3300) },
          ]),
        },
        sources: [
          { act: 'ZPDoh', nn: ['152/24'], article: '19.a(2), 19.a(3), 19.a(5)', url: ZPDOH_URL, loadedOn: LOADED_ON },
          { act: 'ZPDoh', nn: ['152/24'], article: '4', ofAmendingAct: true, url: NN_152_24_URL, loadedOn: LOADED_ON },
        ],
        confidence: 'confirmed-nn',
        note: 'Each local unit adopts its own rates by the end of November, and they apply from 1 January of the next year. The unit of the taxpayer\'s residence decides. A unit that adopts nothing uses 20% and 30%. 2027 is assumed, with no enacted change found through NN 109/26.',
      },
    ],
  },
  {
    id: 'hr.pit.local-rates',
    area: 'owner-pay',
    title: 'Local income tax rates of Split',
    appliesBy: 'payment-date',
    versions: [
      {
        validFrom: day('2025-01-01'),
        validTo: day('2025-02-28'),
        value: {
          cityRates: table([{ city: text('Split'), lowerRate: basisPoints(2150), higherRate: basisPoints(3225) }]),
        },
        sources: [
          { act: 'OdlukaSplit', nn: ['150/23'], article: '2', url: 'https://narodne-novine.nn.hr/clanci/sluzbeni/2023_12_150_2185.html', loadedOn: LOADED_ON },
          splitDecisionTransitionalSource,
        ],
        confidence: 'confirmed-nn',
        note: 'These rates apply to monthly advances until 28 February 2025. The annual settlement of 2025 uses the rates from 1 March 2025 for the whole year, so look it up on 31 December.',
      },
      {
        validFrom: day('2025-03-01'),
        validTo: day('2026-12-31'),
        value: {
          cityRates: table([{ city: text('Split'), lowerRate: basisPoints(2150), higherRate: basisPoints(3200) }]),
        },
        sources: [splitDecision2025Source, splitDecisionTransitionalSource],
        confidence: 'confirmed-nn',
        note: 'The Porezna uprava table of local rates for 2026 lists Split with the same two decisions, so 2026 is unchanged. The new higher rate applies to advances from 1 March 2025 and to the whole 2025 annual tax.',
      },
      {
        validFrom: day('2027-01-01'),
        validTo: null,
        value: {
          cityRates: table([{ city: text('Split'), lowerRate: basisPoints(2150), higherRate: basisPoints(3200) }]),
        },
        sources: [splitDecision2025Source],
        confidence: 'unconfirmed',
        note: 'Assumed unchanged. Split can adopt a new decision by 30 November 2026, published in the Narodne novine in December 2026. Recheck then.',
      },
    ],
  },
  {
    id: 'hr.pit.monthly-advance',
    area: 'owner-pay',
    title: 'Monthly income tax advance on salary',
    appliesBy: 'payment-date',
    versions: [
      {
        validFrom: day('2025-01-01'),
        validTo: null,
        value: {
          baseDeductsPensionContributions: flag(true),
          baseDeductsPersonalAllowance: flag(true),
          youthReliefApplies: flag(false),
          thresholdPeriod: text('month'),
        },
        sources: [zpdohSource('24')],
        confidence: 'confirmed-nn',
        note: 'The base is the salary less the pension contributions paid from it and less the monthly allowance. The lower rate applies up to the monthly threshold. Youth relief is not applied in the month, only in the annual settlement. The text was read as current law in the annex of bill PZ 339 and the accountant\'s figures apply it and match. 2027 is assumed, with no enacted change found through NN 109/26.',
      },
    ],
  },
  {
    id: 'hr.pit.annual-settlement',
    area: 'owner-pay',
    title: 'Annual income tax settlement',
    appliesBy: 'tax-period',
    versions: [
      {
        validFrom: day('2025-01-01'),
        validTo: null,
        value: {
          allowanceMonths: count(12),
          thresholdPeriod: text('year'),
          unusedAllowanceUsed: flag(true),
        },
        sources: [zpdohSource('46(1)')],
        confidence: 'confirmed-nn',
        note: 'The tax office recomputes the year with twelve allowances and the annual threshold. An allowance left unused in months without salary is used here, so a part-year salary often gives a refund. Look the rule up on 31 December of the tax year. Bill PZ 339 rewords Art. 46(1) with no change for a resident director on salary. 2027 is assumed, with no enacted change found through NN 109/26.',
      },
    ],
  },
  {
    id: 'hr.pit.youth-relief',
    area: 'owner-pay',
    title: 'Youth relief on the annual income tax',
    appliesBy: 'tax-period',
    versions: [
      {
        validFrom: day('2025-01-01'),
        validTo: day('2025-12-31'),
        value: {
          appliedIn: text('annual-settlement'),
          bands: table([
            { reliefShare: basisPoints(10_000), bornFrom: count(2000) },
            { reliefShare: basisPoints(5000), bornFrom: count(1995), bornTo: count(1999) },
          ]),
        },
        sources: youthReliefSources,
        confidence: 'confirmed-nn',
        note: 'The lower-rate tax on salary is cut by 100% up to age 25 and by 50% from 26 to 30. It is not applied in monthly payroll. Which band a person falls in depends on the birth year, which is a workbook setting.',
      },
      {
        validFrom: day('2026-01-01'),
        validTo: day('2026-12-31'),
        value: {
          appliedIn: text('annual-settlement'),
          bands: table([
            { reliefShare: basisPoints(10_000), bornFrom: count(2001) },
            { reliefShare: basisPoints(5000), bornFrom: count(1996), bornTo: count(2000) },
          ]),
        },
        sources: youthReliefSources,
        confidence: 'confirmed-nn',
        note: 'The lower-rate tax on salary is cut by 100% up to age 25 and by 50% from 26 to 30. It is not applied in monthly payroll. Which band a person falls in depends on the birth year, which is a workbook setting.',
      },
      {
        validFrom: day('2027-01-01'),
        validTo: day('2027-12-31'),
        value: {
          appliedIn: text('annual-settlement'),
          bands: table([
            { reliefShare: basisPoints(10_000), bornFrom: count(2002) },
            { reliefShare: basisPoints(5000), bornFrom: count(1997), bornTo: count(2001) },
          ]),
        },
        sources: youthReliefSources,
        confidence: 'confirmed-nn',
        note: 'The table in NN 16/25 lists tax year 2027 itself, with the same age limits. The income tax bill PZ 339 would reword Art. 46(1) and 24(5) from 2027 and add a pensioner relief, with no change to these bands. Recheck the bands in the Narodne novine in December 2026.',
      },
    ],
  },
  {
    id: 'hr.pit.nontaxable-caps',
    area: 'owner-pay',
    title: 'Non-taxable payments to an employee',
    appliesBy: 'payment-date',
    versions: [
      {
        validFrom: day('2025-01-01'),
        validTo: day('2026-12-31'),
        value: {
          caps: table([
            { item: count(5), payment: text('newborn-support'), period: text('event'), cap: cents(150_000) },
            { item: count(13), payment: text('living-apart-from-family'), period: text('month'), cap: cents(30_000) },
            { item: count(18), payment: text('results-bonus'), period: text('year'), cap: cents(120_000) },
            { item: count(19), payment: text('domestic-per-diem-over-12-hours'), period: text('day'), cap: cents(3000) },
            { item: count(20), payment: text('domestic-per-diem-8-to-12-hours'), period: text('day'), cap: cents(1500) },
            { item: count(21), payment: text('foreign-per-diem'), period: text('foreign-per-diem-rule') },
            { item: count(22), payment: text('foreign-per-diem'), period: text('foreign-per-diem-rule') },
            { item: count(25), payment: text('occasional-gift'), period: text('year'), cap: cents(70_000) },
            { item: count(27), payment: text('business-travel-cost'), period: text('actual-cost') },
            { item: count(28), payment: text('business-travel-cost'), period: text('actual-cost') },
            { item: count(29), payment: text('commuting-ticket'), period: text('actual-cost') },
            { item: count(30), payment: text('commuting-ticket'), period: text('actual-cost') },
            { item: count(31), payment: text('private-car-business-travel'), period: text('kilometre'), cap: cents(50) },
            { item: count(32), payment: text('child-gift'), period: text('year'), cap: cents(14_000) },
            { item: count(33), payment: text('holiday-services'), period: text('year'), cap: cents(40_000) },
            { item: count(34), payment: text('meal-allowance-flat'), period: text('year'), cap: cents(120_000) },
            { item: count(35), payment: text('meals-on-invoices'), period: text('year'), cap: cents(180_000) },
            { item: count(38), payment: text('supplementary-health-insurance'), period: text('year'), cap: cents(50_000) },
            { item: count(39), payment: text('work-at-separate-place'), period: text('day'), cap: cents(400), monthlyCap: cents(7000) },
          ]),
        },
        sources: nontaxableCapSources,
        confidence: 'confirmed-nn',
        note: 'Items 1 to 18 are multiples of the 600.00 allowance. Items 21 and 22 follow hr.pit.foreign-per-diem. Item 31 covers business kilometres only. The excess over a cap is salary. NN 157/25 did not change Art. 7. Applying the table from 1 January 2025 rather than 1 February 2025 is unconfirmed, because only a secondary source cites a tax office notice. What applies to a non-employed board member is unconfirmed.',
      },
      {
        validFrom: day('2027-01-01'),
        validTo: null,
        value: {
          caps: table([
            { item: count(5), payment: text('newborn-support'), period: text('event'), cap: cents(150_000) },
            { item: count(13), payment: text('living-apart-from-family'), period: text('month'), cap: cents(30_000) },
            { item: count(18), payment: text('results-bonus'), period: text('year'), cap: cents(120_000) },
            { item: count(19), payment: text('domestic-per-diem-over-12-hours'), period: text('day'), cap: cents(3000) },
            { item: count(20), payment: text('domestic-per-diem-8-to-12-hours'), period: text('day'), cap: cents(1500) },
            { item: count(21), payment: text('foreign-per-diem'), period: text('foreign-per-diem-rule') },
            { item: count(22), payment: text('foreign-per-diem'), period: text('foreign-per-diem-rule') },
            { item: count(25), payment: text('occasional-gift'), period: text('year'), cap: cents(70_000) },
            { item: count(27), payment: text('business-travel-cost'), period: text('actual-cost') },
            { item: count(28), payment: text('business-travel-cost'), period: text('actual-cost') },
            { item: count(29), payment: text('commuting-ticket'), period: text('actual-cost') },
            { item: count(30), payment: text('commuting-ticket'), period: text('actual-cost') },
            { item: count(31), payment: text('private-car-business-travel'), period: text('kilometre'), cap: cents(50) },
            { item: count(32), payment: text('child-gift'), period: text('year'), cap: cents(14_000) },
            { item: count(33), payment: text('holiday-services'), period: text('year'), cap: cents(40_000) },
            { item: count(34), payment: text('meal-allowance-flat'), period: text('year'), cap: cents(120_000) },
            { item: count(35), payment: text('meals-on-invoices'), period: text('year'), cap: cents(180_000) },
            { item: count(38), payment: text('supplementary-health-insurance'), period: text('year'), cap: cents(50_000) },
            { item: count(39), payment: text('work-at-separate-place'), period: text('day'), cap: cents(400), monthlyCap: cents(7000) },
          ]),
        },
        sources: nontaxableCapSources,
        confidence: 'pending',
        note: 'Art. 15 of the income tax bill PZ 339 asks the Minister to align the Pravilnik within 90 days of the act, and no amounts are announced. The same caps are assumed until then. Recheck the Pravilnik in the Narodne novine after the bill is passed.',
      },
    ],
  },
  {
    id: 'hr.pit.foreign-per-diem',
    area: 'owner-pay',
    title: 'Foreign per diem for a business trip',
    appliesBy: 'event-date',
    versions: [
      {
        validFrom: day('2025-01-01'),
        validTo: null,
        value: {
          perDiems: table([{ country: text('GB'), fullDay: cents(8000), halfDayShare: basisPoints(5000) }]),
        },
        sources: [
          { act: 'OdlukaDnevniceInozemstvo', nn: ['16/24'], article: 'item 101', url: 'https://narodne-novine.nn.hr/clanci/sluzbeni/2024_02_16_277.html', loadedOn: LOADED_ON },
          { act: 'PravPDoh', nn: ['16/25'], article: '7(2) items 21, 22', url: NN_16_25_URL, loadedOn: LOADED_ON },
        ],
        confidence: 'confirmed-nn',
        note: 'Only the United Kingdom row is transcribed, read in the Narodne novine text of the Odluka, which is in force from 8 February 2024. The Odluka sets full days only. Half for 8 to 12 hours comes from the Pravilnik items 21 and 22. The amounts of the other countries are not transcribed. A search found no later Odluka, but that is not a check of every NN issue, so whether one replaced the table is unconfirmed. 2027 is assumed unless one is found.',
      },
    ],
  },
  {
    id: 'hr.pit.loan-benefit',
    area: 'owner-pay',
    title: 'Benefit in kind of a cheap loan to an employee',
    appliesBy: 'payment-date',
    versions: [
      {
        validFrom: day('2025-01-01'),
        validTo: null,
        value: { minimumInterestRate: basisPoints(200) },
        sources: [
          {
            act: 'ZPDoh',
            nn: ['115/16', '106/18', '121/19', '114/23'],
            article: '21(3)',
            url: ZPDOH_URL,
            loadedOn: LOADED_ON,
            quote: 'Primitkom po osnovi povoljnijih kamata smatra se razlika između ugovorene niže i stope kamate od 2% godišnje',
          },
        ],
        confidence: 'confirmed-consolidated',
        note: 'A loan to an employee at less than 2% a year gives a benefit in kind equal to the difference to 2%. Whether the benefit is grossed up is unconfirmed. 2027 is assumed, with no enacted change found through NN 109/26.',
      },
    ],
  },
  {
    id: 'hr.pit.rent',
    area: 'owner-pay',
    title: 'Income tax on rent paid to the owner',
    appliesBy: 'payment-date',
    versions: [
      {
        validFrom: day('2025-01-01'),
        validTo: null,
        value: {
          flatExpenseShare: basisPoints(3000),
          taxRate: basisPoints(1200),
          withheldByPayer: flag(false),
          dueOn: text('last-day-of-month'),
        },
        sources: [
          { act: 'ZPDoh', nn: ['115/16', '106/18', '151/22', '152/24'], article: '57(1)', url: ZPDOH_URL, loadedOn: LOADED_ON },
          { act: 'ZPDoh', nn: ['115/16', '138/20', '114/23', '152/24'], article: '62(1)', url: ZPDOH_URL, loadedOn: LOADED_ON },
        ],
        confidence: 'confirmed-consolidated',
        note: 'A flat 30% of the rent counts as expense and 12% is charged on the rest, which is 8.4% of the rent. The tax office assesses it by decision and the owner pays it by the end of each month. The company does not withhold it. Since 2025 the tax belongs to the local unit where the property is, which is confirmed only through the description in bill PZ 339. A tax office assessment applies this calculation exactly. Bill PZ 339 leaves it alone, so 2027 is assumed.',
      },
    ],
  },
  {
    id: 'hr.pit.dividend',
    area: 'owner-pay',
    title: 'Income tax on a dividend',
    appliesBy: 'payment-date',
    versions: [
      {
        validFrom: day('2025-01-01'),
        validTo: null,
        value: {
          rate: basisPoints(1200),
          withheldAtPayout: flag(true),
          personalAllowanceApplies: flag(false),
          contributionsApply: flag(false),
        },
        sources: [
          zpdohSource('69'),
          { act: 'ZPDoh', nn: ['115/16', '114/23'], article: '70(19)', url: ZPDOH_URL, loadedOn: LOADED_ON, quote: 'plaća se po odbitku, po stopi od 12%' },
        ],
        confidence: 'confirmed-consolidated',
        note: 'A final tax withheld by the company at payout, with no allowance and no annual return. The accountant\'s figures apply the 12% and match to the cent. No contributions rests on their absence from the Zakon o doprinosima, with no positive source. Bill PZ 339 leaves paragraph 19 alone, so 2027 is assumed. Recheck the paragraph numbers of Art. 70 once the bill is passed.',
      },
    ],
  },
  {
    id: 'hr.pit.hidden-distribution',
    area: 'owner-pay',
    title: 'Tax on private use of company assets',
    appliesBy: 'event-date',
    versions: [
      {
        validFrom: day('2025-01-01'),
        validTo: null,
        value: {
          withholdingRate: basisPoints(3600),
          withheldBy: text('profit-tax-return-filing-date'),
          costDeductibleForCompany: flag(false),
        },
        sources: [
          zpdohSource('66(1)'),
          { act: 'ZPDoh', nn: ['115/16', '114/23'], article: '70(2), 70(3)', url: ZPDOH_URL, loadedOn: LOADED_ON },
          { act: 'ZPD', nn: ACTS.ZPD.nn, article: '7(1)(13)', url: ZPD_URL, loadedOn: LOADED_ON },
        ],
        confidence: 'confirmed-consolidated',
        note: 'Private use of company assets or services by a member is capital income taxed at 36%, withheld by the time the profit tax return is filed. The cost is not deductible for the company. Whether the 36% is withheld from the value or paid on top is unconfirmed. 2027 is assumed, with no enacted change found through NN 109/26.',
      },
    ],
  },
  {
    id: 'hr.minwage',
    area: 'owner-pay',
    title: 'Statutory minimum wage',
    appliesBy: 'payment-date',
    versions: [
      {
        validFrom: day('2025-01-01'),
        validTo: day('2025-12-31'),
        value: { monthlyGrossAmount: cents(97_000), appliesToSoleWorkerWhoIsDirector: flag(false) },
        sources: [
          ...minimumWageActSources,
          { act: 'UredbaMP2025', nn: ['124/24'], article: '1', url: 'https://narodne-novine.nn.hr/clanci/sluzbeni/2024_10_124_2072.html', loadedOn: LOADED_ON },
        ],
        confidence: 'confirmed-nn',
        note: 'The minimum wage does not apply to a worker who is the only worker of the employer and also its board member or director. Art. 4(2) was added by NN 120/21 and was read in the consolidated text.',
      },
      {
        validFrom: day('2026-01-01'),
        validTo: day('2026-12-31'),
        value: { monthlyGrossAmount: cents(105_000), appliesToSoleWorkerWhoIsDirector: flag(false) },
        sources: [
          ...minimumWageActSources,
          { act: 'UredbaMP2026', nn: ['132/25'], article: '1', url: 'https://narodne-novine.nn.hr/clanci/sluzbeni/2025_10_132_1931.html', loadedOn: LOADED_ON },
        ],
        confidence: 'confirmed-nn',
        note: 'The minimum wage does not apply to a worker who is the only worker of the employer and also its board member or director. Art. 4(2) was added by NN 120/21 and was read in the consolidated text.',
      },
      {
        validFrom: day('2027-01-01'),
        validTo: day('2027-12-31'),
        value: { monthlyGrossAmount: cents(105_000), appliesToSoleWorkerWhoIsDirector: flag(false) },
        sources: minimumWageActSources,
        confidence: 'unconfirmed',
        note: 'The 2027 amount is not set. This is the 2026 amount, which the act says the 2027 one cannot go below. The Uredba for 2027 is due by 31 October 2026. Replace this with it.',
      },
    ],
  },
]

export const ownerPayOpenItems: readonly OpenItem[] = [
  {
    id: 'hr.pit.per-diem-meal-reduction',
    area: 'owner-pay',
    title: 'Per diem reduction for meals provided by the employer',
    status: 'unconfirmed',
    note: 'A meal paid by the employer is reported to cut the domestic per diem by 30% for one meal and 60% for two. The wording of the Pravilnik was never loaded, so the rule is not used. Load the current Pravilnik text to settle it.',
    url: null,
  },
  {
    id: 'hr.pit.bill-pz-339',
    area: 'owner-pay',
    title: 'Income tax bill for 2027 (PZ 339)',
    status: 'pending',
    note: 'Sent to the Sabor on 10 September 2026, planned in force on 1 January 2027. It leaves the allowance, brackets, city ranges and dividend rate alone. It adds a pensioner relief, rewords Art. 24(5) and 46(1), and in Art. 15 asks the Minister to align the non-taxable caps within 90 days. Recheck the Narodne novine in December 2026, including the numbering of its new Art. 70 paragraph.',
    url: 'https://www.sabor.hr/sites/default/files/uploads/sabor/2026-09-11/121601/PZ_339.pdf',
  },
  {
    id: 'hr.contrib.draft-10198',
    area: 'owner-pay',
    title: 'Contributions draft for 2027 (e-Savjetovanja 10198)',
    status: 'pending',
    note: 'Open for consultation from 31 July 2026. A secondary summary says it raises the base coefficients of flat-rate taxpayers above 40,000.00 to 0.45 and 0.50, and reports nothing on directors, rates or Art. 21.a. The draft itself was not loaded because the portal needs JavaScript, and the link is that summary. Load the draft or the published act to settle it.',
    url: 'https://www.teb.hr/novosti/2026/izmjene-poreznih-zakona-i-zakona-o-doprinosima-otvorena-savjetovanja/',
  },
]
