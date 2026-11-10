<script setup lang="ts">
import { computed, ref } from 'vue'
import UBadge from '@nuxt/ui/components/Badge.vue'

import { wantsSavingsAccount } from '../../pairing/domain/wantsSavingsAccount'
import type { DryRunLine } from '../domain/statementDryRun'
import { isBankSyncKey } from '../domain/statementRows'
import { words } from './words'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import type { Transaction } from '../../workbook/domain/transaction'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import AccountMoneyText from '../../accounts/presentation/AccountMoneyText.vue'
import ShowAllButton, { FIRST_SHOWN } from '../../../../shared/ui/ShowAllButton.vue'
import { EURO } from '../../../../shared/money/currencyCode'
import { formatAccountMoney } from '../../../../shared/money/moneyFormat'

/** Each row of a statement and what importing it would do. */
const props = defineProps<{ lines: readonly DryRunLine[] }>()

const { state } = useSpendingBooks()

/** A first import has thousands of rows, which a phone cannot lay out at once. */
const allShown = ref(false)

const shown = computed(() => {
  const categories = new Map((state.workbook?.categories ?? []).map((category) => [category.id, category.name]))
  const accounts = new Map((state.workbook?.accounts ?? []).map((account) => [account.id, account]))
  return (allShown.value ? props.lines : props.lines.slice(0, FIRST_SHOWN)).map((line) => {
    const named = line.category === null ? words.import.outcome.waits : (categories.get(line.category) ?? words.import.outcome.waits)
    const outcome = outcomeOf(line, named)
    return {
      line,
      outcome,
      account: accounts.get(line.row.account) ?? null,
      skipped: line.outcome === 'already-in' || line.outcome === 'other-source' || line.outcome === 'before-opening' || line.outcome === 'look-alike',
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
      return { label: isBankSyncKey(line.row.importKey) ? words.import.outcome.lookAlikeSynced : words.import.outcome.lookAlike, color: 'info' }
    case 'filled':
      return { label: words.import.outcome.filled, color: 'info' }
    case 'replaced':
      return { label: isBankSyncKey(line.like.importKey) ? words.import.outcome.replacedSynced : words.import.outcome.replaced, color: 'info' }
    case 'before-opening':
      return { label: words.import.outcome.beforeOpening, color: 'neutral' }
    case 'refiled':
      return { label: words.import.outcome.refiled(named), color: 'info' }
    case 'new':
      if (line.withdrawal !== null) return cashOutcomeOf(line.withdrawal.cashLeg)
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
  <ul class="divide-y divide-default rounded-control border border-default" data-testid="spending-dry-run-rows">
    <li v-for="({ line, outcome, account, skipped }, place) in shown" :key="place" class="flex flex-col gap-1 px-3 py-2.5" data-testid="spending-dry-run-row">
      <span class="flex items-start gap-3">
        <span class="flex min-w-0 flex-1 flex-col gap-1">
          <span class="break-words text-sm" :class="skipped ? 'text-muted' : 'text-highlighted'">{{ line.row.payee }}</span>
          <span class="break-words type-caption">{{ [dayLabel(line.row.date), account?.name ?? ''].filter((part) => part !== '').join(' · ') }}</span>
          <UBadge :label="outcome.label" :color="outcome.color" variant="subtle" size="sm" class="self-start" data-testid="spending-dry-run-outcome" />
        </span>
        <AccountMoneyText
          :cents="line.row.amount"
          :currency="account?.currency ?? EURO"
          sign="always"
          :tone="skipped ? undefined : 'flow'"
          class="shrink-0 text-sm"
          :class="{ 'text-muted': skipped }"
        />
      </span>
    </li>
  </ul>
  <ShowAllButton v-if="lines.length > FIRST_SHOWN" v-model:expanded="allShown" :total="lines.length" class="self-start" />
</template>
