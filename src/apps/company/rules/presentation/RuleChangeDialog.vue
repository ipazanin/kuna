<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import { useWorkbook } from '../../workbook/application/workbookStore'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import AppDialog from '../../../../shared/ui/AppDialog.vue'
import { useRulesChangePreview } from '../application/useRulesChange'
import { writeRulesChange } from '../application/ruleWrites'
import type { RulesTabChange } from '../domain/rulesTabChange'
import RuleChangeReview from './RuleChangeReview.vue'
import { words } from './words'

export interface PendingRulesChange {
  readonly title: string
  readonly description: string
  readonly change: RulesTabChange
  /** The toast once it is written, with Undo, such as "Switched off merchant-telecom". */
  readonly saved: string
  readonly action: string
}

/** Switching a rule on or off, or moving it, with the same back-test and checks as an edit before it is saved. */
const props = defineProps<{
  pending: PendingRulesChange | null
}>()

const open = defineModel<boolean>('open', { required: true })

const { state } = useWorkbook()
const rulesWrites = useRecordWrites(useWorkbook())
const accepted = ref(false)

watch(
  () => props.pending,
  () => {
    accepted.value = false
  },
)

const preview = useRulesChangePreview(() => (open.value ? (props.pending?.change ?? null) : null))
const needsAcceptance = computed(() => (preview.value?.backtest.brokenAgreements.length ?? 0) + (preview.value?.backtest.humanConflicts.length ?? 0) > 0)
const canSave = computed(() => preview.value !== null && preview.value.refusals.length === 0 && (!needsAcceptance.value || accepted.value) && !rulesWrites.busy.value && !state.writing)

async function save(): Promise<void> {
  if (props.pending === null || !canSave.value) return
  const { change, saved } = props.pending
  if (await rulesWrites.write(saved, (unit) => writeRulesChange(unit, change), { failedTitle: words.editor.notSaved })) open.value = false
}
</script>

<template>
  <AppDialog v-model:open="open" width="2xl" :title="pending?.title ?? words.change.title" :description="pending?.description">
    <RuleChangeReview v-if="preview" v-model:accepted="accepted" :preview="preview" />
    <template #end>
      <UButton :label="words.change.cancel" color="neutral" variant="ghost" @click="open = false" />
      <UButton :label="pending?.action ?? words.change.save" icon="i-lucide-save" :loading="rulesWrites.busy.value" :disabled="!canSave" data-testid="save-rules-change" @click="save" />
    </template>
  </AppDialog>
</template>
