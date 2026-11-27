<script setup lang="ts">
import { computed } from 'vue'

import { sharedCostName } from './sharedCostNames'
import { words } from './words'
import type { SharedCostEntry } from '../domain/sharedCostEntries'
import AccountMoneyText from '../../accounts/presentation/AccountMoneyText.vue'
import ReceiptCameraButton from '../../receipts/presentation/ReceiptCameraButton.vue'
import type { Category } from '../../workbook/domain/category'
import type { Transaction } from '../../workbook/domain/transaction'
import type { SharedCost } from '../../workbook/domain/sharedCost'
import type { Label } from '../../../../shared/categorising/domain/labels'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { sumAccountMoney } from '../../../../shared/money/accountMoney'
import { plural } from '../../../../shared/text/translation'
import ListRow from '../../../../shared/ui/ListRow.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'
import NoteLine from '../../../../shared/ui/NoteLine.vue'

/**
 * A shared cost on Entries: a row that opens it, with its name, category, what it counts in euros and its labels, and under
 * it each of its entries on its own day, which opens that entry. While entries are being picked neither opens, and a dashed box
 * says the shared cost is no entry to pick.
 */
const props = defineProps<{
  entry: SharedCostEntry
  categories: readonly Category[]
  labels: readonly Label[]
  /** The colour of its category's dot. */
  colour: string
  /** Whether entries are being picked. */
  picking: boolean
  /** False on an account's own page, where every row is on that account. */
  showAccount: boolean
  /** Whether a row of the list holds a receipt, so this row keeps the empty box an entry's camera sits in. */
  receiptBoxes: boolean
}>()

const emit = defineEmits<{ open: [sharedCost: SharedCost]; openEntry: [entry: Transaction] }>()

const sharedCost = computed(() => props.entry.sharedCost)
const name = computed(() => sharedCostName(sharedCost.value, props.categories))
const euros = computed(() => props.entry.counted.parts[0]?.euros ?? null)
const details = computed(() =>
  [props.categories.find((category) => category.id === sharedCost.value.category)?.name ?? '', plural(words.row.entries(props.entry.members.length), props.entry.members.length), sharedCost.value.note]
    .filter((part) => part !== '')
    .join(' · '),
)
const labelNames = computed(() => sharedCost.value.labels.flatMap((id) => props.labels.find((label) => label.id === id)?.name ?? []).join(', '))
const members = computed(() =>
  props.entry.members.map(({ row, parts }) => ({
    row,
    amount: sumAccountMoney(parts.map((part) => part.amount)),
    line: [dayLabel(row.transaction.date), row.transaction.payee, props.showAccount ? row.account.name : ''].filter((part) => part !== '').join(' · '),
  })),
)
</script>

<template>
  <li class="flex flex-col" data-testid="spending-shared-cost">
    <ListRow as="div" :title="name" :picked="picking ? false : null" unpickable opens data-testid="spending-shared-cost-open" @open="emit('open', sharedCost)">
      <template #lead><span class="size-2.5 rounded-full" :style="{ background: colour }" /></template>
      <template #amount>
        <MoneyText v-if="euros !== null" :cents="euros" tone="flow" data-testid="spending-shared-cost-amount" />
        <span v-else class="type-caption">{{ words.row.notRated }}</span>
      </template>
      <template #details>
        <NoteLine as="span" tone="muted" icon="i-lucide-users">{{ details }}</NoteLine>
        <NoteLine v-if="sharedCost.settled" as="span" tone="muted" icon="i-lucide-check-check" data-testid="spending-shared-cost-settled">{{ words.row.settled }}</NoteLine>
        <NoteLine v-if="labelNames !== ''" as="span" tone="muted" icon="i-lucide-tag">{{ labelNames }}</NoteLine>
      </template>
      <template #trailing><ReceiptCameraButton label="" :available="false" :boxed="receiptBoxes" testid="spending-shared-cost-box" /></template>
    </ListRow>
    <ul class="pb-1.5" :aria-label="words.dialog.entries">
      <ListRow
        v-for="member in members"
        :key="member.row.transaction.id"
        :title="member.line"
        nested
        :picked="picking ? false : null"
        unpickable
        opens
        data-testid="spending-shared-cost-member"
        @open="emit('openEntry', member.row.transaction)"
      >
        <template #amount><AccountMoneyText :cents="member.amount" :currency="member.row.account.currency" tone="flow" /></template>
        <template #trailing><ReceiptCameraButton label="" :available="false" :boxed="receiptBoxes" testid="spending-shared-cost-box" /></template>
      </ListRow>
    </ul>
  </li>
</template>
