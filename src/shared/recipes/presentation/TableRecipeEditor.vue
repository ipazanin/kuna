<script setup lang="ts">
import { computed } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import URadioGroup from '@nuxt/ui/components/RadioGroup.vue'
import USelect from '@nuxt/ui/components/Select.vue'
import UTooltip from '@nuxt/ui/components/Tooltip.vue'

import { dayExample } from './dayExample'
import RecipeColumnField from './RecipeColumnField.vue'
import { NO_RECIPE_ERRORS } from './recipeErrors'
import type { RecipeErrors } from './recipeErrors'
import { words } from './words'
import { DRAFT_DATE_FORMATS, kindAdded, kindChanged, kindMoved, kindRemoved } from '../domain/tableRecipeDraft'
import type { DraftTest, TableRecipeDraft, TableRecipeFields } from '../domain/tableRecipeDraft'
import BankNameField from '../../ui/BankNameField.vue'
import CurrencySelect from '../../ui/CurrencySelect.vue'
import FormGrid from '../../ui/FormGrid.vue'
import MoveButtons from '../../ui/MoveButtons.vue'
import NoteLine from '../../ui/NoteLine.vue'
import { useRowKeys } from '../../ui/useRowKeys'

/**
 * Edits a table recipe column by column: its name, the bank and currency of its rows, the day and how it is written, the
 * amount as one signed column or a debit and credit pair, the columns the app may read besides, the decimal mark, and the
 * kinds of row in the order rows are tried, each moved up or down with its buttons. The app hands in what it reads, its
 * words for each field and kind, and the problems to show under the fields.
 */
const props = withDefaults(
  defineProps<{
    fields: TableRecipeFields
    /** The app's name for each field it reads, by the field. */
    fieldLabels: Readonly<Record<string, string>>
    /** The app's name for each kind of row, by the kind. */
    kindLabels: Readonly<Record<string, string>>
    /** The header row of the open file, so columns are picked from it, or null to type them. */
    columns: readonly string[] | null
    /** The bank names to suggest. */
    banks: readonly string[]
    errors?: RecipeErrors
    /** Whether a column may name each row's currency, so the currency may be left to it. */
    rowCurrencies?: boolean
  }>(),
  { errors: () => NO_RECIPE_ERRORS, rowCurrencies: true },
)
const draft = defineModel<TableRecipeDraft>({ required: true })
const bank = defineModel<string>('bank', { required: true })
/** The currency of every row, or empty where a column names each row's own. */
const currency = defineModel<string>('currency', { required: true })

const formatItems = DRAFT_DATE_FORMATS.map((format): { label: string; value: string } => ({ label: dayExample(format), value: format }))
const amountItems = [
  { label: words.oneColumn, value: 'one' },
  { label: words.twoColumns, value: 'two' },
]
const markItems = [
  { label: words.marks.comma, value: 'comma' },
  { label: words.marks.point, value: 'point' },
]
const kindItems = computed(() => props.fields.kinds.map(({ kind }) => ({ label: props.kindLabels[kind] ?? kind, value: kind })))
const testItems = [
  { label: words.everyRow, value: 'every' },
  { label: words.isOneOf, value: 'is' },
  { label: words.isFilled, value: 'filled' },
]

function update(changes: Partial<TableRecipeDraft>): void {
  draft.value = { ...draft.value, ...changes }
}

const amountShape = computed(() => ('column' in draft.value.amount ? 'one' : 'two'))

function setAmountShape(shape: string): void {
  const now = draft.value.amount
  const first = 'column' in now ? now.column : now.debit
  update({ amount: shape === 'one' ? { column: first } : { debit: first, credit: 'credit' in now ? now.credit : '' } })
}

function setColumn(column: string): void {
  update({ amount: { column } })
}

function setPair(side: 'debit' | 'credit', column: string): void {
  const now = draft.value.amount
  const pair = 'debit' in now ? now : { debit: '', credit: '' }
  update({ amount: { ...pair, [side]: column } })
}

