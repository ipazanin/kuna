<script setup lang="ts">
import { computed, useId } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'

import type { Money } from '../../../../shared/money/money'
import MoneyInput from '../../../../shared/ui/MoneyInput.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'
import { capitalised } from '../../../../shared/text/capitalised'
import { planItemsOf } from '../../billingPlan/domain/planItems'
import { useWorkbook } from '../../workbook/application/workbookStore'
import type { LineProblem } from '../domain/invoiceLine'
import { lineProblemsInWords } from '../domain/words'
import { blankLine } from './lineDrafts'
import type { LineDraft } from './lineDrafts'
import PlanItemsSelect from './PlanItemsSelect.vue'
import { words } from './words'

const lines = defineModel<LineDraft[]>('lines', { required: true })

const props = withDefaults(
  defineProps<{
    total: Money
    /** The client's slug, whose billing plan rows name the items a line may sum. */
    client: string
    disabled: boolean
    /** The lines start from the billing plan, which From the billing plan and One line for the total fill again. */
    planned?: boolean
    /** The client has invoice lines of its own, which start the list instead of one line per plan row. */
    templated?: boolean
    /** The lines start from those the invoice went out with. */
    reexport?: boolean
    /** What is wrong with the lines, each shown under its own line, once the person has pressed Check or Save. */
    problems?: readonly LineProblem[]
  }>(),
  { planned: false, templated: false, reexport: false, problems: () => [] },
)

const emit = defineEmits<{
  /** The lines the client's invoice starts from again. */
  plan: []
  /** One line for the whole amount. */
  merge: []
}>()

const store = useWorkbook()
const titleId = useId()
const lineId = useId()
const planItems = computed(() => planItemsOf(store.state.workbook?.billingPlan ?? [], props.client))
const linesItems = computed(() => lines.value.flatMap((line) => line.items))
const lineErrors = computed(() =>
  lines.value.map((_, index) => {
    const found = props.problems.flatMap((problem) => (problem.kind !== 'no-lines' && problem.line === index ? [words.lines.problem(problem)] : []))
    return found.length === 0 ? null : capitalised(found.join(', '))
  }),
)
const listError = computed(() => lineProblemsInWords(props.problems.filter((problem) => problem.kind === 'no-lines')).join(' '))

const intro = computed(() => {
  if (!props.planned) return words.lines.introTyped
  if (props.reexport) return words.lines.introReexport
  return props.templated ? words.lines.introTemplate : words.lines.intro
})

function update(index: number, change: Partial<LineDraft>): void {
  lines.value = lines.value.map((line, at) => (at === index ? { ...line, ...change } : line))
}

function remove(index: number): void {
  lines.value = lines.value.filter((_, at) => at !== index)
}

function add(): void {
  lines.value = [...lines.value, blankLine()]
}
</script>

<template>
  <section class="@container flex min-w-0 flex-col gap-2" :aria-labelledby="titleId" data-testid="invoice-lines">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h3 :id="titleId" class="type-card-title">{{ words.lines.title }}</h3>
      <div v-if="planned" class="flex flex-wrap gap-1">
        <UButton
          :label="templated ? words.lines.fromTemplate : words.lines.fromPlan"
          icon="i-lucide-list-restart"
          size="sm"
          color="neutral"
          variant="ghost"
          :disabled="disabled"
          @click="emit('plan')"
        />
        <UButton
          :label="words.lines.merge"
          icon="i-lucide-merge"
          size="sm"
          color="neutral"
          variant="ghost"
          :disabled="disabled || lines.length < 2"
          data-testid="invoice-lines-merge"
          @click="emit('merge')"
        />
      </div>
    </div>
    <ol class="flex flex-col divide-y divide-default border-y border-default">
      <li v-for="(line, index) in lines" :key="index" class="py-3" data-testid="invoice-line">
        <UFormField :error="lineErrors[index] ?? false">
          <div class="flex flex-col gap-2">
            <div class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 @sm:grid-cols-[minmax(0,1fr)_7.5rem_auto]">
              <UInput
                :id="`${lineId}-${index}-text`"
                :model-value="line.description"
                :placeholder="words.lines.descriptionPlaceholder"
                class="col-span-full min-w-0 @sm:col-span-1"
                :aria-label="words.lines.description(index + 1)"
                :disabled="disabled"
                data-testid="invoice-line-text"
                @update:model-value="update(index, { description: String($event) })"
              />
              <MoneyInput
                :id="`${lineId}-${index}-amount`"
                :model-value="line.amount"
                :placeholder="words.lines.amountPlaceholder"
                class="w-full"
                :aria-label="words.lines.amount(index + 1)"
                :disabled="disabled"
                data-testid="invoice-line-amount"
                @update:model-value="update(index, { amount: $event })"
              />
              <UButton
                icon="i-lucide-trash-2"
                color="neutral"
                variant="ghost"
                class="size-11 justify-center sm:size-9"
                :aria-label="words.lines.remove(index + 1)"
                :disabled="disabled || lines.length === 1"
                @click="remove(index)"
              />
            </div>
            <PlanItemsSelect
              :id="`${lineId}-${index}-items`"
              :model-value="line.items"
              :plan-items="planItems"
              :lines-items="linesItems"
              :label="words.clientLines.items(index + 1)"
              :placeholder="words.clientLines.itemsPlaceholder"
              :disabled="disabled"
              test-id="invoice-line"
              @update:model-value="update(index, { items: $event })"
            />
          </div>
        </UFormField>
      </li>
    </ol>
    <p v-if="listError" class="type-caption text-error">{{ listError }}</p>
    <div class="flex flex-wrap items-center justify-between gap-2">
      <UButton :label="words.lines.add" icon="i-lucide-plus" size="sm" color="neutral" variant="outline" :disabled="disabled" data-testid="invoice-line-add" @click="add" />
      <p class="type-body">{{ words.lines.total }} <MoneyText :cents="total" class="font-medium text-highlighted" /></p>
    </div>
    <p class="max-w-prose type-aside">{{ intro }}</p>
  </section>
</template>
