<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import UModal from '@nuxt/ui/components/Modal.vue'

import type { Grant } from '../../../../features/workbook/domain/grants'
import { useRowWrites } from '../../../../features/workbook/presentation/useRowWrites'
import { TEMPLATE_COLUMNS } from '../../../../features/workbook/infrastructure/workbookTemplate'
import { usePhoneLayout } from '../../../../shared/layout/viewport'
import type { Money } from '../../../../shared/money/money'
import { typedAmount } from '../../../../shared/money/typedAmount'
import { dayLabel } from '../../ruleset/presentation/ruleWording'
import { SCENARIO_ROWS, scenarioCells } from '../../application/scenarioRows'
import { startingScenarios } from '../../domain/scenarios/startingScenarios'

/** Writes the four starting scenarios for a year, and adds the scenarios tab first when the Sheet lacks it and the person says so. */
const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  year: number
  grants: readonly Grant[]
  /** The Sheet has no scenarios tab, so the write adds it. */
  tabMissing: boolean
  /** Every scenario name the tab uses. */
  taken: readonly string[]
}>()

const writes = useRowWrites(SCENARIO_ROWS)
const phone = usePhoneLayout()

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
const headers = TEMPLATE_COLUMNS.scenarios.map((column) => column.name).join(', ')

async function save(): Promise<void> {
  tried.value = true
  if (parsedRent.value === 'bad' || clash.value.length > 0) return
  const written = await writes.write(
    { added: scenarioCells(seeded.value.drafts), changed: [], removed: [] },
    { title: props.tabMissing ? 'Scenarios tab added' : 'Starting scenarios added', description: `${seeded.value.drafts.length} scenarios for ${props.year}, written to ${writes.where()}.` },
    'Not added',
    props.tabMissing,
  )
  if (written) open.value = false
}
</script>

<template>
  <UModal v-model:open="open" :title="`Add the starting scenarios for ${year}`" description="Each one is rows on the scenarios tab, editable here or in the Sheet." :fullscreen="phone" :ui="{ header: 'pe-16 sm:pe-6' }">
    <template #body>
      <form id="starting-scenarios" class="flex flex-col gap-4" data-testid="starting-scenarios-form" @submit.prevent="save">
        <ol class="flex list-decimal flex-col gap-1 ps-5 text-sm text-toned">
          <li v-for="draft in seeded.drafts" :key="draft.slug">{{ draft.label }}<span v-if="draft === seeded.drafts[0]" class="text-muted">, the base the others compare with</span></li>
        </ol>
        <p class="text-xs text-muted">
          Each pays out the rest of the year's profit as a dividend. The tax-free items use their yearly caps from the ruleset.
          <template v-if="seeded.switchOn !== null && seeded.switchOn > `${year}-01-01`"> The two that stop the salary stop it on {{ dayLabel(seeded.switchOn) }}, the day after the grants no longer require the employment.</template>
          <template v-else-if="seeded.switchOn === null"> No day of {{ year }} is free of the grants' employment condition, so the two that stop the salary are left out.</template>
        </p>
        <UFormField label="Monthly rent you charge the company" help="Your own figure, for the scenario with rent. Blank leaves the rent out." :error="(tried && parsedRent === 'bad' && 'An amount above zero with at most two decimals') || false">
          <UInput v-model="rent" inputmode="decimal" placeholder="0.00" class="w-full" data-testid="starting-rent" />
        </UFormField>
        <p v-if="clash.length > 0" class="text-sm text-error" role="alert">The tab already has {{ clash.join(', ') }}, so the starting scenarios for {{ year }} are there.</p>
        <div v-if="tabMissing" class="rounded-[var(--radius-control)] border border-default px-3 py-2 text-sm text-toned" data-testid="add-tab-notice">
          The Sheet has no scenarios tab. Adding these adds a tab named <span class="identifier">scenarios</span> with the headers <span class="identifier">{{ headers }}</span> in row 1, then
          writes the rows below them. Nothing else in the Sheet changes.
        </div>
      </form>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton label="Cancel" color="neutral" variant="ghost" :disabled="writes.busy.value" @click="open = false" />
        <UButton
          type="submit"
          form="starting-scenarios"
          :label="tabMissing ? 'Add the tab and the scenarios' : 'Add the scenarios'"
          icon="i-lucide-plus"
          :loading="writes.busy.value"
          :disabled="writes.busy.value"
          data-testid="starting-scenarios-save"
        />
      </div>
    </template>
  </UModal>
</template>
