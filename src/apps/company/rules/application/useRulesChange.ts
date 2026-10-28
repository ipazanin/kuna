import { computed } from 'vue'
import type { ComputedRef } from 'vue'

import { useWorkbook } from '../../workbook/application/workbookStore'
import { recordsOf } from '../../../../shared/storage/domain/recordsRead'
import type { Transaction } from '../../workbook/domain/workbook'
import { previewRulesChange } from '../domain/rulesChangePreview'
import type { RulesChangePreview } from '../domain/rulesChangePreview'
import type { RulesTabChange } from '../domain/rulesTabChange'
import { categorisationContextOf } from '../domain/transactionFacts'

/** The back-test and the checks of a rules change, kept current as the change is edited. Null without a workbook or a change. */
export function useRulesChangePreview(change: () => RulesTabChange | null): ComputedRef<RulesChangePreview<Transaction> | null> {
  const { state } = useWorkbook()
  return computed(() => {
    const workbook = state.workbook
    const records = state.records
    const pending = change()
    if (workbook === null || records === null || pending === null) {
      return null
    }
    const definedCategories = new Set(workbook.categories.map((category) => category.slug))
    return previewRulesChange(recordsOf(records.rules), pending, definedCategories, workbook.rules, workbook.transactions, categorisationContextOf(workbook))
  })
}
