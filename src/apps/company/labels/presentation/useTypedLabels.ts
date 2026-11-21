import { computed, ref } from 'vue'
import type { ComputedRef, Ref } from 'vue'

import { pickedWith, typedLabel } from '../../../../shared/categorising/domain/labels'
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
      const typed = typedLabel(name, choices.value, newLabel)
      refused.value = 'problem' in typed ? uiWords.labelName[typed.problem] : null
      if ('problem' in typed) return picked
      if (typed.made) created.value = [...created.value, typed.label]
      return pickedWith(picked, typed.label)
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
