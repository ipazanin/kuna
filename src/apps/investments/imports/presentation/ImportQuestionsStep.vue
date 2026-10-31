<script setup lang="ts">
import { computed, ref } from 'vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import USelect from '@nuxt/ui/components/Select.vue'

import type { NetDividendStep, SettledImport, SpinOffStep, SplitStep } from './importChoices'
import type { WorkbookImport } from './useWorkbookImport'
import { words } from './words'
import { QUANTITY_PLACES } from '../../holdings/presentation/holdingText'
import { decimalText } from '../../../../shared/money/decimal'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { formatCurrencyAmount, formatPercent, formatQuantity } from '../../../../shared/money/moneyFormat'
import FormGrid from '../../../../shared/ui/FormGrid.vue'
import MoneyInput from '../../../../shared/ui/MoneyInput.vue'
import ShowAllButton, { FIRST_SHOWN } from '../../../../shared/ui/ShowAllButton.vue'

/** What the rows cannot say: each split's ratio, the spin-off's parent and share of cost, and the tax withheld from each dividend booked net. */
const props = defineProps<{
  workbookImport: WorkbookImport
  settled: SettledImport
}>()

/** Each holding of the workbook by its identity, by the name it has in Kuna or will have. */
const names = computed(() => {
  const instruments = props.workbookImport.book.value?.instruments ?? []
  return new Map(
    props.settled.instruments.map(({ question, choice }) => {
      const name = choice.kind === 'new' ? choice.texts.name : instruments.find((instrument) => instrument.id === choice.instrument)?.name
      return [question.identity, name || question.proposal.symbol]
    }),
  )
})
const nameOf = (identity: string): string => names.value.get(identity) ?? identity

const units = (quantity: Parameters<typeof formatQuantity>[0]): string => formatQuantity(quantity, QUANTITY_PLACES)

function splitLine(step: SplitStep): string {
  const { added, held } = step.question
  if (held === null) return words.questions.splitNoHolding(units(added))
  return held > 0n ? words.questions.splitRows(units(added), units(held)) : words.questions.splitNothingHeld(units(added))
}

function typeSplit(step: SplitStep, part: 'newUnits' | 'oldUnits', text: string): void {
  props.workbookImport.choose('splits', step.question.key, { ...step.texts, [part]: text })
}

function parentItems(step: SpinOffStep): { value: string; label: string }[] {
  return props.settled.parents.filter((instrument) => instrument.id !== step.received).map((instrument) => ({ value: instrument.id as string, label: instrument.name }))
}

function worthOf(step: SpinOffStep): string {
  const { worth, currency } = step.question
  return currency === null ? units(worth) : formatCurrencyAmount(worth, currency)
}

function pickParent(step: SpinOffStep, parent: string): void {
  const instrument = props.settled.parents.find((candidate) => candidate.id === parent)
  props.workbookImport.choose('spinOffs', step.question.key, { parent: instrument?.id ?? null, costShare: null })
}

function typeShare(step: SpinOffStep, text: string): void {
  props.workbookImport.choose('spinOffs', step.question.key, { parent: step.parent, costShare: text })
}

function typeWithheld(step: NetDividendStep, text: string): void {
  props.workbookImport.choose('withheld', step.question.key, text)
}

const allDividends = ref(false)
const dividends = computed(() => (allDividends.value ? props.settled.netDividends : props.settled.netDividends.slice(0, FIRST_SHOWN)))
</script>

