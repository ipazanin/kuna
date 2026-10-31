<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import USelect from '@nuxt/ui/components/Select.vue'

import { INSTRUMENT_WRITES } from '../application/holdingWrites'
import { PRICE_VENDORS } from '../../prices/infrastructure/vendors/priceVendors'
import { useInvestmentsBooks } from '../../workbook/application/investmentsStore'
import CurrencyField from './CurrencyField.vue'
import { INSTRUMENT_CLASSES, PRICE_SOURCES } from '../../workbook/domain/instrument'
import type { Instrument, InstrumentClass, PriceSource } from '../../workbook/domain/instrument'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import { ISIN, MIC } from '../../workbook/domain/instrumentReading'
import { INSTRUMENT_RECORDS } from '../../workbook/domain/investmentKinds'
import { words } from './words'
import { EURO, currencyCodeOf } from '../../../../shared/money/currencyCode'
import { newRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import AppDialog from '../../../../shared/ui/AppDialog.vue'
import FormGrid from '../../../../shared/ui/FormGrid.vue'

/** A holding's facts and the source of its daily closes, added or changed. Saving says which instrument it wrote. */
const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  /** The instrument to change, or null to add one. */
  instrument: Instrument | null
  book: InvestmentBook
}>()

const emit = defineEmits<{
  saved: [instrument: Instrument]
}>()

const store = useInvestmentsBooks()
const writes = useRecordWrites(store)
const text = words.instrumentDialog

const CLASS_ITEMS = INSTRUMENT_CLASSES.map((value) => ({ value, label: words.classes[value] }))
const SOURCE_ITEMS = PRICE_SOURCES.map((value) => {
  const vendor = PRICE_VENDORS.find((candidate) => candidate.id === value)
  return { value, label: vendor?.name ?? text.manual, description: vendor?.covers ?? text.manualHelp }
})

const texts = reactive({
  name: '',
  symbol: '',
  class: 'stocks' as InstrumentClass,
  isin: '',
  exchange: '',
  currency: EURO as string,
  prices: 'twelvedata' as PriceSource,
  sourceSymbol: '',
  note: '',
})
const tried = ref(false)

watch(open, (opened) => {
  if (!opened) return
  const instrument = props.instrument
  Object.assign(texts, {
    name: instrument?.name ?? '',
    symbol: instrument?.symbol ?? '',
    class: instrument?.class ?? 'stocks',
    isin: instrument?.isin ?? '',
    exchange: instrument?.exchange ?? '',
    currency: instrument?.currency ?? EURO,
    prices: instrument?.prices ?? 'twelvedata',
    sourceSymbol: instrument?.sourceSymbol ?? '',
    note: instrument?.note ?? '',
  })
  tried.value = false
})

const others = computed(() => props.book.instruments.filter((other) => other.id !== props.instrument?.id))

const errors = computed(() => {
  const isin = texts.isin.trim().toUpperCase()
  const sharing = isin === '' ? undefined : others.value.find((other) => other.isin === isin)
  return {
    name: texts.name.trim() === '' ? text.errors.name : null,
    symbol: texts.symbol.trim() === '' ? text.errors.symbol : null,
    isin: isin !== '' && !ISIN.test(isin) ? text.errors.isin : sharing === undefined ? null : text.errors.isinTaken(sharing.name),
    exchange: texts.exchange.trim() !== '' && !MIC.test(texts.exchange.trim().toUpperCase()) ? text.errors.exchange : null,
    currency: currencyCodeOf(texts.currency) === null ? text.errors.currency : null,
  }
})

const shown = (error: string | null): string | false => (tried.value && error) || false

