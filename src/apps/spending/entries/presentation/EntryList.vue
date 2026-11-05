<script setup lang="ts">
import { computed } from 'vue'

import { categoryColours } from '../../categories/presentation/categoryColours'
import type { EuroRow } from '../../rates/domain/euroRows'
import type { Category } from '../../workbook/domain/category'
import type { Transaction } from '../../workbook/domain/transaction'
import { words } from './words'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { EURO } from '../../../../shared/money/currencyCode'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import { intlLocale } from '../../../../shared/text/language'
import MoneyText from '../../../../shared/ui/MoneyText.vue'

/** Entries by day in the order given, each a row that opens it: who was paid or paid you, its category with its colour, its account and its amount in the account's currency, with euros under a foreign one. */
const props = withDefaults(
  defineProps<{
    /** Newest first. */
    rows: readonly EuroRow[]
    categories: readonly Category[]
    /** False on an account's own page, where every row is on that account. */
    showAccount?: boolean
    heading?: 'h2' | 'h3'
  }>(),
  { showAccount: true, heading: 'h2' },
)

const emit = defineEmits<{ open: [entry: Transaction] }>()

const colours = computed(() => categoryColours(props.categories))
const byId = computed(() => new Map(props.categories.map((category) => [category.id, category])))

interface Line {
  readonly row: EuroRow
  readonly title: string
  readonly colour: string
  readonly details: string
  readonly euros: string
}

const days = computed(() => {
  const groups: { day: CivilDate; lines: Line[] }[] = []
  for (const row of props.rows) {
    const { transaction, account } = row
    const category = transaction.category === null ? null : (byId.value.get(transaction.category) ?? null)
    const categoryName = category?.name ?? words.waitsOnReview
    const line: Line = {
      row,
      title: transaction.payee === '' ? categoryName : transaction.payee,
      colour: `var(${category === null ? '--chart-deemphasis' : colours.value(category)})`,
      details: [transaction.payee === '' ? '' : categoryName, props.showAccount ? account.name : '', transaction.note].filter((part) => part !== '').join(' · '),
      euros: account.currency === EURO || row.euros === null ? '' : formatMoney(row.euros, 'always'),
    }
    const last = groups.at(-1)
    if (last?.day === transaction.date) last.lines.push(line)
    else groups.push({ day: transaction.date, lines: [line] })
  }
  return groups
})
</script>

<template>
  <div class="pb-2">
    <section v-for="group in days" :key="group.day">
      <component :is="heading" class="group-row px-4 py-2.5 type-body sm:px-5" data-testid="spending-day">{{ dayLabel(group.day) }}</component>
      <ul>
        <li v-for="line in group.lines" :key="line.row.transaction.id" class="border-t border-default first:border-t-0">
          <button
            type="button"
            class="flex w-full items-center gap-3 px-4 py-2.5 text-start transition-colors hover:bg-elevated/40 sm:px-5"
            data-testid="spending-row"
            :data-amount="line.row.transaction.amount"
            @click="emit('open', line.row.transaction)"
          >
            <span class="size-2.5 shrink-0 rounded-full" :style="{ background: line.colour }" aria-hidden="true" />
            <span class="flex min-w-0 flex-1 flex-col gap-0.5">
              <span class="break-words text-sm text-highlighted">{{ line.title }}</span>
              <span v-if="line.details !== ''" class="break-words type-caption">{{ line.details }}</span>
            </span>
            <span class="flex shrink-0 flex-col items-end gap-0.5 type-body">
              <MoneyText :cents="line.row.transaction.amount" sign="always" tone="flow" :format="{ currency: line.row.account.currency, locale: intlLocale }" />
              <span v-if="line.euros !== ''" class="figure type-caption">{{ line.euros }}</span>
            </span>
          </button>
        </li>
      </ul>
    </section>
  </div>
</template>
