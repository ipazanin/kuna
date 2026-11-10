import { defineAsyncComponent } from 'vue'
import type { RouteLocationRaw } from 'vue-router'

import type { PackContribution } from '../packContribution'
import { COMPANY_FACT_SETTINGS, companyFactsErrors } from './domain/companyFacts'
import { recordsOfKindIn } from '../../workbook/domain/readWorkbook'
import { linkAssetsToRows } from './application/assetLinkWrites'
import { EMPLOYEE_RECORDS } from './domain/hrDooKinds'
import { HR_DOO_PART, hrDooWorkbook } from './domain/hrDooPart'
import { tripRatesDemand } from './domain/trips/tripSettlement'
import { ruleValue } from './ruleset/ruleset'
import { unaccountedInView } from './domain/ownerAdvances'
import { ownerTakeOut } from './presentation/ownerTakeOut'
import { packWaitingJobs } from './presentation/packWaitingJobs'
import { TRIPS_ROUTE } from './presentation/trips/tripLinks'
import { categoriesToSort } from './preset/presentation/categoriesToSort'
import { categoryClassHelp } from './preset/presentation/categoryClassHelp'
import { categoryNamingWords } from './presentation/categoryNamingWords'
import { words as packWords } from './presentation/words'
import { TAX_RULES_TAB } from './ruleset/presentation/taxRuleLinks'
import { words as rulesetWords } from './ruleset/presentation/words'

/** The pages that break the taxes and the owner pay further down than the spending breakdown. */
const COST_GROUP_LINKS: Readonly<Record<string, { readonly label: string; readonly to: RouteLocationRaw }>> = {
  taxes: { label: packWords.links.yearTaxes, to: { path: '/company/year', query: { tab: 'taxes' } } },
  'owner-pay': { label: packWords.links.ownerTaken, to: { path: '/company/owner' } },
}

/** The Croatian d.o.o. pack: owner pay, taxes, the accountant's year end, the assets and the employees, on core's screens and its own. */
export const hrDooPack: PackContribution = {
  workbook: HR_DOO_PART,
  screens: [
    { path: '/company/owner', title: packWords.screens.owner, icon: 'i-lucide-user-round', component: () => import('./presentation/OwnerScreen.vue') },
    { path: '/company/year', title: packWords.screens.year, icon: 'i-lucide-calendar-check', component: () => import('./presentation/year/YearScreen.vue') },
    { path: '/company/salaries', title: packWords.screens.salaries, icon: 'i-lucide-users', component: () => import('./presentation/salaries/SalariesScreen.vue') },
    { path: TRIPS_ROUTE, title: packWords.screens.trips, icon: 'i-lucide-plane', component: () => import('./presentation/trips/TripsScreen.vue') },
  ],
  waitingJobs: (workbook, asOf) => packWaitingJobs(hrDooWorkbook(workbook), asOf),
  ownerTakeOut: (workbook, asOf) => ownerTakeOut(hrDooWorkbook(workbook), asOf),
  ratesDemand: (workbook) =>
    tripRatesDemand(
      hrDooWorkbook(workbook).trips.map((file) => file.trip),
      ruleValue,
    ),
  reviewCards: [
    {
      component: defineAsyncComponent(() => import('./presentation/UnaccountedCard.vue')),
      shows: (ledger) => unaccountedInView(ledger.booked, ledger.filters).length > 0,
    },
  ],
  settingsTabs: [{ value: TAX_RULES_TAB, label: rulesetWords.tab, icon: 'i-lucide-scale', component: defineAsyncComponent(() => import('./ruleset/presentation/RulesetPanel.vue')) }],
  settingsCards: [defineAsyncComponent(() => import('./presentation/LoanBucketSwitch.vue'))],
  companyFacts: {
    card: defineAsyncComponent(() => import('./presentation/CompanyFactsCard.vue')),
    factsOf: (workbook) => (workbook === null ? COMPANY_FACT_SETTINGS.defaults : hrDooWorkbook(workbook).companyFacts),
    errors: companyFactsErrors,
  },
  costGroupLinks: (group) => COST_GROUP_LINKS[group] ?? null,
  categoryClassHelp,
  categoriesToSort,
  categoryNamingWords,
  onboarding: packWords.onboarding,
  // The records, not the workbook's employees, which drop an IBAN two of them share and a row listed twice.
  linkToRows: linkAssetsToRows,
  employees: (records) => recordsOfKindIn(records, EMPLOYEE_RECORDS).records.map(({ record }) => ({ name: record.name || record.slug, employee: true, ibans: record.ibans })),
}
