<script setup lang="ts">
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import USelect from '@nuxt/ui/components/Select.vue'

import CurrencyField from './CurrencyField.vue'
import type { InstrumentErrors, InstrumentTexts } from './instrumentForm'
import { words } from './words'
import { PRICE_VENDORS } from '../../prices/infrastructure/vendors/priceVendors'
import { INSTRUMENT_CLASSES, PRICE_SOURCES } from '../../workbook/domain/instrument'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'

/** A holding's facts and the source of its daily closes, as fields inside a FormGrid. */
const texts = defineModel<InstrumentTexts>({ required: true })

const props = withDefaults(
  defineProps<{
    errors: InstrumentErrors
    /** Whether a save was tried, after which each field shows what it lacks. */
    tried: boolean
    book: InvestmentBook
    /** Starts every field's test id, such as `instrument-name`. */
    testId?: string
  }>(),
  { testId: 'instrument' },
)

const text = words.instrumentDialog

const CLASS_ITEMS = INSTRUMENT_CLASSES.map((value) => ({ value, label: words.classes[value] }))
const SOURCE_ITEMS = PRICE_SOURCES.map((value) => {
  const vendor = PRICE_VENDORS.find((candidate) => candidate.id === value)
  return { value, label: vendor?.name ?? text.manual, description: vendor?.covers ?? text.manualHelp }
})

const shown = (error: string | null): string | false => (props.tried && error) || false

/** Each edit replaces the texts, so a caller that keeps them in a computed sees it as well as one that keeps them in a ref. */
function update<Field extends keyof InstrumentTexts>(field: Field, value: InstrumentTexts[Field]): void {
  texts.value = { ...texts.value, [field]: value }
}
</script>

<template>
  <UFormField :label="text.name" :error="shown(errors.name)" class="sm:col-span-2">
    <UInput :model-value="texts.name" class="w-full" :data-testid="`${testId}-name`" @update:model-value="update('name', String($event))" />
  </UFormField>
  <UFormField :label="text.symbol" :help="text.symbolHelp" :error="shown(errors.symbol)">
    <UInput :model-value="texts.symbol" autocapitalize="characters" :spellcheck="false" class="w-full" :data-testid="`${testId}-symbol`" @update:model-value="update('symbol', String($event))" />
  </UFormField>
  <UFormField :label="text.class" :help="text.classHelp">
    <USelect :model-value="texts.class" :items="CLASS_ITEMS" class="w-full" :data-testid="`${testId}-class`" @update:model-value="update('class', $event)" />
  </UFormField>
  <UFormField :label="text.isin" :help="text.isinHelp" :error="shown(errors.isin)">
    <UInput :model-value="texts.isin" autocapitalize="characters" :spellcheck="false" class="w-full" :data-testid="`${testId}-isin`" @update:model-value="update('isin', String($event))" />
  </UFormField>
  <UFormField :label="text.exchange" :help="text.exchangeHelp" :error="shown(errors.exchange)">
    <UInput :model-value="texts.exchange" autocapitalize="characters" :spellcheck="false" class="w-full" :data-testid="`${testId}-exchange`" @update:model-value="update('exchange', String($event))" />
  </UFormField>
  <CurrencyField
    :model-value="texts.currency"
    :book="book"
    :label="text.currency"
    :help="text.currencyHelp"
    :error="shown(errors.currency)"
    :test-id="`${testId}-currency`"
    @update:model-value="update('currency', $event)"
  />
  <UFormField :label="text.prices" :help="SOURCE_ITEMS.find((item) => item.value === texts.prices)?.description ?? ''">
    <USelect :model-value="texts.prices" :items="SOURCE_ITEMS" class="w-full" :data-testid="`${testId}-prices`" @update:model-value="update('prices', $event)" />
  </UFormField>
  <UFormField v-if="texts.prices !== 'manual'" :label="text.sourceSymbol" :help="text.sourceSymbolHelp" class="sm:col-span-2">
    <UInput
      :model-value="texts.sourceSymbol"
      :placeholder="texts.symbol"
      autocapitalize="characters"
      :spellcheck="false"
      class="w-full"
      :data-testid="`${testId}-source-symbol`"
      @update:model-value="update('sourceSymbol', String($event))"
    />
  </UFormField>
  <UFormField :label="text.note" class="sm:col-span-2">
    <UInput :model-value="texts.note" class="w-full" :data-testid="`${testId}-note`" @update:model-value="update('note', String($event))" />
  </UFormField>
</template>
