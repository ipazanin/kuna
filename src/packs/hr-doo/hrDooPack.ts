import { defineAsyncComponent } from 'vue'
import type { RouteLocationRaw } from 'vue-router'

import type { PackContribution } from '../../features/packs/packContribution'
import { COMPANY_FACT_SETTINGS, companyFactsErrors } from './domain/companyFacts'
import type { CompanyFacts } from './domain/companyFacts'
import { HR_DOO_PART, hrDooWorkbook } from './domain/hrDooPart'
import { packWaitingJobs } from './presentation/packWaitingJobs'
import { unaccountedInView } from './presentation/unaccountedInView'
import { findLocalUnit } from './ruleset/localUnits'

/** The pages that break the taxes and the owner pay further down than the spending breakdown. */
const COST_GROUP_LINKS: Readonly<Record<string, { readonly label: string; readonly to: RouteLocationRaw }>> = {
  taxes: { label: 'Year, Taxes', to: { path: '/year', query: { tab: 'taxes' } } },
  'owner-pay': { label: 'Owner, Taken', to: { path: '/owner' } },
}

/** The Croatian d.o.o. pack: owner pay, taxes, the accountant's year end and the assets, on core's screens and its own. */
export const hrDooPack: PackContribution = {
  workbook: HR_DOO_PART,
  screens: [
    { path: '/owner', title: 'Owner', icon: 'i-lucide-user-round', component: () => import('./presentation/OwnerScreen.vue') },
    { path: '/year', title: 'Year', icon: 'i-lucide-calendar-check', component: () => import('./presentation/year/YearScreen.vue') },
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
    // The workbook keeps the city as text, so a name typed there can be one the lookup refuses. Blank stays allowed.
    errors: (facts: CompanyFacts) => {
      const city = facts.residenceCity.trim()
      const problem = city === '' ? null : findLocalUnit(city).problem
      return { ...companyFactsErrors(facts), ...(problem === null ? {} : { residenceCity: problem }) }
    },
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
