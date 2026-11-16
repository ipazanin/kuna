<script setup lang="ts">
import { computed } from 'vue'

import { categoryColours } from '../../categories/presentation/categoryColours'
import { useLinkLines } from '../../links/presentation/linkLine'
import type { LinkLine } from '../../links/presentation/linkLine'
import type { EuroRow } from '../../rates/domain/euroRows'
import type { Category } from '../../workbook/domain/category'
import type { Label } from '../../workbook/domain/label'
import { labelsOf } from '../../workbook/domain/carriedChoices'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { holdsReceipt, linkOfItems } from '../../workbook/domain/rowItems'
import type { Transaction } from '../../workbook/domain/transaction'
import EntryRow from './EntryRow.vue'
import { entryLine } from './entryLine'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { EURO } from '../../../../shared/money/currencyCode'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import type { AskedElement } from '../../../../shared/ai/presentation/chatDock'

/** Entries by day in the order given, each a row that opens it, or picks it while rows are being selected, with a camera for its receipt: who was paid or paid you, its category with its colour, its account, the record in another app it is linked to, its labels, and its amount in the account's currency, with euros under a foreign one. */
const props = withDefaults(
  defineProps<{
    /** Newest first. */
    rows: readonly EuroRow[]
    categories: readonly Category[]
    /** The file's labels, which each row names in its caption. */
    labels: readonly Label[]
    /** The entries picked while rows are being selected, or null while a tap opens an entry. */
    picked?: ReadonlySet<RecordId> | null
    /** False on an account's own page, where every row is on that account. */
    showAccount?: boolean
    heading?: 'h2' | 'h3'
    /** Whether an entry offers to take a receipt photo. */
    takesReceipt: (entry: Transaction) => boolean
  }>(),
  { showAccount: true, heading: 'h2', picked: null },
)

const emit = defineEmits<{ open: [entry: Transaction]; pick: [entry: Transaction]; receipt: [entry: AskedElement] }>()

const colours = computed(() => categoryColours(props.categories))
const receiptBoxes = computed(() => props.rows.some((row) => holdsReceipt(row.items)))
const linkLineOf = useLinkLines()
const byId = computed(() => new Map(props.categories.map((category) => [category.id, category])))
const labelNames = computed(() => new Map(props.labels.map((label) => [label.id, label.name])))

interface Line {
  readonly row: EuroRow
  readonly title: string
  readonly colour: string
  readonly details: string
  readonly euros: string
  readonly link: LinkLine | null
  /** The names of the labels the entry's parts carry, or blank. */
  readonly labels: string
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
      labels: labelsOf(row.items)
        .flatMap((id) => labelNames.value.get(id) ?? [])
        .join(', '),
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
          :labels="line.labels"
          :picked="picked === null ? null : picked.has(line.row.transaction.id)"
          :takes-receipt="takesReceipt(line.row.transaction)"
          :receipt-boxes="receiptBoxes"
          @open="picked === null ? emit('open', $event) : emit('pick', $event)"
          @receipt="emit('receipt', $event)"
        />
      </ul>
    </section>
  </div>
</template>
