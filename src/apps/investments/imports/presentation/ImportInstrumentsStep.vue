<script setup lang="ts">
import { computed, ref } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'
import USelect from '@nuxt/ui/components/Select.vue'

import type { InstrumentStep, SettledImport } from './importChoices'
import type { WorkbookImport } from './useWorkbookImport'
import { words } from './words'
import InstrumentFields from '../../holdings/presentation/InstrumentFields.vue'
import { hasInstrumentErrors, instrumentTexts } from '../../holdings/presentation/instrumentForm'
import type { InstrumentTexts } from '../../holdings/presentation/instrumentForm'
import { words as holdingWords } from '../../holdings/presentation/words'
import { PRICE_VENDORS } from '../../prices/infrastructure/vendors/priceVendors'
import { plural } from '../../../../shared/text/translation'
import FormGrid from '../../../../shared/ui/FormGrid.vue'

/** Each holding of the workbook, matched to one Kuna has, or added from a guess the person can change. */
const props = defineProps<{
  workbookImport: WorkbookImport
  settled: SettledImport
}>()

/** The choice of a new holding, which no record id can be, since an id names its kind. */
const NEW = 'new'

const book = computed(() => props.workbookImport.book.value)
/** The holdings whose guess is open for a change. One with a field that needs a look stays open. */
const changing = ref<ReadonlySet<string>>(new Set())

function itemsOf(step: InstrumentStep): { value: string; label: string }[] {
  const offer = step.question.offer
  const others = (book.value?.instruments ?? []).filter((instrument) => instrument.id !== offer?.id)
  return [
    ...(offer === null
      ? []
      : [{ value: offer.id as string, label: offer.isin !== null && offer.isin === step.question.proposal.isin ? words.instruments.sameIsin(offer.name) : words.instruments.sameSymbol(offer.name) }]),
    { value: NEW, label: words.instruments.newHolding },
    ...others.map((instrument) => ({ value: instrument.id as string, label: instrument.name })),
  ]
}

function pick(step: InstrumentStep, value: string): void {
  const instrument = book.value?.instruments.find((candidate) => candidate.id === value)
  props.workbookImport.choose(
    'instruments',
    step.question.identity,
    instrument === undefined ? { kind: 'new', texts: instrumentTexts(step.question.proposal) } : { kind: 'existing', instrument: instrument.id },
  )
}

function change(step: InstrumentStep, texts: InstrumentTexts): void {
  props.workbookImport.choose('instruments', step.question.identity, { kind: 'new', texts })
}

function toggle(identity: string): void {
  const next = new Set(changing.value)
  if (!next.delete(identity)) next.add(identity)
  changing.value = next
}

function guessOf(texts: InstrumentTexts): string {
  const source = PRICE_VENDORS.find((vendor) => vendor.id === texts.prices)?.name ?? holdingWords.instrumentDialog.manual
  return words.instruments.guess(texts.name, holdingWords.classes[texts.class].toLowerCase(), texts.currency, source)
}

function opened(step: InstrumentStep): boolean {
  return changing.value.has(step.question.identity) || (step.errors !== null && hasInstrumentErrors(step.errors))
}
</script>

<template>
  <div class="flex flex-col gap-4" data-testid="import-instruments">
    <p class="type-body">{{ words.instruments.intro }}</p>
    <ul class="flex flex-col">
      <li v-for="step in settled.instruments" :key="step.question.identity" class="flex flex-col gap-3 border-t border-default py-4" data-testid="import-instrument">
        <p class="flex flex-wrap items-baseline justify-between gap-x-3">
          <span class="type-label">{{ [step.question.symbols.join(', '), step.question.proposal.isin].filter((part) => part !== null && part !== '').join(' · ') }}</span>
          <span class="type-caption">{{ plural(words.instruments.rows(step.question.rows), step.question.rows) }}</span>
        </p>
        <FormGrid>
          <UFormField :label="words.instruments.kunaHolding" class="sm:col-span-2">
            <USelect
              :model-value="step.choice.kind === 'new' ? NEW : step.choice.instrument"
              :items="itemsOf(step)"
              class="w-full"
              data-testid="import-instrument-choice"
              @update:model-value="pick(step, String($event))"
            />
          </UFormField>
          <InstrumentFields
            v-if="step.choice.kind === 'new' && opened(step)"
            :model-value="step.choice.texts"
            :errors="step.errors!"
            tried
            :book="book!"
            test-id="import-instrument"
            @update:model-value="change(step, $event)"
          />
        </FormGrid>
        <template v-if="step.choice.kind === 'new'">
          <div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <p class="flex min-w-0 items-start gap-2 type-caption" data-testid="import-instrument-guess">
              <UIcon v-if="step.errors && hasInstrumentErrors(step.errors)" name="i-lucide-triangle-alert" class="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
              <span class="min-w-0 break-words">{{ step.errors && hasInstrumentErrors(step.errors) ? words.instruments.needsLook : guessOf(step.choice.texts) }}</span>
            </p>
            <UButton
              v-if="!(step.errors && hasInstrumentErrors(step.errors))"
              :label="opened(step) ? words.instruments.done : words.instruments.edit"
              :icon="opened(step) ? 'i-lucide-check' : 'i-lucide-pencil'"
              color="neutral"
              variant="outline"
              size="sm"
              :aria-expanded="opened(step)"
              data-testid="import-instrument-edit"
              @click="toggle(step.question.identity)"
            />
          </div>
        </template>
      </li>
    </ul>
  </div>
</template>
