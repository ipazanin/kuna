<script setup lang="ts">
import type { AddInApp } from './addInApp'
import AddToCompanyForm from './AddToCompanyForm.vue'
import AddToLoansForm from './AddToLoansForm.vue'
import type { Category } from '../../workbook/domain/category'
import type { Transaction } from '../../workbook/domain/transaction'
import type { CurrencyCode } from '../../../../shared/money/currencyCode'

/** The form that adds the record in the app the entry dialog picked, Loans or Company, and links the entry to it. */
defineProps<{
  id: string
  entry: Transaction
  /** True when the entry has parts, which the link replaces. */
  split: boolean
  currency: CurrencyCode
  adding: AddInApp
  categories: readonly Category[]
}>()

const emit = defineEmits<{ linked: [] }>()
const saving = defineModel<boolean>('saving', { default: false })
</script>

<template>
  <AddToLoansForm
    v-if="adding.app === 'loans'"
    :id="id"
    v-model:saving="saving"
    :entry="entry"
    :split="split"
    :currency="currency"
    :loans="adding.loans"
    :categories="categories"
    @linked="emit('linked')"
  />
  <AddToCompanyForm
    v-else
    :id="id"
    v-model:saving="saving"
    :entry="entry"
    :split="split"
    :currency="currency"
    :cost-categories="adding.costCategories"
    :categories="categories"
    @linked="emit('linked')"
  />
</template>
