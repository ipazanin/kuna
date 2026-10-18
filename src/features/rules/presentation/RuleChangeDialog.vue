<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UModal from '@nuxt/ui/components/Modal.vue'

import { usePhoneLayout } from '../../../shared/layout/viewport'
import { useWorkbook } from '../../workbook/application/workbookStore'
import { useRulesChangePreview, useRulesWrites } from '../application/useRulesChange'
import type { RulesTabChange } from '../domain/rulesTabChange'
import RuleChangeReview from './RuleChangeReview.vue'

export interface PendingRulesChange {
  readonly title: string
  readonly description: string
  readonly change: RulesTabChange
  /** The toast once it is written, such as "Switched off merchant-telecom". */
  readonly saved: string
  readonly action: string
}

/** Switching a rule on or off, or moving it, with the same back-test and checks as an edit before it is saved. */
const props = defineProps<{
  pending: PendingRulesChange | null
}>()

const open = defineModel<boolean>('open', { required: true })

const { state } = useWorkbook()
const phone = usePhoneLayout()
const rulesWrites = useRulesWrites()
const accepted = ref(false)

watch(
  () => props.pending,
  () => {
    accepted.value = false
  },
)

const preview = useRulesChangePreview(() => (open.value ? (props.pending?.change ?? null) : null))
const needsAcceptance = computed(() => (preview.value?.backtest.brokenAgreements.length ?? 0) + (preview.value?.backtest.humanConflicts.length ?? 0) > 0)
const canSave = computed(
  () => preview.value !== null && preview.value.refusals.length === 0 && (!needsAcceptance.value || accepted.value) && !rulesWrites.saving.value && !state.writing,
)

async function save(): Promise<void> {
  if (props.pending === null || !canSave.value) return
  if (await rulesWrites.save(props.pending.change, props.pending.saved)) open.value = false
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="pending?.title ?? 'Change the rules'"
    v-bind="pending ? { description: pending.description } : {}"
    :fullscreen="phone"
    :ui="{ content: 'sm:max-w-2xl', header: 'pe-16 sm:pe-6', footer: 'pb-[max(1rem,env(safe-area-inset-bottom))]' }"
  >
    <template #body>
      <RuleChangeReview v-if="preview" v-model:accepted="accepted" :preview="preview" />
    </template>
    <template #footer>
      <div class="flex w-full flex-wrap justify-end gap-2">
        <UButton label="Cancel" color="neutral" variant="ghost" @click="open = false" />
        <UButton :label="pending?.action ?? 'Save'" icon="i-lucide-save" :loading="rulesWrites.saving.value" :disabled="!canSave" data-testid="save-rules-change" @click="save" />
      </div>
    </template>
  </UModal>
</template>
