<script setup lang="ts">
import { computed } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UBadge from '@nuxt/ui/components/Badge.vue'
import UEmpty from '@nuxt/ui/components/Empty.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import MoneyText from '../../../shared/ui/MoneyText.vue'
import PageHeader from '../../../shared/ui/PageHeader.vue'
import FilterBar from '../../filters/presentation/FilterBar.vue'
import { useFilteredLedger } from '../../transactions/application/useFilteredLedger'
import { UNCLASSIFIED } from '../../workbook/domain/bucket'
import { needsReview } from '../../workbook/domain/needsReview'
import { sheetRowLink } from '../../workbook/infrastructure/sheetRowLink'
import LedgerGate from '../../workbook/presentation/LedgerGate.vue'

const ledger = useFilteredLedger()

const dayFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

/** The queue has no period: a row waits until someone settles it, however old it is. */
const queue = computed(() => {
  const current = ledger.value
  if (current === null) {
    return []
  }
  const { workbook } = current
  return current.scoped.filter(needsReview).map((transaction) => ({
    key: transaction.sheetRow,
    date: dayFormat.format(new Date(transaction.date)),
    account: transaction.account,
    counterparty: transaction.counterparty || 'No counterparty',
    description: transaction.description,
    amount: transaction.amount,
    category: transaction.category,
    reason: transaction.bucket === UNCLASSIFIED ? 'Unclassified' : 'AI guess',
    sheetRow: transaction.sheetRow,
    link: sheetRowLink(workbook.spreadsheetId, workbook.ledgerSheetId, transaction.sheetRow),
  }))
})
</script>

<template>
  <section class="flex flex-col gap-6">
    <PageHeader title="Review" description="Rows that wait for a human: categories the AI guessed, and rows no defined category covers." />
    <LedgerGate>
      <template v-if="ledger">
        <FilterBar :workbook="ledger.workbook" :window="ledger.window" :show-period="false" />

        <UAlert
          icon="i-lucide-pencil-off"
          color="neutral"
          variant="subtle"
          title="Read only for now"
          description="Confirming or changing a category from here comes later. Until then, open the row in the Sheet, fix it there, and sync."
        />

        <UEmpty
          v-if="queue.length === 0"
          icon="i-lucide-check-check"
          title="Nothing waits for review"
          description="Every row in view has a category a rule or a person set."
          variant="outline"
          class="rounded-card bg-raised"
        />
        <section v-else class="min-w-0 rounded-card border border-default bg-raised shadow-raised">
          <header class="px-4 pt-4 sm:px-5">
            <h2 class="text-sm font-medium text-highlighted">{{ queue.length }} {{ queue.length === 1 ? 'row' : 'rows' }} to review</h2>
            <p class="mt-0.5 text-xs text-muted">Newest first, from every month of the ledger.</p>
          </header>
          <div class="relative overflow-x-auto px-1 pt-2 pb-2 sm:px-2">
            <table class="data-table w-full text-sm">
              <thead>
                <tr>
                  <th scope="col" class="text-start">Date</th>
                  <th scope="col" class="text-start">Counterparty</th>
                  <th scope="col" class="text-start">Category now</th>
                  <th scope="col" class="text-start">Why</th>
                  <th scope="col" class="text-end">Amount</th>
                  <th scope="col" class="text-end">In the Sheet</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in queue" :key="row.key">
                  <td class="figure text-muted">{{ row.date }}</td>
                  <th scope="row" class="text-start font-normal">
                    <span class="block text-highlighted">{{ row.counterparty }}</span>
                    <span v-if="row.description" class="block max-w-72 truncate text-xs text-muted">{{ row.description }}</span>
                  </th>
                  <td class="text-toned">
                    <span v-if="row.category">{{ row.category }}</span>
                    <span v-else class="text-dimmed">none</span>
                  </td>
                  <td>
                    <UBadge :label="row.reason" :color="row.reason === 'Unclassified' ? 'warning' : 'info'" variant="subtle" size="sm" />
                  </td>
                  <td class="text-end"><MoneyText :cents="row.amount" toned /></td>
                  <td class="text-end">
                    <a
                      v-if="row.link"
                      :href="row.link"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="sheet-link inline-flex items-center gap-1 text-toned"
                    >
                      Row {{ row.sheetRow }}
                      <UIcon name="i-lucide-external-link" class="size-3.5" aria-hidden="true" />
                      <span class="sr-only">(opens the Google Sheet in a new tab)</span>
                    </a>
                    <span v-else class="text-xs text-dimmed" title="Sync once so the app learns which tab is the ledger.">Row {{ row.sheetRow }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </template>
    </LedgerGate>
  </section>
</template>

<style scoped>
.sheet-link {
  border-radius: 3px;
  text-decoration-line: underline;
  text-decoration-color: transparent;
  text-underline-offset: 3px;
  transition: text-decoration-color 120ms ease;
}

.sheet-link:hover {
  color: var(--ink-strong);
  text-decoration-color: var(--accent);
}
</style>
