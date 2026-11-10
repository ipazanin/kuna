<script setup lang="ts">
import { computed } from 'vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'
import USelect from '@nuxt/ui/components/Select.vue'
import USelectMenu from '@nuxt/ui/components/SelectMenu.vue'

import CurrencyField from './CurrencyField.vue'
import { COUNTRY_ITEMS, DISTRIBUTION_ITEMS, NOT_SET, SECTOR_ITEMS, classOfType, typeItems, withQuoting } from './instrumentForm'
import type { InstrumentErrors, InstrumentTexts } from './instrumentForm'
import { words } from './words'
import { PRICE_VENDORS } from '../../prices/infrastructure/vendors/priceVendors'
import { INSTRUMENT_CLASSES, PRICE_SOURCES, QUOTING_KINDS } from '../../workbook/domain/instrument'
import type { Instrument } from '../../workbook/domain/instrument'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'

/** A holding's facts and the source of its daily closes, as fields inside a FormGrid. */
const texts = defineModel<InstrumentTexts>({ required: true })

const props = withDefaults(
  defineProps<{
    errors: InstrumentErrors
    /** Whether a save was tried, after which each field shows what it lacks. */
    tried: boolean
    book: InvestmentBook
    /** The instrument being changed, or null for a new one. */
    instrument?: Instrument | null
    /** Starts every field's test id, such as `instrument-name`. */
    testId?: string
  }>(),
  { instrument: null, testId: 'instrument' },
)

const text = words.instrumentDialog

/** Whether changing the quoting of an instrument that has trades changes how they read. */
const rereadsTrades = computed(() => props.instrument !== null && texts.value.quoted !== props.instrument.quoted.kind && props.book.trades.some((trade) => trade.instrument === props.instrument?.id))

const QUOTING_ITEMS = QUOTING_KINDS.map((value) => ({ value, label: text.quotings[value] }))
const CLASS_ITEMS = INSTRUMENT_CLASSES.map((value) => ({ value, label: words.classes[value] }))
const SOURCE_ITEMS = PRICE_SOURCES.map((value) => {
  const vendor = PRICE_VENDORS.find((candidate) => candidate.id === value)
  return { value, label: vendor?.name ?? text.manual, description: vendor?.covers ?? text.manualHelp }
})

const NOT_SET_ROW = { value: NOT_SET, label: text.notSet }
const SECTOR_CHOICES = [NOT_SET_ROW, ...SECTOR_ITEMS]
const COUNTRY_CHOICES = [NOT_SET_ROW, ...COUNTRY_ITEMS]
const DISTRIBUTION_CHOICES = [NOT_SET_ROW, ...DISTRIBUTION_ITEMS]

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
  <UFormField :label="text.quoted" :help="rereadsTrades ? '' : text.quotedHelp[texts.quoted]">
    <USelect :model-value="texts.quoted" :items="QUOTING_ITEMS" class="w-full" :data-testid="`${testId}-quoted`" @update:model-value="texts = withQuoting(texts, $event, instrument?.type ?? '')" />
    <template v-if="rereadsTrades" #help>
      <span class="flex items-start gap-1 text-warning" :data-testid="`${testId}-quoted-rereads`">
        <UIcon name="i-lucide-triangle-alert" class="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        {{ text.quotedRereads }}
      </span>
    </template>
  </UFormField>
  <template v-if="texts.quoted === 'percent'">
    <UFormField :label="text.coupon" :help="text.couponHelp" :error="shown(errors.coupon)">
      <UInput :model-value="texts.coupon" inputmode="decimal" class="w-full" :data-testid="`${testId}-coupon`" @update:model-value="update('coupon', String($event))">
        <template #trailing><span class="text-muted">%</span></template>
      </UInput>
    </UFormField>
    <UFormField :label="text.maturity" :error="shown(errors.maturity)">
      <UInput :model-value="texts.maturity" type="date" class="w-full" :data-testid="`${testId}-maturity`" @update:model-value="update('maturity', String($event))" />
    </UFormField>
  </template>
  <UFormField :label="text.type" :help="text.typeHelp" :error="shown(errors.type)">
    <USelectMenu
      :model-value="texts.type || NOT_SET"
      :items="[NOT_SET_ROW, ...typeItems(texts.quoted)]"
      value-key="value"
      :search-input="false"
      class="w-full"
      :data-testid="`${testId}-type`"
      @update:model-value="update('type', $event === NOT_SET ? '' : $event)"
    />
  </UFormField>
  <UFormField v-if="classOfType(texts.type) === null" :label="text.class" :help="text.classHelp">
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
  <UFormField :label="text.sector" :help="text.sectorHelp">
    <USelectMenu
      :model-value="texts.sector || NOT_SET"
      :items="SECTOR_CHOICES"
      value-key="value"
      :search-input="false"
      class="w-full"
      :data-testid="`${testId}-sector`"
      @update:model-value="update('sector', $event === NOT_SET ? '' : $event)"
    />
  </UFormField>
  <UFormField :label="text.country" :help="text.countryHelp">
    <USelectMenu
      :model-value="texts.country || NOT_SET"
      :items="COUNTRY_CHOICES"
      value-key="value"
      :search-input="{ placeholder: text.findCountry }"
      class="w-full"
      :data-testid="`${testId}-country`"
      @update:model-value="update('country', $event === NOT_SET ? '' : $event)"
    />
  </UFormField>
  <UFormField :label="text.ter" :help="text.terHelp" :error="shown(errors.ter)">
    <UInput :model-value="texts.ter" inputmode="decimal" class="w-full" :data-testid="`${testId}-ter`" @update:model-value="update('ter', String($event))">
      <template #trailing><span class="text-muted">%</span></template>
    </UInput>
  </UFormField>
  <UFormField v-if="texts.type === 'fund'" :label="text.distribution" :help="text.distributionHelp">
    <USelectMenu
      :model-value="texts.distribution || NOT_SET"
      :items="DISTRIBUTION_CHOICES"
      value-key="value"
      :search-input="false"
      class="w-full"
      :data-testid="`${testId}-distribution`"
      @update:model-value="update('distribution', $event === NOT_SET ? '' : $event)"
    />
  </UFormField>
  <UFormField :label="text.note">
    <UInput :model-value="texts.note" class="w-full" :data-testid="`${testId}-note`" @update:model-value="update('note', String($event))" />
  </UFormField>
</template>
