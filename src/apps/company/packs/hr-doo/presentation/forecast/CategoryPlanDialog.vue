<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'

import type { PlanLine } from '../../domain/forecast/plan'
import type { Money } from '../../../../../../shared/money/money'
import { formatMoney } from '../../../../../../shared/money/moneyFormat'
import { categoryPlanLine, replacePlanLines } from '../../application/planWrites'
import type { KeyedLine } from '../../application/planWrites'
import { fieldAmount, monthsOf } from './planWording'
import { typedAmount } from '../../../../../../shared/money/typedAmount'
import AppDialog from '../../../../../../shared/ui/AppDialog.vue'
import { usePlanWrites } from './usePlanWrites'

type AmountLine = Extract<PlanLine, { readonly kind: 'amount' }>

/** A category's plan for a year: one amount for every month, and any month of its own. */
const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  year: number
  slug: string
  name: string
  /** What a month with no plan row takes, signed as booked. Null when the ledger gives none. */
  average: Money | null
  /** How the average is taken, such as "Average of the 12 months from Oct 2025 to Sep 2026". */
  averageWords: string | null
  lines: readonly AmountLine[]
}>()

const writes = usePlanWrites()

const every = ref('')
const months = ref<string[]>(Array.from({ length: 12 }, () => ''))
const tried = ref(false)

const calendar = computed(() => monthsOf(props.year))

watch(
  open,
  (opened) => {
    if (!opened) return
    const everyRow = props.lines.find((line) => line.month === null)
    every.value = everyRow !== undefined ? fieldAmount(everyRow.amount) : props.lines.length === 0 && props.average !== null ? fieldAmount(props.average) : ''
    months.value = calendar.value.map((month) => {
      const row = props.lines.find((line) => line.month === month.number)
      return row === undefined ? '' : fieldAmount(row.amount)
    })
    tried.value = false
  },
  { immediate: true },
)

const wrong = (text: string) => text.trim() !== '' && typedAmount(text) === null
const errors = computed(() => ({ every: wrong(every.value), months: months.value.map(wrong) }))
const valid = computed(() => !errors.value.every && !errors.value.months.some((error) => error))
const placeholder = computed(() => (every.value.trim() !== '' && !errors.value.every ? every.value : props.average === null ? '0.00' : fieldAmount(props.average)))

function held(): KeyedLine<PlanLine>[] {
  return props.lines.flatMap((line) => {
    const stored = writes.stored(line)
    return stored === null ? [] : [{ key: line.month === null ? 'every' : String(line.month), line: stored }]
  })
}

async function save(): Promise<void> {
  tried.value = true
  if (!valid.value) return
  const noteOf = (month: number | null) => props.lines.find((line) => line.month === month)?.note ?? ''
  const wanted = [
    ...(every.value.trim() === '' ? [] : [{ key: 'every', line: categoryPlanLine(props.year, null, props.slug, typedAmount(every.value) as Money, noteOf(null)) }]),
    ...calendar.value.flatMap((month, index) => {
      const text = months.value[index] ?? ''
      return text.trim() === '' ? [] : [{ key: String(month.number), line: categoryPlanLine(props.year, month.number, props.slug, typedAmount(text) as Money, noteOf(month.number)) }]
    }),
  ]
  const holding = held()
  if (await writes.write('Plan saved', (lines) => replacePlanLines(lines, holding, wanted), { description: `${props.name} for ${props.year}.`, failedTitle: 'Not saved' })) open.value = false
}

async function clear(): Promise<void> {
  const holding = held()
  if (await writes.write('Plan cleared', (lines) => replacePlanLines(lines, holding, []), { description: `${props.name} for ${props.year} takes its average again.`, failedTitle: 'Not cleared' }))
    open.value = false
}
</script>

<template>
  <AppDialog
    v-model:open="open"
    :title="`Plan ${name}, ${year}`"
    description="An amount for every month, and any month that differs. A cost is written without the VAT that is reclaimed. A blank month takes the amount for every month, or the average without one."
  >
    <form id="category-plan" class="flex flex-col gap-4" data-testid="category-plan-form" @submit.prevent="save">
      <UFormField
        label="Every month"
        :help="average === null ? 'The ledger has no month of it to average.' : `${averageWords ?? 'The average'}: ${formatMoney(Math.abs(average) as Money)} a month.`"
        :error="(tried && errors.every && 'Zero or more, with at most two decimals') || false"
      >
        <UInput v-model="every" inputmode="decimal" placeholder="0.00" class="w-full" data-testid="plan-every-month" />
      </UFormField>
      <fieldset class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <legend class="mb-2 text-sm text-toned">Months of their own</legend>
        <UFormField v-for="(month, index) in calendar" :key="month.number" :label="month.short" :error="(tried && errors.months[index] && 'Not an amount') || false">
          <UInput v-model="months[index]" inputmode="decimal" :placeholder="placeholder" class="w-full" :aria-label="`${month.name} ${year}`" :data-testid="`plan-month-${month.number}`" />
        </UFormField>
      </fieldset>
    </form>
    <template #start>
      <UButton v-if="lines.length > 0" label="Clear the plan" icon="i-lucide-eraser" color="error" variant="ghost" :disabled="writes.busy.value" data-testid="plan-clear" @click="clear" />
    </template>
    <template #end>
      <UButton label="Cancel" color="neutral" variant="ghost" :disabled="writes.busy.value" @click="open = false" />
      <UButton type="submit" form="category-plan" label="Save plan" icon="i-lucide-save" :loading="writes.busy.value" :disabled="writes.busy.value" data-testid="plan-save" />
    </template>
  </AppDialog>
</template>