function setOptional(field: string, column: string): void {
  const { [field]: _left, ...others } = draft.value.columns
  update({ columns: column.trim() === '' ? others : { ...others, [field]: column } })
}

function testShape(test: DraftTest | null): string {
  return test === null ? 'every' : 'filled' in test ? 'filled' : 'is'
}

function setTestShape(at: number, shape: string): void {
  const held = draft.value.kinds[at]!
  const column = held.test?.column ?? ''
  draft.value = kindChanged(draft.value, at, {
    ...held,
    test: shape === 'every' ? null : shape === 'filled' ? { column, filled: true } : { column, is: held.test !== null && 'is' in held.test ? held.test.is : [] },
  })
}

function setTestColumn(at: number, column: string): void {
  const held = draft.value.kinds[at]!
  if (held.test !== null) draft.value = kindChanged(draft.value, at, { ...held, test: { ...held.test, column } })
}

/** The values as typed, commas and spaces kept, so the field never rewrites its text. The recipe trims them when it is made. */
function setValues(at: number, text: string): void {
  const held = draft.value.kinds[at]!
  if (held.test !== null) draft.value = kindChanged(draft.value, at, { ...held, test: { column: held.test.column, is: text.split(',') } })
}

/** The problem of the amount under each of its columns left blank. */
function amountError(column: string): string | false {
  return column.trim() === '' ? (props.errors.fields.amount ?? false) : false
}

const kindKeys = useRowKeys(() => draft.value.kinds)
</script>

