import { ref } from 'vue'

import type { Grouping } from '../domain/transactionGroups'

// Kept outside the screen so a collapsed group stays collapsed while the filters change, for the whole visit.
const collapsedKeys = ref(new Set<string>())

export interface CollapsedGroups {
  isCollapsed(key: string): boolean
  toggle(key: string): void
  collapseAll(keys: Iterable<string>): void
  expandAll(): void
}

/** Which groups of one grouping are collapsed. A key belongs to its grouping, so a month never collapses a category. */
export function useCollapsedGroups(grouping: () => Grouping): CollapsedGroups {
  const prefixed = (key: string): string => `${grouping()}:${key}`
  return {
    isCollapsed: (key) => collapsedKeys.value.has(prefixed(key)),
    toggle(key) {
      const scoped = prefixed(key)
      if (!collapsedKeys.value.delete(scoped)) collapsedKeys.value.add(scoped)
    },
    collapseAll(keys) {
      for (const key of keys) collapsedKeys.value.add(prefixed(key))
    },
    expandAll() {
      for (const key of [...collapsedKeys.value]) {
        if (key.startsWith(prefixed(''))) collapsedKeys.value.delete(key)
      }
    },
  }
}
