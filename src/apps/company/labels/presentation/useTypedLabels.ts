import { computed, ref } from 'vue'
import type { ComputedRef, Ref } from 'vue'

import { labelCalled, labelNameProblem } from '../../../../shared/categorising/domain/labels'
import type { Label } from '../../../../shared/categorising/domain/labels'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { useWorkbook } from '../../workbook/application/workbookStore'
import { addLabel } from '../application/labelWrites'
import { newLabel } from '../domain/labels'
import { words as uiWords } from '../../../../shared/ui/words'

/** The labels a Company dialog offers, with the new ones typed into its labels select, which its write adds beside what it labels. */
export interface TypedLabels {
  /** The books' labels and those typed so far. */
  readonly choices: ComputedRef<readonly Label[]>
  /** Why the name typed last cannot be a label, or null. */
  readonly refused: Ref<string | null>
  /** The picked labels with the one a name typed picks: a label of that name, or a new one, unless the name cannot be a label's. */
  withTyped(picked: readonly RecordId[], name: string): readonly RecordId[]
  /** Adds, in the write, the typed labels that something it writes carries. */
  addCarried(unit: UnitOfWork, carried: ReadonlySet<RecordId>): void
  /** Forgets what was typed, as a dialog does when it opens again. */
  forget(): void
}

export function useTypedLabels(): TypedLabels {
  const { state } = useWorkbook()
  const created = ref<readonly Label[]>([])
  const refused = ref<string | null>(null)
  const choices = computed(() => [...(state.workbook?.labels ?? []), ...created.value])
  return {
    choices,
    refused,
    withTyped(picked, name) {
      const held = labelCalled(name, choices.value)
      const problem = held === null ? labelNameProblem(name, choices.value, null) : null
      refused.value = problem === null ? null : uiWords.labelName[problem]
      if (held !== null) return picked.includes(held.id) ? picked : [...picked, held.id]
      if (problem !== null) return picked
      const label = newLabel(name)
      created.value = [...created.value, label]
      return [...picked, label.id]
    },
    addCarried(unit, carried) {
      created.value.filter((label) => carried.has(label.id)).forEach((label) => addLabel(unit, label))
    },
    forget() {
      created.value = []
      refused.value = null
    },
  }
}
