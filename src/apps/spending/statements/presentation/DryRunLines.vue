<script setup lang="ts">
import { computed, ref } from 'vue'
import UBadge from '@nuxt/ui/components/Badge.vue'

import { wantsSavingsAccount } from '../../pairing/domain/wantsSavingsAccount'
import type { DryRunLine } from '../domain/statementDryRun'
import { isBankSyncKey } from '../domain/statementRows'
import { rowCaption, rowTitle } from './rowParts'
import { words } from './words'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import type { Transaction } from '../../workbook/domain/transaction'
import AccountMoneyText from '../../accounts/presentation/AccountMoneyText.vue'
import ProposalRow from '../../../../shared/ui/ProposalRow.vue'
import ShowAllButton, { FIRST_SHOWN } from '../../../../shared/ui/ShowAllButton.vue'
import { EURO } from '../../../../shared/money/currencyCode'
import { formatAccountMoney } from '../../../../shared/money/moneyFormat'

/** Each row of a statement and what importing it would do. */
const props = defineProps<{
  lines: readonly DryRunLine[]
  /** Whether questions about rows sit above the list, which a line then parts it from. */
  belowQuestions: boolean
}>()

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
      account: accounts.get(line.row.account),
      skipped: line.outcome === 'already-in' || line.outcome === 'other-source' || line.outcome === 'outside-days' || line.outcome === 'before-opening' || line.outcome === 'look-alike',
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
    case 'outside-days':
      return { label: words.import.outcome.outsideDays, color: 'neutral' }
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
  <ul class="flex flex-col divide-y divide-default" :class="{ 'border-t border-default': belowQuestions }" data-testid="spending-dry-run-rows">
    <ProposalRow
      v-for="({ line, outcome, account, skipped }, place) in shown"
      :key="place"
      :title="rowTitle(line.row)"
      :caption="rowCaption(line.row, account)"
      :quiet="skipped"
      flush
      data-testid="spending-dry-run-row"
    >
      <template #details>
        <UBadge :label="outcome.label" :color="outcome.color" variant="subtle" size="sm" class="mt-1 self-start" data-testid="spending-dry-run-outcome" />
      </template>
      <template #amount>
        <AccountMoneyText :cents="line.row.amount" :currency="account?.currency ?? EURO" sign="always" :tone="skipped ? undefined : 'flow'" :class="{ 'text-muted': skipped }" />
      </template>
    </ProposalRow>
  </ul>
  <ShowAllButton v-if="lines.length > FIRST_SHOWN" v-model:expanded="allShown" :total="lines.length" class="self-start" />
</template>
