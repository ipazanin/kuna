// Accounting: size class, annual statements, accruals, assets and grants.

import { cents, count, day, flag, text } from '../schema'
import type { CountTerm, FlagTerm, MoneyTerm, OpenItem, RuleIn, TextTerm } from '../schema'

export interface AccountingValues {
  'hr.acc.size-class': {
    readonly assetsLimit: MoneyTerm
    readonly revenueLimit: MoneyTerm
    readonly averageEmployeesLimit: CountTerm
    /** How many of the three limits the company must stay within to be micro. */
    readonly limitsToStayWithin: CountTerm
    readonly measuredOn: TextTerm
    readonly firstYearOnOwnFigures: FlagTerm
    readonly firstYearRevenueAnnualised: FlagTerm
  }
  'hr.acc.statements': {
    readonly balanceSheet: FlagTerm
    readonly profitAndLoss: FlagTerm
    readonly notes: FlagTerm
    readonly cashFlowStatement: FlagTerm
    readonly equityChangesStatement: FlagTerm
    readonly auditAssetsLimit: MoneyTerm
    readonly auditRevenueLimit: MoneyTerm
    readonly auditEmployeesLimit: CountTerm
  }
  'hr.acc.calendar': {
    readonly booksClosedMonthsAfterYearEnd: CountTerm
    /** The month of the statistics filing deadline, which falls on the last day of April. */
    readonly statisticsFilingMonth: CountTerm
    readonly statisticsFilingDay: CountTerm
    readonly publicFilingMonthsAfterYearEnd: CountTerm
    readonly oneFilingCoversBoth: FlagTerm
    readonly companyFineFrom: MoneyTerm
    readonly companyFineTo: MoneyTerm
    readonly responsiblePersonFineFrom: MoneyTerm
    readonly responsiblePersonFineTo: MoneyTerm
  }
  'hr.acc.inventory-count': {
    readonly assetsAndLiabilitiesCounted: FlagTerm
    readonly countedBy: TextTerm
    readonly booksAlignedToCount: FlagTerm
  }
  'hr.acc.accrual-basis': {
    readonly basis: TextTerm
    readonly serviceRevenueRecognisedIn: TextTerm
    readonly expensesRecognisedIn: TextTerm
    readonly prepaidExpensesAreAssets: FlagTerm
    readonly deferredIncomeRecognised: FlagTerm
    readonly unpaidCurrentTaxIsLiability: FlagTerm
  }
  'hr.acc.capitalisation': {
    /** Unit cost above which an item is a long-term asset. */
    readonly assetThreshold: MoneyTerm
    readonly minimumLifeYears: CountTerm
    readonly costBasis: TextTerm
    readonly smallInventoryWrittenOffOnUse: FlagTerm
  }
  'hr.acc.grant-recognition': {
    readonly defaultPolicy: TextTerm
    readonly fixedPartRecognisedOnReceipt: FlagTerm
    readonly variablePartReleasedWithFundedCosts: FlagTerm
    readonly assetGrantShownAs: TextTerm
  }
}

const LOADED_ON = day('2026-10-18')

const ZOR_NN_85_24_URL = 'https://narodne-novine.nn.hr/clanci/sluzbeni/2024_07_85_1474.html'
const ZOR_NN_145_24_URL = 'https://narodne-novine.nn.hr/clanci/sluzbeni/2024_12_145_2372.html'
const HSFI_TEXT_URL = 'https://www.zakon.hr/cms.htm?id=60100'
const HSFI_ISSUES = ['86/15', '105/20', '9/21', '150/22', '84/24']