async function save(): Promise<void> {
  tried.value = true
  const currency = currencyCodeOf(texts.currency)
  if (Object.values(errors.value).some((error) => error !== null) || currency === null) return
  const before = props.instrument
  const symbol = texts.symbol.trim()
  const record: Instrument = {
    id: before?.id ?? recordIdOf(INSTRUMENT_RECORDS, newRecordId()),
    name: texts.name.trim(),
    class: texts.class,
    isin: texts.isin.trim() === '' ? null : texts.isin.trim().toUpperCase(),
    symbol,
    exchange: texts.exchange.trim() === '' ? null : texts.exchange.trim().toUpperCase(),
    currency,
    quoted: before?.quoted ?? { kind: 'unit' },
    prices: texts.prices,
    sourceSymbol: texts.prices === 'manual' ? '' : texts.sourceSymbol.trim() || symbol,
    note: texts.note.trim(),
  }
  const written =
    before === null
      ? await writes.write(text.added, (unit) => unit.of(INSTRUMENT_WRITES).add(record), { failedTitle: text.notAdded })
      : await writes.write(text.saved, (unit) => unit.of(INSTRUMENT_WRITES).change(before, record), { failedTitle: text.notSaved })
  if (!written) return
  emit('saved', record)
  open.value = false
}

async function remove(): Promise<void> {
  const before = props.instrument
  if (before === null) return
  if (await writes.write(text.deleted, (unit) => unit.of(INSTRUMENT_WRITES).remove(before), { failedTitle: text.notDeleted })) open.value = false
}
</script>

<template>
  <AppDialog v-model:open="open" :title="instrument === null ? text.addTitle : text.changeTitle" :description="text.description" width="2xl">
    <FormGrid id="instrument" as="form" data-testid="instrument-form" @submit.prevent="save">
      <UFormField :label="text.name" :error="shown(errors.name)" class="sm:col-span-2">
        <UInput v-model="texts.name" class="w-full" data-testid="instrument-name" />
      </UFormField>
      <UFormField :label="text.symbol" :help="text.symbolHelp" :error="shown(errors.symbol)">
        <UInput v-model="texts.symbol" autocapitalize="characters" :spellcheck="false" class="w-full" data-testid="instrument-symbol" />
      </UFormField>
      <UFormField :label="text.class" :help="text.classHelp">
        <USelect v-model="texts.class" :items="CLASS_ITEMS" class="w-full" data-testid="instrument-class" />
      </UFormField>
      <UFormField :label="text.isin" :help="text.isinHelp" :error="shown(errors.isin)">
        <UInput v-model="texts.isin" autocapitalize="characters" :spellcheck="false" class="w-full" data-testid="instrument-isin" />
      </UFormField>
      <UFormField :label="text.exchange" :help="text.exchangeHelp" :error="shown(errors.exchange)">
        <UInput v-model="texts.exchange" autocapitalize="characters" :spellcheck="false" class="w-full" data-testid="instrument-exchange" />
      </UFormField>
      <CurrencyField v-model="texts.currency" :book="book" :label="text.currency" :help="text.currencyHelp" :error="shown(errors.currency)" test-id="instrument-currency" />
      <UFormField :label="text.prices" :help="SOURCE_ITEMS.find((item) => item.value === texts.prices)?.description ?? ''">
        <USelect v-model="texts.prices" :items="SOURCE_ITEMS" class="w-full" data-testid="instrument-prices" />
      </UFormField>
      <UFormField v-if="texts.prices !== 'manual'" :label="text.sourceSymbol" :help="text.sourceSymbolHelp" class="sm:col-span-2">
        <UInput v-model="texts.sourceSymbol" :placeholder="texts.symbol" autocapitalize="characters" :spellcheck="false" class="w-full" data-testid="instrument-source-symbol" />
      </UFormField>
      <UFormField :label="text.note" class="sm:col-span-2">
        <UInput v-model="texts.note" class="w-full" data-testid="instrument-note" />
      </UFormField>
    </FormGrid>
    <template #start>
      <UButton v-if="instrument !== null" :label="text.delete" icon="i-lucide-trash-2" color="error" variant="ghost" :disabled="writes.busy.value" data-testid="instrument-delete" @click="remove" />
    </template>
    <template #end>
      <UButton :label="text.cancel" color="neutral" variant="ghost" :disabled="writes.busy.value" @click="open = false" />
      <UButton
        type="submit"
        form="instrument"
        :label="instrument === null ? text.add : text.save"
        :icon="instrument === null ? 'i-lucide-plus' : 'i-lucide-save'"
        :loading="writes.busy.value"
        :disabled="writes.busy.value"
        data-testid="instrument-save"
      />
    </template>
  </AppDialog>
</template>
