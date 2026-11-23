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
import MoneyText from '../../../../shared/ui/MoneyText.vue'
import NoteLine from '../../../../shared/ui/NoteLine.vue'
import PickBox from '../../../../shared/ui/PickBox.vue'

/**
 * A shared cost on Entries: a button that opens it, with its name, category, what it counts in euros and its labels, and under
 * it each of its entries on its own day, which opens that entry. While entries are being picked neither opens, and a dashed box
 * says a shared cost is no entry to pick. Its members' amounts end left of its own, as a split's parts do.
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
  <li class="flex flex-col border-t border-default first:border-t-0" data-testid="spending-shared-cost">
    <span class="flex items-center">
      <button
        type="button"
        class="flex min-w-0 flex-1 items-center gap-3 px-4 pt-2.5 pb-1.5 text-start transition-colors enabled:hover:bg-elevated/40 sm:px-5"
        :disabled="picking"
        data-testid="spending-shared-cost-open"
        @click="emit('open', sharedCost)"
      >
        <PickBox v-if="picking" :picked="false" unpickable />
        <span class="size-2.5 shrink-0 rounded-full" :style="{ background: colour }" aria-hidden="true" />
        <span class="flex min-w-0 flex-1 flex-col gap-0.5">
          <span class="break-words type-row-title">{{ name }}</span>
          <NoteLine as="span" tone="muted" icon="i-lucide-users">{{ details }}</NoteLine>
          <NoteLine v-if="sharedCost.settled" as="span" tone="muted" icon="i-lucide-check-check" data-testid="spending-shared-cost-settled">{{ words.row.settled }}</NoteLine>
          <NoteLine v-if="labelNames !== ''" as="span" tone="muted" icon="i-lucide-tag">{{ labelNames }}</NoteLine>
        </span>
        <span class="flex shrink-0 flex-col items-end type-body">
          <MoneyText v-if="euros !== null" :cents="euros" tone="flow" data-testid="spending-shared-cost-amount" />
          <span v-else class="type-caption">{{ words.row.notRated }}</span>
        </span>
      </button>
      <ReceiptCameraButton v-if="!picking" label="" :available="false" :boxed="receiptBoxes" testid="spending-shared-cost-box" class="me-2 shrink-0 sm:me-3" />
    </span>
    <ul class="pb-1.5" :aria-label="words.dialog.entries">
      <li v-for="member in members" :key="member.row.transaction.id" class="flex items-center">
        <button
          type="button"
          class="flex min-w-0 flex-1 items-center gap-3 py-1.5 pe-4 text-start transition-colors enabled:hover:bg-elevated/40 sm:pe-5"
          :class="picking ? 'ps-17.5 sm:ps-18.5' : 'ps-9.5 sm:ps-10.5'"
          :disabled="picking"
          data-testid="spending-shared-cost-member"
          @click="emit('openEntry', member.row.transaction)"
        >
          <span class="min-w-0 flex-1 break-words type-caption">{{ member.line }}</span>
          <AccountMoneyText :cents="member.amount" :currency="member.row.account.currency" tone="flow" class="shrink-0 type-caption" />
          <!-- An invisible copy of the shared cost's figure keeps a member's amount left of it, where a split's part ends. -->
          <span class="invisible flex h-0 shrink-0 overflow-hidden type-body" aria-hidden="true">
            <MoneyText v-if="euros !== null" :cents="euros" tone="flow" />
            <span v-else class="type-caption">{{ words.row.notRated }}</span>
          </span>
        </button>
        <ReceiptCameraButton v-if="!picking" label="" :available="false" :boxed="receiptBoxes" testid="spending-shared-cost-box" class="me-2 shrink-0 sm:me-3" />
      </li>
    </ul>
  </li>
</template>
