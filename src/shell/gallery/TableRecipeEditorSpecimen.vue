<script setup lang="ts">
import { ref } from 'vue'

import GallerySection from './GallerySection.vue'
import type { TableRecipeDraft, TableRecipeFields } from '../../shared/recipes/domain/tableRecipeDraft'
import { recipeErrorsOf } from '../../shared/recipes/presentation/recipeErrors'
import TableRecipeEditor from '../../shared/recipes/presentation/TableRecipeEditor.vue'

const FIELDS: TableRecipeFields = {
  date: 'day',
  time: 'time',
  amount: 'amount',
  debit: 'debit',
  credit: 'credit',
  optional: [
    { field: 'payee', as: 'text' },
    { field: 'currency', as: 'text' },
  ],
  kinds: [
    { kind: 'booked', reads: true },
    { kind: 'declined', reads: false },
  ],
}
/** Fields with no column for a row's currency, for books whose accounts each hold one currency. */
const ONE_CURRENCY_FIELDS: TableRecipeFields = { ...FIELDS, optional: FIELDS.optional.filter((optional) => optional.field !== 'currency') }
const FIELD_LABELS = { amount: 'Amount', debit: 'Money out', credit: 'Money in', payee: 'Payee', currency: 'Row currency' }
const KIND_LABELS = { booked: 'Booked rows', declined: 'Declined rows, counted' }
const HEADER = ['Datum', 'Opis', 'Isplata', 'Uplata', 'Status']

const draft = ref<TableRecipeDraft>({
  name: 'Example bank current account',
  date: { column: 'Datum', format: 'dd.MM.yyyy' },
  amount: { debit: 'Isplata', credit: 'Uplata' },
  mark: 'comma',
  columns: { payee: 'Opis' },
  kinds: [
    { kind: 'booked', test: { column: 'Status', is: ['Booked'] } },
    { kind: 'declined', test: null },
  ],
})
const bank = ref('Example bank')
const currency = ref('EUR')

const typed = ref<TableRecipeDraft>({
  name: '',
  date: { column: 'Booking date', format: 'yyyy-MM-dd' },
  amount: { column: '' },
  mark: 'point',
  columns: { currency: 'Currency' },
  kinds: [{ kind: 'booked', test: { column: 'State', is: ['BOOKED', ' PENDING'] } }],
})
const typedBank = ref('')
const typedCurrency = ref('')
const TYPED_ERRORS = recipeErrorsOf([
  { place: 'name', text: 'Give the recipe a name.' },
  { place: 'bank', text: 'Give the bank whose accounts take the rows.' },
  { place: 'amount', text: 'Pick the amount column, or both the money out and money in columns.' },
])

const oneCurrency = ref<TableRecipeDraft>({
  name: 'Example bank business account',
  date: { column: 'Datum', format: 'dd.MM.yyyy' },
  amount: { column: 'Iznos' },
  mark: 'comma',
  columns: { payee: 'Opis' },
  kinds: [{ kind: 'booked', test: null }],
})
const oneCurrencyBank = ref('Example bank')
const oneCurrencyCode = ref('EUR')
</script>

<template>
  <GallerySection
    id="table-recipe-editor"
    title="TableRecipeEditor"
    description="A table recipe column by column, from src/shared/recipes: its name, bank and currency, the day and how it is written, one amount or money out and in, the columns the app reads besides, the decimal mark, and the kinds of row in the order rows are tried, each moved up or down with its arrows. Columns are picked from an open file's header, or typed with none. The second is typed, as Settings opens it, with one amount column, the currency read from a column, and the problems a Save shows under their fields. The third leaves no column to name a row's currency, as Company's import recipes do, so its currency is always picked."
  >
    <div class="flex flex-col gap-8">
      <TableRecipeEditor
        v-model="draft"
        v-model:bank="bank"
        v-model:currency="currency"
        :fields="FIELDS"
        :field-labels="FIELD_LABELS"
        :kind-labels="KIND_LABELS"
        :columns="HEADER"
        :banks="['Example bank', 'Revolut']"
      />
      <TableRecipeEditor
        v-model="typed"
        v-model:bank="typedBank"
        v-model:currency="typedCurrency"
        :fields="FIELDS"
        :field-labels="FIELD_LABELS"
        :kind-labels="KIND_LABELS"
        :columns="null"
        :banks="['Example bank', 'Revolut']"
        :errors="TYPED_ERRORS"
      />
      <TableRecipeEditor
        v-model="oneCurrency"
        v-model:bank="oneCurrencyBank"
        v-model:currency="oneCurrencyCode"
        :fields="ONE_CURRENCY_FIELDS"
        :field-labels="FIELD_LABELS"
        :kind-labels="KIND_LABELS"
        :columns="['Datum', 'Opis', 'Iznos']"
        :banks="['Example bank', 'Revolut']"
        :row-currencies="false"
      />
    </div>
  </GallerySection>
</template>
