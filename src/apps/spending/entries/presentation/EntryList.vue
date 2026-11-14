<script setup lang="ts">
import { computed } from 'vue'

import { categoryColours } from '../../categories/presentation/categoryColours'
import { useLinkLines } from '../../links/presentation/linkLine'
import type { LinkLine } from '../../links/presentation/linkLine'
import type { EuroRow } from '../../rates/domain/euroRows'
import type { Category } from '../../workbook/domain/category'
import { linkOfItems } from '../../workbook/domain/rowItems'
import type { Transaction } from '../../workbook/domain/transaction'
import EntryRow from './EntryRow.vue'
import { entryLine } from './entryLine'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { EURO } from '../../../../shared/money/currencyCode'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import type { AskedElement } from '../../../../shared/ai/presentation/chatDock'

/** Entries by day in the order given, each a row that opens it, with a camera for its receipt: who was paid or paid you, its category with its colour, its account, the record in another app it is linked to, and its amount in the account's currency, with euros under a foreign one. */
const props = withDefaults(
  defineProps<{
    /** Newest first. */
    rows: readonly EuroRow[]
    categories: readonly Category[]
    /** False on an account's own page, where every row is on that account. */
    showAccount?: boolean
    heading?: 'h2' | 'h3'
    /** Whether an entry offers to take a receipt photo. */
    takesReceipt: (entry: Transaction) => boolean
  }>(),
  { showAccount: true, heading: 'h2' },
)

const emit = defineEmits<{ open: [entry: Transaction]; receipt: [entry: AskedElement] }>()

const colours = computed(() => categoryColours(props.categories))
const linkLineOf = useLinkLines()
const byId = computed(() => new Map(props.categories.map((category) => [category.id, category])))

interface Line {
  readonly row: EuroRow
  readonly title: string
  readonly colour: string
  readonly details: string
  readonly euros: string
  readonly link: LinkLine | null
}

const days = computed(() => {
  const groups: { day: CivilDate; lines: Line[] }[] = []
  for (const row of props.rows) {
    const { transaction, account } = row
    const entryLink = linkOfItems(row.items)
    const { title, details, category } = entryLine(row, byId.value, props.showAccount)
    const line: Line = {
      row,
      title,
      colour: `var(${category === null ? '--chart-deemphasis' : colours.value(category)})`,
      details,
      euros: account.currency === EURO || row.euros === null ? '' : formatMoney(row.euros, 'always'),
      link: entryLink === null ? null : linkLineOf.value(entryLink, { amount: transaction.amount, currency: account.currency }),
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
        <EntryRow
          v-for="line in group.lines"
          :key="line.row.transaction.id"
          :row="line.row"
          :categories="categories"
          :title="line.title"
          :colour="line.colour"
          :details="line.details"
          :euros="line.euros"
          :link="line.link"
          :takes-receipt="takesReceipt(line.row.transaction)"
          @open="emit('open', $event)"
          @receipt="emit('receipt', $event)"
        />
      </ul>
    </section>
  </div>
</template>