<template>
  <div class="flex flex-col gap-4" data-testid="recipe-editor">
    <FormGrid>
      <UFormField :label="words.name" :help="words.nameHelp" :error="errors.fields.name ?? false" class="sm:col-span-2">
        <UInput :model-value="draft.name" autocomplete="off" class="w-full" data-testid="recipe-name" @update:model-value="update({ name: String($event) })" />
      </UFormField>
      <UFormField :label="words.bank" :help="words.bankHelp" :error="errors.fields.bank ?? false">
        <BankNameField v-model="bank" :banks="banks" data-testid="recipe-bank" />
      </UFormField>
      <UFormField :label="words.currency" :error="errors.fields.currency ?? false">
        <CurrencySelect v-model="currency" :search="words.findCurrency" :blank-choice="rowCurrencies ? words.currencyFromColumn : ''" class="w-full" data-testid="recipe-currency" />
      </UFormField>
      <UFormField :label="words.day" :error="errors.fields.day ?? false">
        <RecipeColumnField :model-value="draft.date.column" :columns="columns" data-testid="recipe-day" @update:model-value="update({ date: { ...draft.date, column: $event } })" />
      </UFormField>
      <UFormField :label="words.dayFormat" :error="errors.fields.format ?? false">
        <template #help>
          {{ words.dayFormatHelp }} <span class="whitespace-nowrap">{{ dayExample('yyyy-MM-dd') }}.</span>
        </template>
        <USelect
          :model-value="draft.date.format"
          :items="formatItems"
          class="w-full"
          data-testid="recipe-day-format"
          @update:model-value="update({ date: { ...draft.date, format: String($event) } })"
        />
      </UFormField>
      <UFormField :label="words.amounts" class="sm:col-span-2">
        <URadioGroup :model-value="amountShape" :items="amountItems" data-testid="recipe-amounts" @update:model-value="setAmountShape(String($event))" />
      </UFormField>
      <UFormField v-if="'column' in draft.amount" :label="fieldLabels[fields.amount] ?? fields.amount" :error="amountError(draft.amount.column)">
        <RecipeColumnField :model-value="draft.amount.column" :columns="columns" data-testid="recipe-amount" @update:model-value="setColumn" />
      </UFormField>
      <template v-else>
        <UFormField :label="fieldLabels[fields.debit] ?? fields.debit" :error="amountError(draft.amount.debit)">
          <RecipeColumnField :model-value="draft.amount.debit" :columns="columns" data-testid="recipe-debit" @update:model-value="setPair('debit', $event)" />
        </UFormField>
        <UFormField :label="fieldLabels[fields.credit] ?? fields.credit" :error="amountError(draft.amount.credit)">
          <RecipeColumnField :model-value="draft.amount.credit" :columns="columns" data-testid="recipe-credit" @update:model-value="setPair('credit', $event)" />
        </UFormField>
      </template>
      <UFormField :label="words.mark" :help="words.markHelp">
        <USelect :model-value="draft.mark" :items="markItems" class="w-full" data-testid="recipe-mark" @update:model-value="update({ mark: $event === 'comma' ? 'comma' : 'point' })" />
      </UFormField>
      <UFormField v-for="optional in fields.optional" :key="optional.field" :label="fieldLabels[optional.field] ?? optional.field">
        <RecipeColumnField
          :model-value="draft.columns[optional.field] ?? ''"
          :columns="columns"
          optional
          :data-testid="`recipe-column-${optional.field}`"
          @update:model-value="setOptional(optional.field, $event)"
        />
      </UFormField>
    </FormGrid>
    <section class="flex flex-col gap-3" data-testid="recipe-kinds">
      <div>
        <h3 class="type-card-title">{{ words.kinds }}</h3>
        <p class="type-caption">{{ words.kindsHelp }}</p>
      </div>
      <fieldset v-for="(held, at) in draft.kinds" :key="kindKeys[at]" class="flex flex-col gap-2 border-t border-default pt-3" data-testid="recipe-kind">
        <legend class="sr-only">{{ words.kindAt(at + 1) }}</legend>
        <FormGrid>
          <UFormField :label="words.kind" :error="errors.kinds[at]?.kind ?? false">
            <USelect :model-value="held.kind" :items="kindItems" class="w-full" @update:model-value="draft = kindChanged(draft, at, { ...held, kind: String($event) })" />
          </UFormField>
          <UFormField :label="words.test">
            <USelect :model-value="testShape(held.test)" :items="testItems" class="w-full" data-testid="recipe-kind-test" @update:model-value="setTestShape(at, String($event))" />
          </UFormField>
          <UFormField v-if="held.test !== null" :label="words.chooseColumn" :error="errors.kinds[at]?.column ?? false">
            <RecipeColumnField :model-value="held.test.column" :columns="columns" data-testid="recipe-kind-column" @update:model-value="setTestColumn(at, $event)" />
          </UFormField>
          <UFormField v-if="held.test !== null && 'is' in held.test" :label="words.values" :error="errors.kinds[at]?.values ?? false">
            <UInput :model-value="held.test.is.join(',')" autocomplete="off" class="w-full" data-testid="recipe-kind-values" @update:model-value="setValues(at, String($event))" />
          </UFormField>
        </FormGrid>
        <div class="flex items-center justify-end gap-1">
          <MoveButtons
            :up-label="words.moveKindUp(at + 1)"
            :down-label="words.moveKindDown(at + 1)"
            :first="at === 0"
            :last="at === draft.kinds.length - 1"
            test-id="recipe-kind"
            @up="draft = kindMoved(draft, at, -1)"
            @down="draft = kindMoved(draft, at, 1)"
          />
          <UTooltip :text="draft.kinds.length <= 1 ? words.oneKind : words.removeKind">
            <span class="inline-flex">
              <UButton
                :label="words.removeKind"
                icon="i-lucide-x"
                color="neutral"
                variant="ghost"
                size="sm"
                :disabled="draft.kinds.length <= 1"
                data-testid="recipe-remove-kind"
                @click="draft = kindRemoved(draft, at)"
              />
            </span>
          </UTooltip>
        </div>
      </fieldset>
      <NoteLine v-if="errors.fields.kinds !== undefined" tone="error" data-testid="recipe-kinds-error">{{ errors.fields.kinds }}</NoteLine>
      <UButton :label="words.addKind" icon="i-lucide-plus" color="neutral" variant="outline" class="self-start" data-testid="recipe-add-kind" @click="draft = kindAdded(draft, fields)" />
    </section>
  </div>
</template>
