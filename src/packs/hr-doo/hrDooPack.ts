import { defineAsyncComponent } from 'vue'
import type { RouteLocationRaw } from 'vue-router'

import type { PackContribution } from '../../features/packs/packContribution'
import { COMPANY_FACT_SETTINGS, companyFactsErrors } from './domain/companyFacts'
import { HR_DOO_PART, hrDooWorkbook } from './domain/hrDooPart'
import { packWaitingJobs } from './presentation/packWaitingJobs'
import { unaccountedInView } from './presentation/unaccountedInView'

/** The pages that break the taxes and the owner pay further down than the spending breakdown. */
const COST_GROUP_LINKS: Readonly<Record<string, { readonly label: string; readonly to: RouteLocationRaw }>> = {
  taxes: { label: 'Year, Taxes', to: { path: '/year', query: { tab: 'taxes' } } },
  'owner-pay': { label: 'Owner, Taken', to: { path: '/owner' } },
}

/** The Croatian d.o.o. pack: owner pay, taxes, the accountant's year end, the assets and the employees, on core's screens and its own. */
export const hrDooPack: PackContribution = {
  workbook: HR_DOO_PART,
  screens: [
    { path: '/owner', title: 'Owner', icon: 'i-lucide-user-round', component: () => import('./presentation/OwnerScreen.vue') },
    { path: '/year', title: 'Year', icon: 'i-lucide-calendar-check', component: () => import('./presentation/year/YearScreen.vue') },
    { path: '/salaries', title: 'Salaries', icon: 'i-lucide-users', component: () => import('./presentation/salaries/SalariesScreen.vue') },
  ],
  waitingJobs: (workbook, asOf) => packWaitingJobs(hrDooWorkbook(workbook), asOf),
  reviewCards: [
    {
      component: defineAsyncComponent(() => import('./presentation/UnaccountedCard.vue')),
      shows: (ledger) => unaccountedInView(ledger).length > 0,
    },
  ],
  settingsTabs: [
    { value: 'ruleset', label: 'Ruleset', icon: 'i-lucide-scale', component: defineAsyncComponent(() => import('./ruleset/presentation/RulesetPanel.vue')) },
  ],
  settingsCards: [defineAsyncComponent(() => import('./presentation/LoanBucketSwitch.vue'))],
  companyFacts: {
    card: defineAsyncComponent(() => import('./presentation/CompanyFactsCard.vue')),
    factsOf: (workbook) => (workbook === null ? COMPANY_FACT_SETTINGS.defaults : hrDooWorkbook(workbook).companyFacts),
    errors: companyFactsErrors,
  },
  costGroupLinks: (group) => COST_GROUP_LINKS[group] ?? null,
  syncSteps: [
    {
      id: 'hr-doo.accountant',
      label: 'Accountant',
      scope: 'drive.readonly',
      startLine: 'Reading the accountant’s files',
      on: (workbook) => hrDooWorkbook(workbook).companyFacts.accountantSync,
      // Loaded with its first run, so the readers of the accountant's files stay out of the pack's entry chunk.
      run: async () => (await import('./presentation/taxes/useAccountantDocuments')).readAccountantFiles(),
    },
  ],
}
