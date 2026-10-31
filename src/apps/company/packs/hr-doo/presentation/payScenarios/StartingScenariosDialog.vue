<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'

import { dayLabel } from '../../../../../../shared/calendar/dayLabel'
import type { Grant } from '../../domain/grants/grants'
import { useWorkbook } from '../../../../workbook/application/workbookStore'
import { useRecordWrites } from '../../../../../../shared/storage/presentation/useRecordWrites'
import type { Money } from '../../../../../../shared/money/money'
import { typedAmount } from '../../../../../../shared/money/typedAmount'
import AppDialog from '../../../../../../shared/ui/AppDialog.vue'
import { scenarioRowsOf } from '../../application/scenarioWrites'
import { SCENARIO_WRITES } from '../../domain/hrDooWrites'
import { scenarioName, startingScenarios } from '../../domain/scenarios/startingScenarios'
import { words } from './words'

/** Writes the four starting scenarios for a year. */
const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  year: number
  grants: readonly Grant[]
  /** Every scenario name the tab uses. */
  taken: readonly string[]
}>()

const writes = useRecordWrites(useWorkbook())

const rent = ref('')
const tried = ref(false)

watch(open, (opened) => {
  if (opened) {
    rent.value = ''
    tried.value = false
  }
})

/** Blank leaves the rent out. */
const parsedRent = computed((): Money | null | 'bad' => {
  if (rent.value.trim() === '') return null
  const cents = typedAmount(rent.value)
  return cents !== null && cents > 0 ? cents : 'bad'
})

const seeded = computed(() => startingScenarios(props.year, props.grants, parsedRent.value === 'bad' ? null : parsedRent.value))
const clash = computed(() => seeded.value.drafts.filter((draft) => props.taken.includes(draft.slug)).map((draft) => draft.slug))

async function save(): Promise<void> {
  tried.value = true
  if (parsedRent.value === 'bad' || clash.value.length > 0) return
  const rows = scenarioRowsOf(seeded.value.drafts)
  const written = await writes.write(words.startingDialog.added, (unit) => rows.forEach((row) => unit.of(SCENARIO_WRITES).add(row)), {
    description: words.startingDialog.addedDescription(seeded.value.drafts.length, props.year),
    failedTitle: words.startingDialog.notAdded,
  })
  if (written) open.value = false
}
</script>

<template>
  <AppDialog v-model:open="open" :title="words.startingDialog.title(year)" :description="words.startingDialog.description">
    <form id="starting-scenarios" class="flex flex-col gap-4" data-testid="starting-scenarios-form" @submit.prevent="save">
      <ol class="flex list-decimal flex-col gap-1 ps-5 text-sm text-toned">
        <li v-for="draft in seeded.drafts" :key="draft.slug">
          {{ scenarioName(draft) }}<span v-if="draft === seeded.drafts[0]" class="text-muted">{{ words.startingDialog.theBase }}</span>
        </li>
      </ol>
      <p class="text-xs text-muted">
        {{ words.startingDialog.eachPaysOut }}<template v-if="seeded.switchOn !== null && seeded.switchOn > `${year}-01-01`">{{ words.startingDialog.stopOn(dayLabel(seeded.switchOn)) }}</template
        ><template v-else-if="seeded.switchOn === null">{{ words.startingDialog.noFreeDay(year) }}</template>
      </p>
      <UFormField :label="words.startingDialog.rent" :help="words.startingDialog.rentHelp" :error="(tried && parsedRent === 'bad' && words.startingDialog.rentError) || false">
        <UInput v-model="rent" inputmode="decimal" :placeholder="words.startingDialog.amountPlaceholder" class="w-full" data-testid="starting-rent" />
      </UFormField>
      <p v-if="clash.length > 0" class="text-sm text-error" role="alert">{{ words.startingDialog.clash(clash.join(', '), year) }}</p>
    </form>
    <template #end>
      <UButton :label="words.startingDialog.cancel" color="neutral" variant="ghost" :disabled="writes.busy.value" @click="open = false" />
      <UButton
        type="submit"
        form="starting-scenarios"
        :label="words.startingDialog.add"
        icon="i-lucide-plus"
        :loading="writes.busy.value"
        :disabled="writes.busy.value"
        data-testid="starting-scenarios-save"
      />
    </template>
  </AppDialog>
</template>
