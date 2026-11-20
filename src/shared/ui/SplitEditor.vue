<script setup lang="ts" generic="Cents extends number, Held">
import { computed, useId } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import UTooltip from '@nuxt/ui/components/Tooltip.vue'

import { amountForTyping } from '../money/typedAmount'
import MoneyInput from './MoneyInput.vue'
import { restOfFields, splitField } from './splitFields'
import type { SplitField, TypedCents } from './splitFields'
import { words } from './words'

/** The parts of a whole, each an amount or the one part that takes what the others leave, with a category and a note each. */
const parts = defineModel<SplitField<Held>[]>({ required: true })

const props = defineProps<{
  /** What the whole is, said before its figure above the parts. */
  wholeLabel: string
  /** The whole read above zero, as each part is typed. */
  whole: Cents
  typed: TypedCents<Cents>
  /** Whether saving was tried, which shows each field's error. */
  tried: boolean
  categoryError: (field: SplitField<Held>) => string | null
  /** Why the parts cannot be saved, shown once saving was tried. A rest of nothing shows at once. */
  refusal?: string | null
}>()

defineSlots<{
  whole(): unknown
  category(scope: { field: SplitField<Held>; place: number }): unknown
  rest(scope: { cents: Cents }): unknown
  /** More fields of a part under its note, such as the labels it carries. */
  part?(scope: { field: SplitField<Held>; place: number }): unknown
}>()

const restLabel = `${useId()}-rest`
const rest = computed(() => restOfFields(props.whole, parts.value, props.typed))
const shownRefusal = computed(() => (rest.value <= 0 ? words.split.refusals.over : props.tried ? (props.refusal ?? null) : null))

function amountError(field: SplitField<Held>): string | null {
  if (field.rest) return null
  const amount = props.typed(field.amount)
  return amount === null || amount <= 0 ? words.split.anAmount : null
}

function addPart(): void {
  parts.value = [...parts.value, splitField<Held>('', '', '', false)]
}

/** Takes the part off. When it was the rest, the last part left takes the rest instead. */
function removePart(id: number): void {
  const kept = parts.value.filter((field) => field.id !== id)
  const last = kept[kept.length - 1]
  if (last !== undefined && !kept.some((field) => field.rest)) {
    last.rest = true
    last.amount = ''
  }
  parts.value = kept
}

/** Makes the part the rest. The part that was the rest keeps the figure it showed, so nothing typed or shown is lost. */
function takeRest(id: number): void {
  const shown = rest.value
  for (const field of parts.value) {
    if (field.rest) field.amount = shown > 0 ? amountForTyping(shown) : ''
    field.rest = field.id === id
    if (field.rest) field.amount = ''
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <p class="flex items-baseline justify-between gap-3 type-body" data-testid="split-whole">
      <span class="text-toned">{{ wholeLabel }}</span>
      <span class="font-medium"><slot name="whole" /></span>
    </p>
    <ol class="flex flex-col gap-5" :aria-label="words.split.parts">
      <li
        v-for="(field, index) in parts"
        :key="field.id"
        class="grid items-end gap-x-3 gap-y-2 border-b border-default pb-5 sm:grid-cols-[9rem_minmax(0,1fr)]"
        data-testid="split-part"
        :data-rest="field.rest"
      >
        <div class="col-span-full flex items-center justify-between gap-3">
          <h3 class="type-card-title" data-testid="split-part-heading">{{ words.split.part(index + 1) }}</h3>
          <UTooltip :text="parts.length <= 2 ? words.split.twoParts : words.split.removePart(index + 1)">
            <span class="inline-flex">
              <UButton
                icon="i-lucide-x"
                color="neutral"
                variant="ghost"
                class="disabled:opacity-40"
                :disabled="parts.length <= 2"
                :aria-label="words.split.removePart(index + 1)"
                data-testid="split-part-remove"
                @click="removePart(field.id)"
              />
            </span>
          </UTooltip>
        </div>
        <div v-if="field.rest" class="flex flex-col gap-1">
          <span :id="restLabel" class="font-medium type-body">{{ words.split.rest }}</span>
          <p
            role="status"
            aria-live="polite"
            :aria-labelledby="restLabel"
            class="flex min-h-8 items-center font-medium"
            :class="rest <= 0 ? 'text-error' : 'text-highlighted'"
            data-testid="split-rest"
          >
            <slot name="rest" :cents="rest" />
          </p>
        </div>
        <UFormField v-else :label="words.split.amount" :error="(tried && amountError(field)) || false">
          <div class="flex gap-1">
            <MoneyInput v-model="field.amount" :placeholder="words.split.amountPlaceholder" :aria-label="words.split.amountOf(index + 1)" class="w-full" data-testid="split-part-amount" />
            <UTooltip :text="words.split.takeRest(index + 1)">
              <UButton icon="i-lucide-equal" color="neutral" variant="ghost" :aria-label="words.split.takeRest(index + 1)" data-testid="split-part-take-rest" @click="takeRest(field.id)" />
            </UTooltip>
          </div>
        </UFormField>
        <UFormField :label="words.split.category" :error="(tried && categoryError(field)) || false">
          <slot name="category" :field="field" :place="index + 1" />
        </UFormField>
        <UFormField :label="words.split.note" class="col-span-full">
          <UInput v-model="field.note" :placeholder="words.split.notePlaceholder" class="w-full" data-testid="split-part-note" />
        </UFormField>
        <div v-if="$slots.part" class="col-span-full">
          <slot name="part" :field="field" :place="index + 1" />
        </div>
      </li>
    </ol>
    <UButton :label="words.split.addPart" icon="i-lucide-plus" color="neutral" variant="outline" class="self-start" data-testid="split-add-part" @click="addPart" />
    <UAlert v-if="shownRefusal !== null" icon="i-lucide-triangle-alert" color="error" variant="subtle" :title="shownRefusal" data-testid="split-refusal" />
  </div>
</template>