<template>
  <div class="flex flex-col gap-6" data-testid="import-questions">
    <p class="type-body">{{ words.questions.intro }}</p>

    <section v-if="settled.splits.length > 0" class="flex flex-col gap-1" data-testid="import-splits">
      <h3 class="type-card-title">{{ words.questions.splits }}</h3>
      <ul class="flex flex-col">
        <li v-for="step in settled.splits" :key="step.question.key" class="flex flex-col gap-3 border-t border-default py-4 first:border-t-0" data-testid="import-split">
          <p class="flex flex-col gap-0.5">
            <span class="type-label">{{ words.questions.split(nameOf(step.question.identity), dayLabel(step.question.date)) }}</span>
            <span class="type-caption">{{ splitLine(step) }}</span>
          </p>
          <FormGrid>
            <UFormField :label="words.questions.newUnits" :help="words.questions.ratioHelp" :error="step.problem ?? false">
              <UInput :model-value="step.texts.newUnits" inputmode="numeric" class="w-full" data-testid="import-split-new" @update:model-value="typeSplit(step, 'newUnits', String($event))" />
            </UFormField>
            <UFormField :label="words.questions.oldUnits">
              <UInput :model-value="step.texts.oldUnits" inputmode="numeric" class="w-full" data-testid="import-split-old" @update:model-value="typeSplit(step, 'oldUnits', String($event))" />
            </UFormField>
          </FormGrid>
        </li>
      </ul>
    </section>

    <section v-if="settled.spinOffs.length > 0" class="flex flex-col gap-1" data-testid="import-spin-offs">
      <h3 class="type-card-title">{{ words.questions.spinOffs }}</h3>
      <ul class="flex flex-col">
        <li v-for="step in settled.spinOffs" :key="step.question.key" class="flex flex-col gap-3 border-t border-default py-4 first:border-t-0" data-testid="import-spin-off">
          <p class="flex flex-col gap-0.5">
            <span class="type-label">{{ words.questions.spinOff(nameOf(step.question.identity), dayLabel(step.question.date)) }}</span>
            <span class="type-caption">{{ words.questions.spinOffRows(units(step.question.quantity), worthOf(step)) }}</span>
          </p>
          <FormGrid>
            <UFormField :label="words.questions.parent" :error="step.problems.parent ?? false">
              <USelect
                v-bind="step.parent === null ? {} : { modelValue: step.parent }"
                :items="parentItems(step)"
                :placeholder="words.questions.parentMissing"
                class="w-full"
                data-testid="import-spin-off-parent"
                @update:model-value="pickParent(step, String($event))"
              />
            </UFormField>
            <UFormField
              :label="words.questions.costShare"
              :help="step.proposed === null ? words.questions.costShareHelp : words.questions.costShareProposed(formatPercent(Number(decimalText(step.proposed))))"
              :error="(step.parent !== null && step.problems.costShare) || false"
            >
              <UInput :model-value="step.costShare" inputmode="decimal" class="w-full" data-testid="import-spin-off-share" @update:model-value="typeShare(step, String($event))" />
            </UFormField>
          </FormGrid>
        </li>
      </ul>
    </section>

    <section v-if="settled.netDividends.length > 0" class="flex flex-col gap-1" data-testid="import-net-dividends">
      <h3 class="type-card-title">{{ words.questions.netDividends }}</h3>
      <p class="type-caption">{{ words.questions.netDividendsIntro }}</p>
      <ul class="flex flex-col">
        <li v-for="step in dividends" :key="step.question.key" class="flex flex-col gap-3 border-t border-default py-4 first:border-t-0" data-testid="import-net-dividend">
          <FormGrid>
            <UFormField
              :label="words.questions.netDividend(nameOf(step.question.identity), dayLabel(step.question.date), formatCurrencyAmount(step.question.net, step.question.currency))"
              :error="step.problem ?? false"
              class="sm:col-span-2"
            >
              <MoneyInput
                :model-value="step.withheld"
                :placeholder="words.questions.withheld"
                :aria-label="words.questions.withheld"
                class="w-full sm:w-48"
                data-testid="import-net-dividend-withheld"
                @update:model-value="typeWithheld(step, String($event))"
              />
            </UFormField>
          </FormGrid>
        </li>
      </ul>
      <ShowAllButton v-if="settled.netDividends.length > FIRST_SHOWN" v-model:expanded="allDividends" :total="settled.netDividends.length" />
    </section>
  </div>
</template>
