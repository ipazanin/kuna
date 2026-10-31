<script setup lang="ts">
import { computed } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UBadge from '@nuxt/ui/components/Badge.vue'
import UCheckbox from '@nuxt/ui/components/Checkbox.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'

import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import AppCard from '../../../../shared/ui/AppCard.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'
import { useDisplayNames } from '../../workbook/application/useDisplayNames'
import { reviewReasonLabel } from '../domain/camtStatement'
import type { DryRunStatement } from '../domain/importDryRun'
import { words } from './words'

const props = defineProps<{
  statement: DryRunStatement
  /** The card's id, under which this device keeps it collapsed or expanded. */
  collapseId: string
  /** Whether the person agreed to start the account at the statement's opening. */
  started: boolean
  /** The opening typed for an account a file without balances starts. */
  typedOpening: string
  /** The name a new account the statement's IBAN names takes. */
  accountName?: string | undefined
  /** Why that name cannot be used, or undefined. */
  accountNameProblem?: string | undefined
}>()

const emit = defineEmits<{
  'update:started': [started: boolean]
  'update:typedOpening': [text: string]
  'update:accountName': [name: string]
}>()

const names = useDisplayNames()

const counts = computed(() => {
  const added = props.statement.rows.filter((row) => !row.inLedger && row.verdict !== null).length
  const held = props.statement.rows.filter((row) => row.inLedger).length
  return { added, held }
})

const summary = computed(() => {
  const { added, held } = counts.value
  if (props.statement.refusal !== null) return words.statement.refused
  if (props.statement.newAccount !== null && added === 0) return words.statement.waitsForName
  if (props.statement.start !== null && added === 0) return words.statement.waitsForStart
  const parts = [added > 0 ? words.statement.added(added) : '', held > 0 ? words.statement.held(held) : ''].filter((part) => part !== '')
  return parts.join(', ') || words.statement.noEntries
})

const subtitle = computed(() => {
  const { account, fileName, opening, closing } = props.statement
  const where = account === '' ? fileName : props.statement.newAccount !== null ? account : names.value.account(account)
  return opening === null || closing === null ? where : words.statement.range(where, formatMoney(opening), formatMoney(closing))
})

/** An IBAN in groups of four, as a bank prints it. */
function grouped(iban: string): string {
  return iban.replace(/(.{4})(?=.)/g, '$1 ')
}
</script>

<template>
  <AppCard :title="statement.label" :subtitle="subtitle" :collapse-id="collapseId" :summary="summary" data-testid="dry-run-statement">
    <div class="flex flex-col gap-3 px-4 pt-3 pb-4 sm:px-5">
      <UAlert v-if="statement.refusal" icon="i-lucide-file-x" color="error" variant="subtle" :title="statement.refusal" data-testid="dry-run-refusal" />

      <div v-if="statement.newAccount" class="flex flex-col gap-3 rounded-control border border-default bg-elevated/40 px-3 py-3" data-testid="dry-run-new-account">
        <p class="text-sm text-toned">
          <span class="identifier">{{ grouped(statement.newAccount.iban) }}</span> ({{ statement.newAccount.currency }})
          {{ words.statement.isNew(statement.newAccount.opening === null ? null : formatMoney(statement.newAccount.opening), statement.newAccount.date ? dayLabel(statement.newAccount.date) : null) }}
        </p>
        <UFormField :label="words.statement.accountName" :error="accountNameProblem ?? false" :help="words.statement.accountNameHelp">
          <UInput :model-value="accountName ?? ''" class="identifier w-48" data-testid="dry-run-account-name" @update:model-value="emit('update:accountName', String($event))" />
        </UFormField>
      </div>

      <div v-else-if="statement.start" class="flex flex-col gap-2 rounded-control border border-default bg-elevated/40 px-3 py-3" data-testid="dry-run-start">
        <p class="text-sm text-toned">{{ words.statement.noRowsYet(names.account(statement.start.account)) }}</p>
        <UCheckbox
          v-if="statement.start.opening !== null"
          :model-value="started"
          :label="words.statement.startAt(names.account(statement.start.account), formatMoney(statement.start.opening), dayLabel(statement.start.date))"
          data-testid="dry-run-start-confirm"
          @update:model-value="emit('update:started', $event === true)"
        />
        <UFormField v-else :label="words.statement.balanceBefore(names.account(statement.start.account), dayLabel(statement.start.date))" :help="words.statement.noBalances">
          <UInput
            :model-value="typedOpening"
            inputmode="decimal"
            :placeholder="words.statement.amountPlaceholder"
            class="w-40"
            data-testid="dry-run-start-opening"
            @update:model-value="emit('update:typedOpening', String($event))"
          />
        </UFormField>
      </div>

      <ul v-if="statement.notes.length" class="flex flex-col gap-1 text-sm text-muted" data-testid="dry-run-notes">
        <li v-for="note in statement.notes" :key="note">{{ note }}</li>
      </ul>

      <ul v-if="statement.rows.length" class="@container divide-y divide-default rounded-control border border-default" data-testid="dry-run-rows">
        <li v-for="(row, index) in statement.rows" :key="`${row.reference}-${index}`" class="row" :class="{ 'opacity-60': row.inLedger }" data-testid="dry-run-row">
          <span class="figure text-xs text-muted">{{ dayLabel(row.date) }}</span>
          <span class="min-w-0">
            <span class="block break-words text-sm text-highlighted">{{ row.counterparty || row.description || words.statement.noCounterparty }}</span>
            <span v-if="row.counterparty && row.description" class="block break-words text-xs text-muted">{{ row.description }}</span>
            <span class="mt-1 flex flex-wrap gap-1">
              <UBadge v-if="row.inLedger" :label="words.statement.onLedger" color="neutral" variant="subtle" size="sm" />
              <UBadge v-else-if="row.verdict" :label="names.category(row.verdict.category)" :color="row.verdict.flaggedBy === 'rule' ? 'success' : 'warning'" variant="subtle" size="sm" />
              <UBadge v-if="row.verdict?.flaggedBy === 'ai'" :label="words.statement.waitsForReview" color="warning" variant="outline" size="sm" />
              <UBadge v-for="reason in row.reviewReasons" :key="reason" :label="reviewReasonLabel(reason)" color="warning" variant="outline" size="sm" />
            </span>
          </span>
          <span class="text-end">
            <MoneyText :cents="row.amount" tone="flow" class="block text-sm" />
            <MoneyText v-if="row.balance !== null" :cents="row.balance" class="block text-xs text-muted" />
          </span>
        </li>
      </ul>
    </div>
  </AppCard>
</template>

<style scoped>
.row {
  display: grid;
  grid-template-columns: 5.5rem minmax(0, 1fr) auto;
  align-items: start;
  gap: 0.25rem 0.75rem;
  padding: 0.625rem 0.75rem;
}

@container (max-width: 26rem) {
  .row {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .row > :first-child {
    grid-column: 1 / -1;
  }
}
</style>
