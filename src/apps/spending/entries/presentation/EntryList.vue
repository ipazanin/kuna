<script setup lang="ts">
import { computed } from 'vue'
import { labelsOf } from '../../../../shared/categorising/domain/labels'
import type { Label } from '../../../../shared/categorising/domain/labels'

import { categoryColours } from '../../categories/presentation/categoryColours'
import { filedAsBought } from '../../links/domain/linkTarget'
import { useLinkLines } from '../../links/presentation/linkLine'
import type { LinkLine } from '../../links/presentation/linkLine'
import type { EuroRow } from '../../rates/domain/euroRows'
import type { Category } from '../../workbook/domain/category'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { holdsReceipt, linkOfItems } from '../../workbook/domain/rowItems'
import type { Transaction } from '../../workbook/domain/transaction'
import EntryRow from './EntryRow.vue'
import SharedCostRow from '../../sharedCosts/presentation/SharedCostRow.vue'
import type { EntriesLine, SharedCostEntry } from '../../sharedCosts/domain/sharedCostEntries'
import type { SharedCost } from '../../workbook/domain/sharedCost'
import { entryLine } from './entryLine'
import type { EntryLead } from './entryLine'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { EURO } from '../../../../shared/money/currencyCode'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import type { AskedElement } from '../../../../shared/ai/presentation/chatDock'

/** Entries and shared costs by day in the order given, a shared cost with its entries under it, each entry a row that opens it, or picks it while rows are being selected, with a camera for its receipt: who was paid or paid you, its category with its colour, its account, the record in another app it is linked to, its labels, and its amount in the account's currency, with euros under a foreign one. */
const props = withDefaults(
  defineProps<{
    /** Newest first. */
    lines: readonly EntriesLine[]
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
    /** The names of the shared costs a part may be in, by their ids. */
    homes?: ReadonlyMap<RecordId, string>
    /** What each row leads with. A payee's own page names the payee, so its rows lead with their category or note. */
    lead?: EntryLead
  }>(),
  { showAccount: true, heading: 'h2', picked: null, homes: () => new Map(), lead: 'payee' },
)

const emit = defineEmits<{ open: [entry: Transaction]; pick: [entry: Transaction]; receipt: [entry: AskedElement]; openSharedCost: [sharedCost: SharedCost] }>()

const colours = computed(() => categoryColours(props.categories))
const receiptBoxes = computed(() => props.lines.some((line) => line.kind === 'entry' && holdsReceipt(line.row.items)))
const linkLineOf = useLinkLines()
const byId = computed(() => new Map(props.categories.map((category) => [category.id, category])))
const labelNames = computed(() => new Map(props.labels.map((label) => [label.id, label.name])))

interface Line {
  readonly kind: 'entry'
  readonly row: EuroRow
  readonly title: string
  readonly colour: string
  readonly details: string
  readonly euros: string
  readonly link: LinkLine | null
  /** The names of the labels the entry's parts carry, or blank. */
  readonly labels: string
}

/** A shared cost with the colour of its category's dot. */
interface SharedLine {
  readonly kind: 'shared-cost'
  readonly entry: SharedCostEntry
  readonly colour: string
}

function dotColour(category: Category | null): string {
  return `var(${category === null ? '--chart-deemphasis' : colours.value(category)})`
}

const days = computed(() => {
  const groups: { day: CivilDate; lines: (Line | SharedLine)[] }[] = []
  const add = (day: CivilDate, line: Line | SharedLine): void => {
    const last = groups.at(-1)
    if (last?.day === day) last.lines.push(line)
    else groups.push({ day, lines: [line] })
  }
  for (const listed of props.lines) {
    if (listed.kind === 'shared-cost') {
      add(listed.entry.sharedCost.day, { kind: 'shared-cost', entry: listed.entry, colour: dotColour(byId.value.get(listed.entry.sharedCost.category) ?? null) })
      continue
    }
    const { row } = listed
    const { transaction, account } = row
    const entryLink = linkOfItems(row.items)
    const { title, details, category } = entryLine(row, byId.value, props.showAccount, props.homes, props.lead)
    const line: Line = {
      kind: 'entry',
      row,
      title,
      colour: dotColour(category),
      details,
      euros: account.currency === EURO || row.euros === null ? '' : formatMoney(row.euros, 'always'),
      link: entryLink === null ? null : linkLineOf.value(entryLink, { amount: transaction.amount, currency: account.currency, bought: filedAsBought(row.items, props.categories) }),
      labels: labelsOf(row.items)
        .flatMap((id) => labelNames.value.get(id) ?? [])
        .join(', '),
    }
    add(transaction.date, line)
  }
  return groups
})
</script>

<template>
  <div class="pb-2">
    <section v-for="group in days" :key="group.day">
      <component :is="heading" class="group-row px-4 py-2.5 type-body sm:px-5" data-testid="spending-day">{{ dayLabel(group.day) }}</component>
      <ul>
        <template v-for="line in group.lines" :key="line.kind === 'entry' ? line.row.transaction.id : line.entry.sharedCost.id">
          <SharedCostRow
            v-if="line.kind === 'shared-cost'"
            :entry="line.entry"
            :categories="categories"
            :labels="labels"
            :colour="line.colour"
            :picking="picked !== null"
            :show-account="showAccount"
            :receipt-boxes="receiptBoxes"
            @open="emit('openSharedCost', $event)"
            @open-entry="emit('open', $event)"
          />
          <EntryRow
            v-else
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
            :homes="homes"
            @open="picked === null ? emit('open', $event) : emit('pick', $event)"
            @receipt="emit('receipt', $event)"
          />
        </template>
      </ul>
    </section>
  </div>
</template>
