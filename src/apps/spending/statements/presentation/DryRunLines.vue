<script setup lang="ts">
import { computed, ref } from 'vue'
import UBadge from '@nuxt/ui/components/Badge.vue'

import { wantsSavingsAccount } from '../../pairing/domain/wantsSavingsAccount'
import type { DryRunLine } from '../domain/statementDryRun'
import { isBankSyncKey } from '../domain/statementRows'
import { words } from './words'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { intlLocale } from '../../../../shared/text/language'
import MoneyText from '../../../../shared/ui/MoneyText.vue'
import ShowAllButton, { FIRST_SHOWN } from '../../../../shared/ui/ShowAllButton.vue'

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
    const outcome =
      line.outcome === 'already-in'
        ? { label: words.import.outcome.alreadyIn, color: 'neutral' as const }
        : line.outcome === 'other-source'
          ? { label: isBankSyncKey(line.row.importKey) ? words.import.outcome.broughtByFile : words.import.outcome.broughtBySync, color: 'neutral' as const }
          : line.outcome === 'filled'
            ? { label: words.import.outcome.filled, color: 'info' as const }
            : line.outcome === 'before-opening'
              ? { label: words.import.outcome.beforeOpening, color: 'neutral' as const }
              : line.outcome === 'refiled'
                ? { label: words.import.outcome.refiled(named), color: 'info' as const }
                : line.outcome === 'new' && wantsSavingsAccount(line.row, state.workbook?.accounts ?? [])
                  ? { label: words.review.wantsSavings, color: 'warning' as const }
                  : { label: named, color: line.category === null ? ('warning' as const) : ('success' as const) }
    return { line, outcome, account: accounts.get(line.row.account) ?? null, faded: line.outcome === 'already-in' || line.outcome === 'other-source' || line.outcome === 'before-opening' }
  })
})
</script>

<template>
  <ul class="divide-y divide-default rounded-control border border-default" data-testid="spending-dry-run-rows">
    <li v-for="({ line, outcome, account, faded }, place) in shown" :key="place" class="flex items-start gap-3 px-3 py-2.5" :class="{ 'opacity-60': faded }" data-testid="spending-dry-run-row">
      <span class="flex min-w-0 flex-1 flex-col gap-1">
        <span class="break-words text-sm text-highlighted">{{ line.row.payee }}</span>
        <span class="break-words type-caption">{{ [dayLabel(line.row.date), account?.name ?? ''].filter((part) => part !== '').join(' · ') }}</span>
        <UBadge :label="outcome.label" :color="outcome.color" variant="subtle" size="sm" class="self-start" data-testid="spending-dry-run-outcome" />
      </span>
      <MoneyText :cents="line.row.amount" sign="always" tone="flow" class="shrink-0 text-sm" :format="{ currency: account?.currency ?? 'EUR', locale: intlLocale }" />
    </li>
  </ul>
  <ShowAllButton v-if="lines.length > FIRST_SHOWN" v-model:expanded="allShown" :total="lines.length" class="self-start" />
</template>