export const accountingRules: readonly RuleIn<AccountingValues>[] = [
  {
    id: 'hr.acc.size-class',
    area: 'accounting',
    title: 'Micro company size class',
    appliesBy: 'tax-period',
    versions: [
      {
        validFrom: day('2025-01-01'),
        validTo: null,
        value: {
          assetsLimit: cents(45_000_000),
          revenueLimit: cents(90_000_000),
          averageEmployeesLimit: count(10),
          limitsToStayWithin: count(2),
          measuredOn: text('last-day-of-previous-year'),
          firstYearOnOwnFigures: flag(true),
          firstYearRevenueAnnualised: flag(true),
        },
        sources: [
          {
            act: 'ZoR',
            nn: ['85/24', '145/24'],
            article: '5(1) to 5(3), 5(7) to 5(9)',
            url: ZOR_NN_85_24_URL,
            loadedOn: LOADED_ON,
          },
          {
            act: 'ZoR',
            nn: ['145/24'],
            article: '6.a',
            url: ZOR_NN_145_24_URL,
            loadedOn: LOADED_ON,
          },
        ],
        confidence: 'confirmed-nn',
        note: 'A company is micro when it stays within two of the three limits. A newly founded company classifies on its first-year figures with revenue annualised, and later years are measured on 31 December of the year before. If the limits change, the standards follow the limits in force on the day before the year began. NN 151/25 and NN 59/26 are read from the zakon.hr summary only, which says they touch sustainability reporting. 2027 is assumed: no enacted change was found through NN 109/26.',
      },
    ],
  },
  {
    id: 'hr.acc.statements',
    area: 'accounting',
    title: 'Annual statements of a micro company',
    appliesBy: 'tax-period',
    versions: [
      {
        validFrom: day('2025-01-01'),
        validTo: null,
        value: {
          balanceSheet: flag(true),
          profitAndLoss: flag(true),
          notes: flag(true),
          cashFlowStatement: flag(false),
          equityChangesStatement: flag(false),
          auditAssetsLimit: cents(250_000_000),
          auditRevenueLimit: cents(500_000_000),
          auditEmployeesLimit: count(25),
        },
        sources: [
          {
            act: 'ZoR',
            nn: ['85/24'],
            article: '18(3), 20(1), 20(4)',
            url: ZOR_NN_85_24_URL,
            loadedOn: LOADED_ON,
          },
        ],
        confidence: 'confirmed-nn',
        note: 'A micro company prepares a balance sheet, a profit and loss account and notes. Audit applies to medium and large companies and to a d.o.o. above two of the three audit limits. 2027 is assumed: no enacted change was found through NN 109/26.',
      },
    ],
  },
  {
    id: 'hr.acc.calendar',
    area: 'accounting',
    title: 'Year-end calendar and FINA filing',
    appliesBy: 'event-date',
    versions: [
      {
        validFrom: day('2025-01-01'),
        validTo: null,
        value: {
          booksClosedMonthsAfterYearEnd: count(4),
          statisticsFilingMonth: count(4),
          statisticsFilingDay: count(30),
          publicFilingMonthsAfterYearEnd: count(6),
          oneFilingCoversBoth: flag(true),
          companyFineFrom: cents(132_000),
          companyFineTo: cents(1_327_000),
          responsiblePersonFineFrom: cents(66_000),
          responsiblePersonFineTo: cents(265_000),
        },
        sources: [
          {
            act: 'ZoR',
            nn: ['85/24'],
            article: '12(9), 47(4), 47(5), 50(1), 50(2), 60',
            url: ZOR_NN_85_24_URL,
            loadedOn: LOADED_ON,
          },
        ],
        confidence: 'confirmed-nn',
        note: 'Books close within four months of year end. The statistics statements go to FINA by 30 April and the statements for public filing within six months. A company with a calendar business year that files the full package by 30 April meets both duties in one filing. Art. 47(4) asks for the proposal of the profit-use decision with the statements. The corporate tax return deadline is owned by hr.cit.filing. 2027 is assumed: no enacted change was found through NN 109/26.',
      },
    ],
  },
  {
    id: 'hr.acc.inventory-count',
    area: 'accounting',
    title: 'Count of assets and liabilities',
    appliesBy: 'event-date',
    versions: [
      {
        validFrom: day('2025-01-01'),
        validTo: null,
        value: {
          assetsAndLiabilitiesCounted: flag(true),
          countedBy: text('year-end'),
          booksAlignedToCount: flag(true),
        },
        sources: [
          {
            act: 'ZoR',
            nn: ['85/24'],
            article: '14(1), 14(2)',
            url: ZOR_NN_85_24_URL,
            loadedOn: LOADED_ON,
          },
        ],
        confidence: 'confirmed-nn',
        note: 'Assets and liabilities are counted at the start of business and by year end at the latest, and the books are aligned to the count. 2027 is assumed: no enacted change was found through NN 109/26.',
      },
    ],
  },
  {
    id: 'hr.acc.accrual-basis',
    area: 'accounting',
    title: 'Accrual basis of the annual statements',
    appliesBy: 'tax-period',
    versions: [
      {
        validFrom: day('2025-01-01'),
        validTo: null,
        value: {
          basis: text('accrual'),
          serviceRevenueRecognisedIn: text('period-performed'),
          expensesRecognisedIn: text('period-incurred'),
          prepaidExpensesAreAssets: flag(true),
          deferredIncomeRecognised: flag(true),
          unpaidCurrentTaxIsLiability: flag(true),
        },
        sources: [
          {
            act: 'HSFI',
            nn: HSFI_ISSUES,
            article: '1.3.2, 13.18, 13.19, 14.14 to 14.20, 15.24, 15.27, 15.28, 16.12, 16.13, 16.19, 16.20',
            url: HSFI_TEXT_URL,
            loadedOn: LOADED_ON,
          },
          {
            act: 'ZoR',
            nn: ['85/24'],
            article: '15, 16(2)',
            url: ZOR_NN_85_24_URL,
            loadedOn: LOADED_ON,
          },
        ],
        confidence: 'confirmed-consolidated',
        note: 'Micro, small and medium companies report under HSFI. Service revenue belongs to the period in which the service is performed, whatever the invoice date or the payment date. Staff costs belong to the period worked. A bank ledger is cash, so every figure compared with the annual statements needs this accrual layer. HSFI paragraph wording is read from the consolidated text. HSFI 18 on going concern was added by NN 84/24. 2027 is assumed: no new HSFI was found through NN 109/26.',
      },
    ],
  },
  {
    id: 'hr.acc.capitalisation',
    area: 'accounting',
    title: 'Long-term asset threshold and small inventory',
    appliesBy: 'tax-period',
    versions: [
      {
        validFrom: day('2025-01-01'),
        validTo: null,
        value: {
          assetThreshold: cents(66_500),
          minimumLifeYears: count(1),
          costBasis: text('net-of-recoverable-vat'),
          smallInventoryWrittenOffOnUse: flag(true),
        },
        sources: [
          {
            act: 'HSFI',
            nn: HSFI_ISSUES,
            article: '6.19, 6.20',
            url: HSFI_TEXT_URL,
            loadedOn: LOADED_ON,
          },
          {
            act: 'ZPD',
            nn: ['114/23'],
            article: '12(3)',
            url: 'https://www.zakon.hr/z/99/zakon-o-porezu-na-dobit',
            loadedOn: LOADED_ON,
          },
          {
            act: 'ZPD',
            nn: ['114/23'],
            article: '7',
            ofAmendingAct: true,
            url: 'https://narodne-novine.nn.hr/clanci/sluzbeni/2023_10_114_1613.html',
            loadedOn: LOADED_ON,
          },
        ],
        confidence: 'confirmed-consolidated',
        note: "The accountant's notes apply it and write small inventory off in full when it is put in use. Acquisition cost includes non-recoverable taxes, so a company that deducts input VAT tests the threshold on the price without VAT. That last step is a reading of HSFI 6.20. The wording of the Pravilnik on a one-off write-off of small inventory was not loaded. The threshold was 464.53 until 31 December 2023. 2027 is assumed: no enacted change was found through NN 109/26.",
      },
    ],
  },
  {
    id: 'hr.acc.grant-recognition',
    area: 'accounting',
    title: 'Recognition of a grant in the accounts',
    appliesBy: 'tax-period',
    versions: [
      {
        validFrom: day('2025-01-01'),
        validTo: null,
        value: {
          defaultPolicy: text('fixed-part-on-receipt-variable-part-with-assets'),
          fixedPartRecognisedOnReceipt: flag(true),
          variablePartReleasedWithFundedCosts: flag(true),
          assetGrantShownAs: text('deferred-income-released-over-useful-life'),
        },
        sources: [
          {
            act: 'HSFI',
            nn: HSFI_ISSUES,
            article: '14.20 to 14.22, 15.37, 15.38',
            url: HSFI_TEXT_URL,
            loadedOn: LOADED_ON,
          },
        ],
        confidence: 'reading',
        note: "HSFI matches a grant with the costs it compensates. A grant for costs already incurred, or immediate support with no future costs, is income when it becomes receivable. A grant for assets is deferred income released over the useful life, or a deduction from the carrying amount. The default policy is the fixed part on receipt plus the variable part released with the depreciation and write-offs of the assets it paid for. The accountant's method is unconfirmed, and a ledger card of the deferred income account would settle it. Any grant clawback is a scenario, never a base figure.",
      },
    ],
  },
]

export const accountingOpenItems: readonly OpenItem[] = []
