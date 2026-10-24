<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UCheckbox from '@nuxt/ui/components/Checkbox.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import UModal from '@nuxt/ui/components/Modal.vue'
import USelect from '@nuxt/ui/components/Select.vue'

import type { OwnerPayScenario } from '../../domain/scenarios/ownerPayScenarios'
import type { PlanLine } from '../../domain/forecast/plan'
import { civilDate, parseCivilDate, yearOf } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { usePhoneLayout } from '../../../../shared/layout/viewport'
import { ownerPayPlanLine, replacePlanLines } from '../../application/planWrites'
import type { KeyedLine } from '../../application/planWrites'
import { usePlanWrites } from './usePlanWrites'

type OwnerPayLine = Extract<PlanLine, { readonly kind: 'owner-pay-scenario' }>

/** The year's owner pay: one scenario, or one until a day and another from it. */
const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  year: number
  /** The scenarios of the year, from the scenarios tab. */
  scenarios: readonly OwnerPayScenario[]
  lines: readonly OwnerPayLine[]
  /** The day the grants stop requiring the employment, suggested as the switch day. Null when no grant binds the year. */
  suggestedSwitch: CivilDate | null
}>()

const writes = usePlanWrites()
const phone = usePhoneLayout()

const first = ref('')
const switching = ref(false)
const second = ref('')
const switchOn = ref('')
const tried = ref(false)

const choices = computed(() => props.scenarios.map((scenario) => ({ label: scenario.label || scenario.slug, value: scenario.slug })))

watch(
  open,
  (opened) => {
    if (!opened) return
    const opening = props.lines.find((line) => line.from === null)
    const switched = props.lines.find((line) => line.from !== null)
    first.value = opening?.scenario ?? props.scenarios[0]?.slug ?? ''
    switching.value = switched !== undefined
    second.value = switched?.scenario ?? props.scenarios.find((scenario) => scenario.slug !== first.value)?.slug ?? ''
    switchOn.value = switched?.from ?? props.suggestedSwitch ?? ''
    tried.value = false
  },
  { immediate: true },
)

const day = computed((): CivilDate | null => parseCivilDate(switchOn.value.trim()))
const errors = computed(() => ({
  first: first.value === '' ? 'Choose the scenario the year starts with' : null,
  second: switching.value && (second.value === '' || second.value === first.value) ? 'Choose another scenario' : null,
  switchOn:
    switching.value && (day.value === null || yearOf(day.value) !== props.year || day.value === civilDate(props.year, 1, 1)) ? `A day in ${props.year} after 1 January` : null,
}))
const valid = computed(() => Object.values(errors.value).every((error) => error === null))

function held(): KeyedLine<PlanLine>[] {
  return props.lines.flatMap((line) => {
    const stored = writes.stored(line)
    return stored === null ? [] : [{ key: line.from === null ? 'opening' : 'switch', line: stored }]
  })
}

async function save(): Promise<void> {
  tried.value = true
  if (!valid.value) return
  const wanted = [
    { key: 'opening', line: ownerPayPlanLine(props.year, first.value, null) },
    ...(switching.value && day.value !== null ? [{ key: 'switch', line: ownerPayPlanLine(props.year, second.value, day.value) }] : []),
  ]
  const holding = held()
  if (await writes.write('Owner pay planned', (lines) => replacePlanLines(lines, holding, wanted), { description: `For ${props.year}.`, failedTitle: 'Not saved' })) open.value = false
}

async function clear(): Promise<void> {
  const holding = held()
  if (await writes.write('Owner pay plan cleared', (lines) => replacePlanLines(lines, holding, []), { description: `The owner pay categories of ${props.year} take their averages again.`, failedTitle: 'Not cleared' })) open.value = false
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="`Owner pay for ${year}`"
    description="The scenario the forecast takes the salary, its contributions, the tax-free items and the rent from. Its dividend is left out, since the plan sets the payout on its own row."
    :fullscreen="phone"
    :ui="{ header: 'pe-16 sm:pe-6' }"
  >
    <template #body>
      <form id="owner-pay-plan" class="flex flex-col gap-4" data-testid="owner-pay-plan-form" @submit.prevent="save">
        <UFormField label="From 1 January" :error="(tried && errors.first) || false">
          <USelect v-model="first" :items="choices" class="w-full" data-testid="owner-pay-first" />
        </UFormField>
        <UFormField help="Such as the floor salary while a grant requires the employment, and another scenario after.">
          <UCheckbox v-model="switching" label="Switch to another scenario on a day" data-testid="owner-pay-switch" />
        </UFormField>
        <template v-if="switching">
          <UFormField label="Then" :error="(tried && errors.second) || false">
            <USelect v-model="second" :items="choices" class="w-full" data-testid="owner-pay-second" />
          </UFormField>
          <UFormField label="From" :error="(tried && errors.switchOn) || false" :help="suggestedSwitch === null ? 'The second scenario takes over on this day.' : 'Starts on the day after the grants stop requiring the employment.'">
            <UInput v-model="switchOn" type="date" class="w-full" data-testid="owner-pay-switch-on" />
          </UFormField>
        </template>
      </form>
    </template>
    <template #footer>
      <div class="flex w-full flex-wrap items-center gap-2">
        <UButton v-if="lines.length > 0" label="Stop planning it" icon="i-lucide-eraser" color="error" variant="ghost" :disabled="writes.busy.value" data-testid="owner-pay-clear" @click="clear" />
        <div class="ms-auto flex flex-wrap gap-2">
          <UButton label="Cancel" color="neutral" variant="ghost" :disabled="writes.busy.value" @click="open = false" />
          <UButton type="submit" form="owner-pay-plan" label="Save owner pay" icon="i-lucide-save" :loading="writes.busy.value" :disabled="writes.busy.value" data-testid="owner-pay-save" />
        </div>
      </div>
    </template>
  </UModal>
</template>
