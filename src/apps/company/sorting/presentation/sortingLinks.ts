import type { RouteLocationRaw } from 'vue-router'

import type { Label } from '../../../../shared/categorising/domain/labels'
import { keyOfRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { LABEL_RECORDS } from '../../workbook/domain/coreKinds'

/** Categories, labels and the rules that file under them, on one screen with an anchor on each card. */
export const COMPANY_SORTING_ROUTE = '/company/sorting'

/** The anchors of the Sorting screen's cards. */
export const SORTING_CARDS = { categories: 'categories', labels: 'labels', rules: 'rules' } as const

/** The Categories card of Sorting. */
export const CATEGORIES_LINK = { path: COMPANY_SORTING_ROUTE, hash: `#${SORTING_CARDS.categories}` } as const satisfies RouteLocationRaw

/** The Rules card of Sorting. */
export const RULES_LINK = { path: COMPANY_SORTING_ROUTE, hash: `#${SORTING_CARDS.rules}` } as const satisfies RouteLocationRaw

/** One rule on the Rules card of Sorting, named by its id in `?rule=`, marked and scrolled to. It names no card anchor, which would scroll to the card's top instead. */
export function categoryRuleLink(ruleId: string): RouteLocationRaw {
  return { path: COMPANY_SORTING_ROUTE, query: { rule: ruleId } }
}

/** The Rules card showing only the rules that file under the category, named by its short name in `?category=`. */
export function rulesIntoCategoryLink(slug: string): RouteLocationRaw {
  return { ...RULES_LINK, query: { category: slug } }
}

/** The Rules card showing only the rules that put the label on, named by its bare id in `?label=`. */
export function rulesOfLabelLink(label: Pick<Label, 'id'>): RouteLocationRaw {
  return { ...RULES_LINK, query: { label: keyOfRecordId(LABEL_RECORDS, label.id) } }
}

/** The label id a page's `?label=` names, or null. */
export function labelIdNamed(key: unknown): RecordId | null {
  return typeof key === 'string' && key !== '' ? recordIdOf(LABEL_RECORDS, key) : null
}
