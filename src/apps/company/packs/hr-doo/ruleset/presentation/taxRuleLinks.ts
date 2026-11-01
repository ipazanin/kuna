import type { RouteLocationRaw } from 'vue-router'

import type { RuleId } from '../ruleset'

/** The Tax rules tab's value in `?tab=` on Settings. */
export const TAX_RULES_TAB = 'tax-rules'

/** Where a figure links to show the rule it rests on. */
export function ruleLink(ruleId: RuleId): RouteLocationRaw {
  return { path: '/company/settings', query: { tab: TAX_RULES_TAB, rule: ruleId } }
}
