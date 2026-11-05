<script setup lang="ts">
import { computed } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import USelectMenu from '@nuxt/ui/components/SelectMenu.vue'

import type { WaitingRow } from '../domain/reviewQueue'
import { words } from './words'
import { entryCategoryChoices } from '../../entries/presentation/categoryChoices'
import type { Account } from '../../workbook/domain/account'
import type { Category } from '../../workbook/domain/category'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import { moneyFromCents } from '../../../../shared/money/money'
import { intlLocale } from '../../../../shared/text/language'
import MoneyText from '../../../../shared/ui/MoneyText.vue'

/** One row waiting for a category: picking one files it, and what the file offers for it sits underneath. */
const props = defineProps<{
  waiting: WaitingRow
  categories: readonly Category[]
  accounts: readonly Account[]
}>()

const emit = defineEmits<{
  file: [category: Category]
  join: []
  pair: []
}>()

const accountOf = (id: string): Account | undefined => props.accounts.find((account) => account.id === id)

const account = computed(() => accountOf(props.waiting.row.account))
const format = computed(() => ({ currency: account.value?.currency ?? 'EUR', locale: intlLocale }))
const items = computed(() => entryCategoryChoices(props.categories, props.waiting.row.amount < 0 ? 'out' : 'in', null, true))

const typedLine = computed(() => {
  const match = props.waiting.maybeTyped
  if (match === null) return null
  return match.difference === 0 ? words.review.maybeApart(match.typed.date) : words.review.maybeDifferent(formatMoney(moneyFromCents(Math.abs(match.difference)), 'negative', format.value))
})

const transferLine = computed(() => {
  const pair = props.waiting.maybeTransfer
  if (pair === null) return null
  const other = pair.debit === props.waiting.row ? pair.credit : pair.debit
  return words.review.maybeTransfer(accountOf(other.account)?.name ?? '')
})

function picked(id: string | undefined): void {
  const category = props.categories.find((candidate) => candidate.id === id)
  if (category !== undefined) emit('file', category)
}
</script>

<template>
  <li class="flex flex-col gap-2 px-4 py-3 sm:px-5" data-testid="spending-review-row">
    <div class="flex items-start gap-3">
      <span class="flex min-w-0 flex-1 flex-col gap-0.5">
        <span class="break-words text-sm text-highlighted">{{ waiting.row.payee || waiting.row.description }}</span>
        <span class="break-words type-caption">{{ [dayLabel(waiting.row.date), account?.name ?? ''].filter((part) => part !== '').join(' · ') }}</span>
      </span>
      <MoneyText :cents="waiting.row.amount" sign="always" tone="flow" class="shrink-0 text-sm" :format="format" />
    </div>
    <USelectMenu
      :items="items"
      value-key="value"
      :placeholder="words.review.pickCategory"
      :aria-label="words.review.pickCategory"
      class="w-full sm:w-72"
      data-testid="spending-review-category"
      @update:model-value="picked"
    />
    <div v-if="typedLine !== null" class="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span class="min-w-0 flex-1 basis-48 text-sm text-muted" data-testid="spending-review-maybe-typed">{{ typedLine }}</span>
      <UButton color="neutral" variant="outline" :label="words.review.join" data-testid="spending-review-join" @click="emit('join')" />
    </div>
    <div v-if="transferLine !== null" class="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span class="min-w-0 flex-1 basis-48 text-sm text-muted" data-testid="spending-review-maybe-transfer">{{ transferLine }}</span>
      <UButton color="neutral" variant="outline" :label="words.review.pair" data-testid="spending-review-pair" @click="emit('pair')" />
    </div>
  </li>
</template>
