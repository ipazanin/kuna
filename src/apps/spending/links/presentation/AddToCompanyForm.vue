<script setup lang="ts">
import { computed, ref } from 'vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import USelect from '@nuxt/ui/components/Select.vue'
import { useToast } from '@nuxt/ui/composables/useToast'

import { addAndLink } from '../application/linkWithRecord'
import { addCompanyCost } from '../../company/application/companyFacts'
import type { CompanyCostCategory } from '../../company/application/companyFacts'
import { toastAddedAndLinked } from './addedAndLinkedToasts'
import { words } from './words'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import type { Category } from '../../workbook/domain/category'
import type { Transaction } from '../../workbook/domain/transaction'
import { words as spendingWords } from '../../words'
import { civilDate, parseCivilDate } from '../../../../shared/calendar/civilDate'
import { absAccountMoney } from '../../../../shared/money/accountMoney'
import type { CurrencyCode } from '../../../../shared/money/currencyCode'
import { amountForTyping, typedAmount } from '../../../../shared/money/typedAmount'
import DayField from '../../../../shared/ui/DayField.vue'
import FormGrid from '../../../../shared/ui/FormGrid.vue'
import MoneyInput from '../../../../shared/ui/MoneyInput.vue'
import { language } from '../../../../shared/text/language'

/**
 * Adds a cost you paid for your company to Company as an owner advance from a saved entry of money out, then files the entry
 * under For the company, linked to it, with one Undo for both. The form's own id lets the dialog's footer submit it, and
 * `saving` is true while either write runs.
 */
const props = defineProps<{
  id: string
  entry: Transaction
  /** True when the entry has parts, which the link replaces with one under For the company. */
  split: boolean
  currency: CurrencyCode
  /** Company's categories a cost the owner paid may count in. */
  costCategories: readonly CompanyCostCategory[]
  /** Spending's categories, which For the company is found in or added to. */
  categories: readonly Category[]
}>()

const emit = defineEmits<{ linked: [] }>()
const saving = defineModel<boolean>('saving', { default: false })

const store = useSpendingBooks()
const toast = useToast()

const categorySlug = ref('')
const costCategory = computed(() => props.costCategories.find((candidate) => candidate.slug === categorySlug.value) ?? null)
const date = ref<string>(props.entry.date)
const amount = ref(amountForTyping(absAccountMoney(props.entry.amount)))
const description = ref(props.entry.payee)
const tried = ref(false)

const categoryItems = computed(() => props.costCategories.map((candidate) => ({ label: candidate.name, value: candidate.slug })))
const day = computed(() => parseCivilDate(date.value))
const typed = computed(() => {
  const cents = typedAmount(amount.value)
  return cents === null || cents <= 0 ? null : cents
})
const errors = computed(() => ({
  category: costCategory.value === null ? words.company.add.pickCategory : null,
  date: day.value === null ? spendingWords.form.aDate(civilDate(2026, 3, 15)) : null,
  amount: typed.value === null ? words.company.add.anAmount : null,
}))

async function save(): Promise<void> {
  tried.value = true
  const category = costCategory.value
  const on = day.value
  const euros = typed.value
  if (category === null || on === null || euros === null || saving.value) return
  saving.value = true
  try {
    const place = { currency: props.currency, categories: props.categories, language, notes: words.notes }
    const titles = { added: words.company.add.inCompany, linked: words.linked }
    const cost = { day: on, amount: euros, description: description.value.trim(), category }
    const result = await addAndLink(store, props.entry, () => addCompanyCost(cost, titles.added), place, titles)
    if (toastAddedAndLinked(toast, result, words.company.add)) emit('linked')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <FormGrid :id="id" as="form" data-testid="spending-add-to-company" @submit.prevent="save">
    <p v-if="split" class="type-caption" data-testid="spending-add-to-company-replaces">{{ words.replacesParts }}</p>
    <UFormField :label="spendingWords.form.date" :error="(tried && errors.date) || false">
      <DayField v-model="date" class="w-full" data-testid="spending-add-to-company-date" />
    </UFormField>
    <UFormField :label="words.company.add.amount" :error="(tried && errors.amount) || false">
      <MoneyInput v-model="amount" :placeholder="spendingWords.form.amountPlaceholder" class="w-full" data-testid="spending-add-to-company-amount" />
    </UFormField>
    <UFormField :label="words.company.add.category" :error="(tried && errors.category) || false" :help="words.company.add.categoryHelp" class="sm:col-span-2">
      <USelect v-model="categorySlug" :items="categoryItems" :placeholder="words.company.add.pickCategory" class="w-full" data-testid="spending-add-to-company-category" />
    </UFormField>
    <UFormField :label="words.company.add.description" class="sm:col-span-2">
      <UInput v-model="description" class="w-full" data-testid="spending-add-to-company-description" />
    </UFormField>
  </FormGrid>
</template>
