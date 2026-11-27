<script setup lang="ts">
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'

import { periodFieldId } from './periodFieldId'
import { words } from './words'
import type { PeriodDraft } from '../domain/periodDrafts'
import type { SpendingSource } from '../../workbook/domain/account'
import ChoiceButtons from '../../../../shared/ui/ChoiceButtons.vue'
import DayField from '../../../../shared/ui/DayField.vue'

/** Where an account's rows come from, one source for each run of days, with a later source added or removed. */
const periods = defineModel<readonly PeriodDraft[]>({ required: true })

const props = defineProps<{
  options: readonly SpendingSource[]
  /** Why each period cannot be kept, null for one that can, in the order of the periods. */
  errors: readonly (string | null)[]
}>()

const choices = (): readonly { readonly value: SpendingSource; readonly label: string }[] => props.options.map((source) => ({ value: source, label: words.rowsFrom[source] }))

function changed(place: number, change: Partial<PeriodDraft>): void {
  periods.value = periods.value.map((period, at) => (at === place ? { ...period, ...change } : period))
}

function add(): void {
  const last = periods.value[periods.value.length - 1]
  const source = props.options.find((option) => option !== last?.source) ?? props.options[0]!
  periods.value = [...periods.value, { source, from: '' }]
}

function remove(place: number): void {
  periods.value = periods.value.filter((_period, at) => at !== place)
}
</script>

<template>
  <div class="flex flex-col gap-3" data-testid="spending-account-sources">
    <div v-for="(period, place) in periods" :key="place" class="flex flex-col gap-2" role="group" :aria-label="words.rowsFromChoice.sourceOf(place + 1)">
      <ChoiceButtons
        :model-value="period.source"
        :options="choices()"
        :label="words.rowsFromChoice.sourceOf(place + 1)"
        :data-testid="place === 0 ? 'spending-account-rows-from' : 'spending-account-source'"
        @update:model-value="changed(place, { source: $event })"
      />
      <p v-if="place === 0 && periods.length > 1" class="type-caption">{{ words.rowsFromChoice.fromStart }}</p>
      <p v-if="place === 0 && errors[0]" class="type-caption text-error">{{ errors[0] }}</p>
      <UFormField v-if="place > 0" :id="periodFieldId(place)" :label="words.rowsFromChoice.from" :error="errors[place] ?? false">
        <div class="flex items-center gap-2">
          <DayField :model-value="period.from" class="min-w-0 flex-1" data-testid="spending-account-source-from" @update:model-value="changed(place, { from: $event })" />
          <UButton
            icon="i-lucide-x"
            color="neutral"
            variant="ghost"
            class="min-h-11 min-w-11 shrink-0 justify-center"
            :aria-label="words.rowsFromChoice.remove"
            data-testid="spending-account-source-remove"
            @click="remove(place)"
          />
        </div>
      </UFormField>
    </div>
    <UButton :label="words.rowsFromChoice.add" icon="i-lucide-plus" color="neutral" variant="outline" size="sm" class="self-start" data-testid="spending-account-source-add" @click="add" />
  </div>
</template>
