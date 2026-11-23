import { computed } from 'vue'
import type { ComputedRef } from 'vue'

import { useWorkbook } from '../../workbook/application/workbookStore'
import { recordsOf } from '../../../../shared/storage/domain/recordsRead'
import type { Transaction } from '../../workbook/domain/workbook'
import { previewRulesChange } from '../domain/rulesChangePreview'
import type { RulesChangePreview } from '../domain/rulesChangePreview'
import type { RulesTabChange } from '../domain/rulesTabChange'
import { categorisationContextOf } from '../domain/categorisationContext'
import { rowsOfOneItem } from '../../workbook/domain/splits'
import { storesItems } from '../../workbook/domain/rowItems'
import type { Label } from '../../../../shared/categorising/domain/labels'
import { ruleLabelIdsIn } from '../domain/readRules'

/**
 * The back-test and the checks of a rules change, kept current as the change is edited, with the rules naming `labels`, such as
 * the books' labels and those typed into the form. Null without a workbook or a change.
 */
export function useRulesChangePreview(change: () => RulesTabChange | null, labels: () => readonly Label[]): ComputedRef<RulesChangePreview<Transaction> | null> {
  const { state } = useWorkbook()
  return computed(() => {
    const workbook = state.workbook
    const records = state.records
    const pending = change()
    if (workbook === null || records === null || pending === null) {
      return null
    }
    const definedCategories = new Set(workbook.categories.map((category) => category.slug))
    return previewRulesChange(
      recordsOf(records.rules),
      pending,
      definedCategories,
      ruleLabelIdsIn(labels(), storesItems(records)),
      workbook.rules,
      rowsOfOneItem(workbook.transactions, workbook.splits),
      categorisationContextOf(workbook),
    )
  })
}
