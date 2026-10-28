// Company law: share capital, profit distribution and member decisions, plus small levies.

import { basisPoints, cents, count, day, flag, text } from '../schema'
import type { CountTerm, FlagTerm, MoneyTerm, OpenItem, RateTerm, RuleIn, TextTerm } from '../schema'

export interface CompanyLawValues {
  'hr.ztd.min-share-capital': {
    readonly minimumShareCapital: MoneyTerm
  }
  'hr.ztd.reserves': {
    readonly statutoryReserveRequired: FlagTerm
  }
  'hr.ztd.distributable-profit': {
    readonly includesProfitForYear: FlagTerm
    readonly includesRetainedEarnings: FlagTerm
    readonly deductsLossesBroughtForward: FlagTerm
    readonly profitDecisionOrArticlesMayExclude: FlagTerm
  }
  'hr.ztd.withhold-on-deterioration': {
    readonly profitWithheldOnLastingDeterioration: FlagTerm
  }
  'hr.ztd.capital-protection': {
    readonly payoutFromAssetsCoveringShareCapitalAllowed: FlagTerm
    readonly netAssetsFloor: TextTerm
    readonly unlawfulPayoutReturned: FlagTerm
  }
  'hr.ztd.members-decision-deadline': {
    readonly monthsAfterFinancialYearEnd: CountTerm
  }
  'hr.ztd.asset-purchase-decision': {
    /** Price of a purchase, as a share of the share capital, above which the members must decide. */
    readonly priceShareOfCapital: RateTerm
    readonly windowYearsFromRegistration: CountTerm
    readonly decisionIsValidityCondition: FlagTerm
    readonly majority: RateTerm
  }
  'hr.ztd.sole-member-deals': {
    readonly writtenFormOrRecordRequired: FlagTerm
    readonly routineBusinessExempt: FlagTerm
  }
}

const LOADED_ON = day('2026-10-18')

const ZTD_TEXT_URL = 'https://www.zakon.hr/z/546/zakon-o-trgovackim-drustvima'
const ZTD_ISSUES = ['111/93', '130/23', '136/24']
const ASSUMED_2027 = '2027 is assumed: no enacted change was found through NN 109/26.'

