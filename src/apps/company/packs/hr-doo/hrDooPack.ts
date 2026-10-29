import { defineAsyncComponent } from 'vue'
import type { RouteLocationRaw } from 'vue-router'

import type { PackContribution } from '../packContribution'
import { packPart } from '../../workbook/domain/packPart'
import { ACCOUNTANT_MAIL_SOURCES } from './application/accountantMailSources'
import { COMPANY_FACT_SETTINGS, companyFactsErrors } from './domain/companyFacts'
import { HR_DOO, HR_DOO_PART, hrDooWorkbook } from './domain/hrDooPart'
import { packWaitingJobs } from './presentation/packWaitingJobs'
import { unaccountedInView } from './presentation/unaccountedInView'

/** The pages that break the taxes and the owner pay further down than the spending breakdown. */
const COST_GROUP_LINKS: Readonly<Record<string, { readonly label: string; readonly to: RouteLocationRaw }>> = {
  taxes: { label: 'Year, Taxes', to: { path: '/company/year', query: { tab: 'taxes' } } },
  'owner-pay': { label: 'Owner, Taken', to: { path: '/company/owner' } },
}

/** The Croatian d.o.o. pack: owner pay, taxes, the accountant's year end, the assets and the employees, on core's screens and its own. */
export const hrDooPack: PackContribution = {
  workbook: HR_DOO_PART,
  screens: [
    { path: '/company/owner', title: 'Owner', icon: 'i-lucide-user-round', component: () => import('./presentation/OwnerScreen.vue') },
    { path: '/company/year', title: 'Year', icon: 'i-lucide-calendar-check', component: () => import('./presentation/year/YearScreen.vue') },
    { path: '/company/salaries', title: 'Salaries', icon: 'i-lucide-users', component: () => import('./presentation/salaries/SalariesScreen.vue') },
  ],
  waitingJobs: (workbook, asOf) => packWaitingJobs(hrDooWorkbook(workbook), asOf),
  reviewCards: [
    {
      component: defineAsyncComponent(() => import('./presentation/UnaccountedCard.vue')),
      shows: (ledger) => unaccountedInView(ledger).length > 0,
    },
  ],
  settingsTabs: [{ value: 'ruleset', label: 'Ruleset', icon: 'i-lucide-scale', component: defineAsyncComponent(() => import('./ruleset/presentation/RulesetPanel.vue')) }],
  settingsCards: [defineAsyncComponent(() => import('./presentation/LoanBucketSwitch.vue'))],
  companyFacts: {
    card: defineAsyncComponent(() => import('./presentation/CompanyFactsCard.vue')),
    factsOf: (workbook) => (workbook === null ? COMPANY_FACT_SETTINGS.defaults : hrDooWorkbook(workbook).companyFacts),
    errors: companyFactsErrors,
    withFacts: (workbook, facts) => {
      const part = packPart(workbook, HR_DOO)
      return part === null ? workbook : { ...workbook, packParts: { ...workbook.packParts, [HR_DOO.name]: { ...part, companyFacts: facts } } }
    },
  },
  costGroupLinks: (group) => COST_GROUP_LINKS[group] ?? null,
  mailSources: ACCOUNTANT_MAIL_SOURCES,
  onboarding: {
    question: 'Is this a Croatian d.o.o. that pays its owner?',
    yes: 'Yes, add owner pay, taxes and year end',
  },
}
