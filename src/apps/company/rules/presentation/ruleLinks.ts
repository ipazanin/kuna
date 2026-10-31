import type { RouteLocationRaw } from 'vue-router'

/** The Category rules tab's value in `?tab=` on Settings. */
export const CATEGORY_RULES_TAB = 'category-rules'

/** One rule on the Category rules tab of Settings, marked and scrolled to. */
export function categoryRuleLink(ruleId: string): RouteLocationRaw {
  return { path: '/company/settings', query: { tab: CATEGORY_RULES_TAB, rule: ruleId } }
}
