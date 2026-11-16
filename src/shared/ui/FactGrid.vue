<script lang="ts">
import type { ShownAmount } from '../money/moneyFormat'
import type { SwatchMark } from './ChartLegend.vue'

export type Fact = {
  readonly label: string
  readonly caption?: string
  /** The label's language when it is not the screen's, such as `hr` for a Croatian form's field name. */
  readonly lang?: string
  /** A key beside the label, in any CSS colour, when the fact names a part of a chart or a meter. */
  readonly swatch?: { readonly colour: string; readonly mark?: SwatchMark }
} & ({ readonly value: string; readonly amount?: undefined } | { readonly amount: ShownAmount; readonly value?: undefined })
</script>

<script setup lang="ts" generic="Shown extends Fact">
import { computed } from 'vue'

import MoneyText from './MoneyText.vue'

/** Labelled figures two to a row, and all in one row once the space around them fits them. A fact's amount shows as `MoneyText`, and the value slot draws a value that is not a figure, such as a chip or a key. */
const props = defineProps<{
  facts: readonly Shown[]
}>()
const slots = defineSlots<{ value?: (props: { fact: Shown }) => unknown }>()

const columns = computed(() => (props.facts.length >= 4 ? '@lg:grid-cols-4' : props.facts.length === 3 ? '@sm:grid-cols-3' : ''))
</script>

<template>
  <div class="@container">
    <dl class="grid grid-cols-2 gap-x-4 gap-y-3" :class="columns">
      <div v-for="(fact, place) in facts" :key="place" class="min-w-0">
        <dt class="flex items-center gap-1.5 type-caption" :lang="fact.lang">
          <span v-if="fact.swatch" class="swatch" :class="`swatch-${fact.swatch.mark ?? 'bar'}`" :style="{ '--swatch': fact.swatch.colour }" aria-hidden="true" />
          {{ fact.label }}
        </dt>
        <dd v-if="slots.value" class="mt-0.5"><slot name="value" :fact="fact" /></dd>
        <dd v-else-if="fact.amount" class="mt-0.5 type-figure-secondary"><MoneyText v-bind="fact.amount" /></dd>
        <dd v-else class="mt-0.5 type-figure-secondary">{{ fact.value }}</dd>
        <dd v-if="fact.caption" class="mt-0.5 type-caption">{{ fact.caption }}</dd>
      </div>
    </dl>
  </div>
</template>
