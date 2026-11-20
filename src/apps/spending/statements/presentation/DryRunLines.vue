<script setup lang="ts">
import { computed, ref } from 'vue'
import UBadge from '@nuxt/ui/components/Badge.vue'

import { wantsSavingsAccount } from '../../pairing/domain/wantsSavingsAccount'
import type { DryRunLine } from '../domain/statementDryRun'
import { isBankSyncKey } from '../domain/statementRows'
import { rowCaption, rowTitle } from './rowParts'
import { words } from './words'
import { filedAsBought } from '../../links/domain/linkTarget'
import { targetLineOf } from '../../links/presentation/linkLine'
import RowLines from '../../receipts/presentation/RowLines.vue'
import { partTone } from '../../categories/presentation/amountTone'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import type { Category } from '../../workbook/domain/category'
import { isSplit } from '../../workbook/domain/rowItems'
import type { Transaction } from '../../workbook/domain/transaction'
import AccountMoneyText from '../../accounts/presentation/AccountMoneyText.vue'
import NoteLine from '../../../../shared/ui/NoteLine.vue'
import ListRow from '../../../../shared/ui/ListRow.vue'
import ShowAllButton, { FIRST_SHOWN } from '../../../../shared/ui/ShowAllButton.vue'
import { EURO } from '../../../../shared/money/currencyCode'
import { formatAccountMoney } from '../../../../shared/money/moneyFormat'
import type { MoneyTone } from '../../../../shared/money/moneyFormat'

/** Each row of a statement and what importing it would do. */
const props = defineProps<{
  lines: readonly DryRunLine[]
  /** The categories the import adds to the file, which its links need. */
  added?: readonly Category[] | undefined
  /** Whether questions about rows sit above the list, which a line then parts it from. */
  belowQuestions: boolean
}>()

const { state } = useSpendingBooks()

const categories = computed(() => [...(state.workbook?.categories ?? []), ...(props.added ?? [])])

/** A first import has thousands of rows, which a phone cannot lay out at once. */
const allShown = ref(false)

const shown = computed(() => {
  const byId = new Map(categories.value.map((category) => [category.id, category]))
  const accounts = new Map((state.workbook?.accounts ?? []).map((account) => [account.id, account]))
  return (allShown.value ? props.lines : props.lines.slice(0, FIRST_SHOWN)).map((line) => {
    const category = line.category === null ? undefined : byId.get(line.category)
    const named = category?.name ?? words.import.outcome.waits
    const outcome = outcomeOf(line, named)
    const account = accounts.get(line.row.account)
    const currency = account?.currency ?? EURO
    const pays = line.outcome === 'new' && line.pays !== undefined ? line.pays : null
    const asksCash = line.outcome === 'new' && line.withdrawal !== null && line.withdrawal.cashLeg === null
    const tone: MoneyTone = asksCash ? 'flow' : partTone(category)
    return {
      line,
      outcome,
      account,
      currency,
      paid:
        pays === null
          ? null
          : { text: targetLineOf(pays.target, { amount: line.row.amount, currency, bought: filedAsBought(pays.parts, categories.value) }), parts: isSplit(pays.parts) ? pays.parts : [] },
      skipped:
        line.outcome === 'already-in' ||
        line.outcome === 'other-source' ||
        line.outcome === 'outside-days' ||
        line.outcome === 'before-opening' ||
        line.outcome === 'not-taken' ||
        line.outcome === 'look-alike',
      tone,
    }
  })
})

type BadgeColor = 'neutral' | 'info' | 'warning' | 'success'

/** The badge each outcome shows. The switch names every outcome, so a new one does not compile until it has a badge. */
function outcomeOf(line: DryRunLine, named: string): { readonly label: string; readonly color: BadgeColor } {
  switch (line.outcome) {
    case 'already-in':
      return { label: words.import.outcome.alreadyIn, color: 'neutral' }
    case 'other-source':
      return { label: isBankSyncKey(line.row.importKey) ? words.import.outcome.coveredByFile : words.import.outcome.coveredBySync, color: 'neutral' }
    case 'look-alike':
      if (line.row.pending) return { label: words.import.outcome.waitsToBook, color: 'neutral' }
      return { label: isBankSyncKey(line.row.importKey) ? words.import.outcome.lookAlikeSynced : words.import.outcome.lookAlike, color: 'info' }
    case 'filled':
      return { label: words.import.outcome.filled, color: 'info' }
    case 'booked':
      return { label: words.import.outcome.booked, color: 'info' }
    case 'replaced':
      return { label: isBankSyncKey(line.like.importKey) ? words.import.outcome.replacedSynced : words.import.outcome.replaced, color: 'info' }
    case 'outside-days':
      return { label: words.import.outcome.outsideDays, color: 'neutral' }
    case 'before-opening':
      return { label: words.import.outcome.beforeOpening, color: 'neutral' }
    case 'not-taken':
      return { label: words.import.outcome.notTaken, color: 'neutral' }
    case 'refiled':
      return { label: words.import.outcome.refiled(named), color: 'info' }
    case 'new':
      if (line.withdrawal !== null) return cashOutcomeOf(line.withdrawal.cashLeg)
      if (line.pays !== undefined && isSplit(line.pays.parts)) return { label: words.import.outcome.linked, color: 'success' }
      return wantsSavingsAccount(line.row, state.workbook?.accounts ?? [])
        ? { label: words.review.wantsSavings, color: 'warning' }
        : { label: named, color: line.category === null ? 'warning' : 'success' }
  }
}

/** Cash taken out: the money its leg brings to the cash account, or that it asks which account. */
function cashOutcomeOf(cashLeg: Transaction | null): { readonly label: string; readonly color: BadgeColor } {
  const account = cashLeg === null ? undefined : state.workbook?.accounts.find((candidate) => candidate.id === cashLeg.account)
  if (cashLeg === null || account === undefined) return { label: words.import.outcome.asksCash, color: 'warning' }
  return { label: words.review.cash.toCash(formatAccountMoney(cashLeg.amount, account.currency, 'always'), account.name), color: 'success' }
}
</script>

<template>
  <ul class="flex flex-col divide-y divide-default" :class="{ 'border-t border-default': belowQuestions }" data-testid="spending-dry-run-rows">
    <ListRow
      v-for="({ line, outcome, account, currency, paid, skipped, tone }, place) in shown"
      :key="place"
      :title="rowTitle(line.row)"
      :caption="rowCaption(line.row, account)"
      :quiet="skipped"
      flush
      data-testid="spending-dry-run-row"
    >
      <template #details>
        <UBadge :label="outcome.label" :color="outcome.color" variant="subtle" size="sm" class="mt-1 self-start" data-testid="spending-dry-run-outcome" />
        <template v-if="paid !== null">
          <NoteLine as="span" icon="i-lucide-link" data-testid="spending-dry-run-link">{{ paid.text }}</NoteLine>
          <RowLines v-if="paid.parts.length > 0" :lines="paid.parts" :categories="categories" :currency="currency" />
        </template>
      </template>
      <template #amount>
        <AccountMoneyText :cents="line.row.amount" :currency="currency" v-bind="skipped ? { sign: 'always' } : { tone }" :class="{ 'text-muted': skipped }" />
      </template>
    </ListRow>
  </ul>
  <ShowAllButton v-if="lines.length > FIRST_SHOWN" v-model:expanded="allShown" :total="lines.length" class="self-start" />
</template>
