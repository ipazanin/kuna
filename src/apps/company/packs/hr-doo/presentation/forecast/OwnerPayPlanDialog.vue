<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UCheckbox from '@nuxt/ui/components/Checkbox.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import USelect from '@nuxt/ui/components/Select.vue'

import type { OwnerPayScenario } from '../../domain/scenarios/ownerPayScenarios'
import { scenarioName } from '../../domain/scenarios/startingScenarios'
import type { PlanLine } from '../../domain/forecast/plan'
import { civilDate, parseCivilDate, yearOf } from '../../../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../../../shared/calendar/civilDate'
import AppDialog from '../../../../../../shared/ui/AppDialog.vue'
import { ownerPayPlanLine, replacePlanLines } from '../../application/planWrites'
import type { KeyedLine } from '../../application/planWrites'
import { usePlanWrites } from './usePlanWrites'
import { words } from './words'

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

const first = ref('')
const switching = ref(false)
const second = ref('')
const switchOn = ref('')
const tried = ref(false)

const choices = computed(() => props.scenarios.map((scenario) => ({ label: scenarioName(scenario), value: scenario.slug })))

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
  first: first.value === '' ? words.planDialogs.ownerPay.firstError : null,
  second: switching.value && (second.value === '' || second.value === first.value) ? words.planDialogs.ownerPay.secondError : null,
  switchOn: switching.value && (day.value === null || yearOf(day.value) !== props.year || day.value === civilDate(props.year, 1, 1)) ? words.planDialogs.ownerPay.switchOnError(props.year) : null,
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
  if (
    await writes.write(words.planDialogs.ownerPay.planned, (lines) => replacePlanLines(lines, holding, wanted), {
      description: words.planDialogs.ownerPay.forYear(props.year),
      failedTitle: words.planDialogs.notSaved,
    })
  )
    open.value = false
}

async function clear(): Promise<void> {
  const holding = held()
  if (
    await writes.write(words.planDialogs.ownerPay.cleared, (lines) => replacePlanLines(lines, holding, []), {
      description: words.planDialogs.ownerPay.clearedDescription(props.year),
      failedTitle: words.planDialogs.notCleared,
    })
  )
    open.value = false
}
</script>

<template>
  <AppDialog v-model:open="open" :title="words.planDialogs.ownerPay.title(year)" :description="words.planDialogs.ownerPay.description">
    <form id="owner-pay-plan" class="flex flex-col gap-4" data-testid="owner-pay-plan-form" @submit.prevent="save">
      <UFormField :label="words.planDialogs.ownerPay.fromJanuary" :error="(tried && errors.first) || false">
        <USelect v-model="first" :items="choices" class="w-full" data-testid="owner-pay-first" />
      </UFormField>
      <UFormField :help="words.planDialogs.ownerPay.switchHelp">
        <UCheckbox v-model="switching" :label="words.planDialogs.ownerPay.switch" data-testid="owner-pay-switch" />
      </UFormField>
      <template v-if="switching">
        <UFormField :label="words.planDialogs.ownerPay.then" :error="(tried && errors.second) || false">
          <USelect v-model="second" :items="choices" class="w-full" data-testid="owner-pay-second" />
        </UFormField>
        <UFormField
          :label="words.planDialogs.ownerPay.from"
          :error="(tried && errors.switchOn) || false"
          :help="suggestedSwitch === null ? words.planDialogs.ownerPay.switchOnHelp : words.planDialogs.ownerPay.switchOnSuggested"
        >
          <UInput v-model="switchOn" type="date" class="w-full" data-testid="owner-pay-switch-on" />
        </UFormField>
      </template>
    </form>
    <template #start>
      <UButton
        v-if="lines.length > 0"
        :label="words.planDialogs.ownerPay.stop"
        icon="i-lucide-eraser"
        color="error"
        variant="ghost"
        :disabled="writes.busy.value"
        data-testid="owner-pay-clear"
        @click="clear"
      />
    </template>
    <template #end>
      <UButton :label="words.planDialogs.cancel" color="neutral" variant="ghost" :disabled="writes.busy.value" @click="open = false" />
      <UButton
        type="submit"
        form="owner-pay-plan"
        :label="words.planDialogs.ownerPay.save"
        icon="i-lucide-save"
        :loading="writes.busy.value"
        :disabled="writes.busy.value"
        data-testid="owner-pay-save"
      />
    </template>
  </AppDialog>
</template>