export const companyLawRules: readonly RuleIn<CompanyLawValues>[] = [
  {
    id: 'hr.ztd.min-share-capital',
    area: 'company-law',
    title: 'Minimum share capital of a d.o.o.',
    appliesBy: 'event-date',
    versions: [
      {
        validFrom: day('2025-01-01'),
        validTo: null,
        value: { minimumShareCapital: cents(250_000) },
        sources: [
          {
            act: 'ZTD',
            nn: ['114/22'],
            article: '389(2)',
            url: ZTD_TEXT_URL,
            loadedOn: LOADED_ON,
          },
        ],
        confidence: 'confirmed-consolidated',
        note: ASSUMED_2027,
      },
    ],
  },
  {
    id: 'hr.ztd.reserves',
    area: 'company-law',
    title: 'Statutory reserve of a d.o.o.',
    appliesBy: 'event-date',
    versions: [
      {
        validFrom: day('2025-01-01'),
        validTo: null,
        value: { statutoryReserveRequired: flag(false) },
        sources: [
          {
            act: 'ZTD',
            nn: ZTD_ISSUES,
            article: '222, 390.a(5)',
            url: ZTD_TEXT_URL,
            loadedOn: LOADED_ON,
          },
        ],
        confidence: 'confirmed-consolidated',
        note: `A d.o.o. has no statutory reserve. Art. 222 belongs to the d.d., and Art. 390.a(5) applies only to a j.d.o.o. ${ASSUMED_2027}`,
      },
    ],
  },
  {
    id: 'hr.ztd.distributable-profit',
    area: 'company-law',
    title: 'Distributable profit',
    appliesBy: 'event-date',
    versions: [
      {
        validFrom: day('2025-01-01'),
        validTo: null,
        value: {
          includesProfitForYear: flag(true),
          includesRetainedEarnings: flag(true),
          deductsLossesBroughtForward: flag(true),
          profitDecisionOrArticlesMayExclude: flag(true),
        },
        sources: [
          {
            act: 'ZTD',
            nn: ['130/23'],
            article: '406(1)',
            url: ZTD_TEXT_URL,
            loadedOn: LOADED_ON,
          },
        ],
        confidence: 'confirmed-consolidated',
        note: `The members are entitled to the profit for the year plus retained earnings less losses brought forward, unless the profit-use decision or the articles exclude it. ${ASSUMED_2027}`,
      },
    ],
  },
  {
    id: 'hr.ztd.withhold-on-deterioration',
    area: 'company-law',
    title: 'Profit withheld when the position worsens',
    appliesBy: 'event-date',
    versions: [
      {
        validFrom: day('2025-01-01'),
        validTo: null,
        value: { profitWithheldOnLastingDeterioration: flag(true) },
        sources: [
          {
            act: 'ZTD',
            nn: ZTD_ISSUES,
            article: '406(4)',
            url: ZTD_TEXT_URL,
            loadedOn: LOADED_ON,
          },
        ],
        confidence: 'confirmed-consolidated',
        note: `Profit is withheld when the financial position has seriously and not just temporarily worsened before the decision. ${ASSUMED_2027}`,
      },
    ],
  },
  {
    id: 'hr.ztd.capital-protection',
    area: 'company-law',
    title: 'Protection of share capital in payouts',
    appliesBy: 'event-date',
    versions: [
      {
        validFrom: day('2025-01-01'),
        validTo: null,
        value: {
          payoutFromAssetsCoveringShareCapitalAllowed: flag(false),
          netAssetsFloor: text('share-capital'),
          unlawfulPayoutReturned: flag(true),
        },
        sources: [
          {
            act: 'ZTD',
            nn: ZTD_ISSUES,
            article: '407(1), 407(2)',
            url: ZTD_TEXT_URL,
            loadedOn: LOADED_ON,
          },
        ],
        confidence: 'confirmed-consolidated',
        note: `No payout may come from assets needed to cover the share capital, so net assets stay at or above the share capital after a payout. Members who receive an unlawful payment must return it. ${ASSUMED_2027}`,
      },
    ],
  },
  {
    id: 'hr.ztd.members-decision-deadline',
    area: 'company-law',
    title: 'Members decide on the statements and profit use',
    appliesBy: 'event-date',
    versions: [
      {
        validFrom: day('2025-01-01'),
        validTo: null,
        value: { monthsAfterFinancialYearEnd: count(8) },
        sources: [
          {
            act: 'ZTD',
            nn: ['130/23'],
            article: '441(1)(1)',
            url: ZTD_TEXT_URL,
            loadedOn: LOADED_ON,
          },
        ],
        confidence: 'confirmed-consolidated',
        note: `The members decide on the annual statements and the use of profit within the first eight months after the end of the financial year. Art. 428 on the books and statements is the companion article. ${ASSUMED_2027}`,
      },
    ],
  },
  {
    id: 'hr.ztd.asset-purchase-decision',
    area: 'company-law',
    title: 'Members decide on large asset purchases early on',
    appliesBy: 'event-date',
    versions: [
      {
        validFrom: day('2025-01-01'),
        validTo: null,
        value: {
          priceShareOfCapital: basisPoints(2000),
          windowYearsFromRegistration: count(2),
          decisionIsValidityCondition: flag(true),
          majority: basisPoints(7500),
        },
        sources: [
          {
            act: 'ZTD',
            nn: ['130/23'],
            article: '441(1)(10), 441(2)',
            url: ZTD_TEXT_URL,
            loadedOn: LOADED_ON,
          },
        ],
        confidence: 'confirmed-consolidated',
        note: `Within two years of registration, a contract to acquire things or rights permanently for the business at a price above one fifth of the share capital needs a members' decision, with a three-quarter majority, as a condition of validity. The articles cannot remove this in that window. The text is confirmed. Whether ordinary equipment falls under it is unconfirmed, and the accountant or a lawyer can settle it. ${ASSUMED_2027}`,
      },
    ],
  },
  {
    id: 'hr.ztd.sole-member-deals',
    area: 'company-law',
    title: 'Deals between the sole member and the company',
    appliesBy: 'event-date',
    versions: [
      {
        validFrom: day('2025-01-01'),
        validTo: null,
        value: {
          writtenFormOrRecordRequired: flag(true),
          routineBusinessExempt: flag(true),
        },
        sources: [
          {
            act: 'ZTD',
            nn: ZTD_ISSUES,
            article: '426(8)',
            url: ZTD_TEXT_URL,
            loadedOn: LOADED_ON,
          },
        ],
        confidence: 'confirmed-consolidated',
        note: `A legal transaction between the sole member and the company he represents is in writing, or a document recording it is drawn up. Routine business on usual terms is the only exception. The NN issue of this paragraph was not recorded, so the issues are the act's listed history. ${ASSUMED_2027}`,
      },
    ],
  },
]

export const companyLawOpenItems: readonly OpenItem[] = [
  {
    id: 'hr.levy.tourist-board-fee',
    area: 'company-law',
    title: 'Tourist board membership fee',
    status: 'unconfirmed',
    note: 'Whether the company\'s activity is on the payer list of the Zakon o članarinama u turističkim zajednicama (NN 52/19, 144/20) is unchecked. The NN 144/20 amendment does not hold the activity list. The fee would be a fraction of a percent of revenue. The accountant can say whether a nil form is filed.',
    url: null,
  },
  {
    id: 'hr.levy.forest-contribution',
    area: 'company-law',
    title: 'Forest contribution',
    status: 'unconfirmed',
    note: 'A revenue threshold exemption for the naknada za općekorisne funkcije šuma is known from secondary sources only. Load the act or ask the accountant to confirm the threshold.',
    url: null,
  },
  {
    id: 'hr.levy.hgk-fee',
    area: 'company-law',
    title: 'HGK membership fee',
    status: 'unconfirmed',
    note: 'The Croatian Chamber of Economy fee was never checked. Load the rule and the payer criteria, or ask the accountant.',
    url: null,
  },
]
