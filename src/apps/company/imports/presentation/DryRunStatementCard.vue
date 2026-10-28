<script setup lang="ts">
import { computed } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UBadge from '@nuxt/ui/components/Badge.vue'
import UCheckbox from '@nuxt/ui/components/Checkbox.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'

import { formatMoney } from '../../../../shared/money/moneyFormat'
import AppCard from '../../../../shared/ui/AppCard.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'
import { useDisplayNames } from '../../workbook/application/useDisplayNames'
import type { DryRunStatement } from '../domain/importDryRun'

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
const dayFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

const counts = computed(() => {
  const added = props.statement.rows.filter((row) => !row.inLedger && row.verdict !== null).length
  const held = props.statement.rows.filter((row) => row.inLedger).length
  return { added, held }
})

const summary = computed(() => {
  const { added, held } = counts.value
  if (props.statement.refusal !== null) return 'Refused, nothing of it is written'
  if (props.statement.newAccount !== null && added === 0) return 'Waits for you to name the account'
  if (props.statement.start !== null && added === 0) return 'Waits for you to start the account'
  const parts = [added > 0 ? `${added} new` : '', held > 0 ? `${held} on the ledger already` : ''].filter((part) => part !== '')
  return parts.join(', ') || 'No entries'
})

const subtitle = computed(() => {
  const { account, fileName, opening, closing } = props.statement
  const where = account === '' ? fileName : props.statement.newAccount !== null ? account : names.value.account(account)
  return opening === null || closing === null ? where : `${where}, ${formatMoney(opening)} to ${formatMoney(closing)}`
})

function day(date: string): string {
  return dayFormat.format(new Date(date))
}

/** An IBAN in groups of four, as a bank prints it. */
function grouped(iban: string): string {
  return iban.replace(/(.{4})(?=.)/g, '$1 ')
}
</script>

<template>
  <AppCard
    :title="statement.label"
    :subtitle="subtitle"
    :collapse-id="collapseId"
    :summary="summary"
    data-testid="dry-run-statement"
  >
    <div class="flex flex-col gap-3 px-4 pt-3 pb-4 sm:px-5">
      <UAlert v-if="statement.refusal" icon="i-lucide-file-x" color="error" variant="subtle" :title="statement.refusal" data-testid="dry-run-refusal" />

      <div v-if="statement.newAccount" class="flex flex-col gap-3 rounded-control border border-default bg-elevated/40 px-3 py-3" data-testid="dry-run-new-account">
        <p class="text-sm text-toned">
          <span class="identifier">{{ grouped(statement.newAccount.iban) }}</span> ({{ statement.newAccount.currency }}) is new. Add it as an account<template v-if="statement.newAccount.opening !== null">
            from {{ formatMoney(statement.newAccount.opening) }}</template><template v-if="statement.newAccount.date"> on {{ day(statement.newAccount.date) }}</template>?
        </p>
        <UFormField label="Account name" :error="accountNameProblem ?? false" help="Lower-case letters, digits and single hyphens. The screens show it until you give the account a label.">
          <UInput :model-value="accountName ?? ''" class="identifier w-48" data-testid="dry-run-account-name" @update:model-value="emit('update:accountName', String($event))" />
        </UFormField>
      </div>

      <div v-else-if="statement.start" class="flex flex-col gap-2 rounded-control border border-default bg-elevated/40 px-3 py-3" data-testid="dry-run-start">
        <p class="text-sm text-toned">
          The ledger has no rows of {{ names.account(statement.start.account) }} yet, so nothing earlier can show this statement follows on.
        </p>
        <UCheckbox
          v-if="statement.start.opening !== null"
          :model-value="started"
          :label="`Start ${names.account(statement.start.account)} at ${formatMoney(statement.start.opening)} on ${day(statement.start.date)}`"
          data-testid="dry-run-start-confirm"
          @update:model-value="emit('update:started', $event === true)"
        />
        <UFormField v-else :label="`Balance of ${names.account(statement.start.account)} before ${day(statement.start.date)}`" help="The file gives no balances, so they are worked out from this one.">
          <UInput :model-value="typedOpening" inputmode="decimal" placeholder="0.00" class="w-40" data-testid="dry-run-start-opening" @update:model-value="emit('update:typedOpening', String($event))" />
        </UFormField>
      </div>

      <ul v-if="statement.notes.length" class="flex flex-col gap-1 text-sm text-muted" data-testid="dry-run-notes">
        <li v-for="note in statement.notes" :key="note">{{ note }}</li>
      </ul>

      <ul v-if="statement.rows.length" class="@container divide-y divide-default rounded-control border border-default" data-testid="dry-run-rows">
        <li v-for="(row, index) in statement.rows" :key="`${row.reference}-${index}`" class="row" :class="{ 'opacity-60': row.inLedger }" data-testid="dry-run-row">
          <span class="figure text-xs text-muted">{{ day(row.date) }}</span>
          <span class="min-w-0">
            <span class="block break-words text-sm text-highlighted">{{ row.counterparty || row.description || 'No counterparty' }}</span>
            <span v-if="row.counterparty && row.description" class="block break-words text-xs text-muted">{{ row.description }}</span>
            <span class="mt-1 flex flex-wrap gap-1">
              <UBadge v-if="row.inLedger" label="On the ledger" color="neutral" variant="subtle" size="sm" />
              <UBadge v-else-if="row.verdict" :label="names.category(row.verdict.category)" :color="row.verdict.flaggedBy === 'rule' ? 'success' : 'warning'" variant="subtle" size="sm" />
              <UBadge v-if="row.verdict?.flaggedBy === 'ai'" label="Waits for review" color="warning" variant="outline" size="sm" />
              <UBadge v-for="reason in row.reviewReasons" :key="reason" :label="reason" color="warning" variant="outline" size="sm" />
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
