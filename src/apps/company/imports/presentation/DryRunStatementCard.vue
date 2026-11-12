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
import type { Money } from '../../../../shared/money/money'
import MoneyText from '../../../../shared/ui/MoneyText.vue'
import ProposalRow from '../../../../shared/ui/ProposalRow.vue'
import { useDisplayNames } from '../../workbook/application/useDisplayNames'
import { reviewReasonLabel } from '../domain/camtStatement'
import type { CopiedTwinQuestion, DryRunStatement } from '../domain/importDryRun'
import type { Transaction } from '../../workbook/domain/workbook'
import QuestionList from '../../../../shared/ui/QuestionList.vue'
import type { QuestionItem } from '../../../../shared/ui/QuestionList.vue'
import { likeCaption } from '../../../../shared/ai/presentation/copiedRowsWords'
import { TWIN_CHOICES, twinWords } from '../../../../shared/ai/presentation/copiedRowsWords'
import type { TwinChoice } from '../../../../shared/ai/presentation/copiedRowsWords'
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
  answer: [question: CopiedTwinQuestion, choice: TwinChoice]
}>()

const names = useDisplayNames()

/** A row as a person tells it from others: its counterparty, amount and day. */
function rowParts(row: Pick<Transaction, 'counterparty' | 'description' | 'amount' | 'date'>): string[] {
  return [row.counterparty || row.description, formatMoney(row.amount), dayLabel(row.date)].filter((part) => part !== '')
}

/** A copied row's question, named as the rows under it are, its own amount in the column beside its words and the row it looks like in a sentence under them. */
const twinItems = computed(() =>
  props.statement.questions.map((question): QuestionItem<TwinChoice> & { readonly amount: Money } => ({
    key: question.key,
    row: question.row.counterparty || question.row.description || words.statement.noCounterparty,
    caption: dayLabel(question.row.date),
    note: likeCaption('copied', rowParts(question.copied)),
    choice: question.keep ?? 'later',
    amount: question.row.amount,
  })),
)

/** The references of the entries that still wait for the person's word. */
const waitingRefs = computed(() => new Set(props.statement.questions.flatMap((question) => (question.keep === null ? [question.row.reference] : []))))

function answerTwin(key: string, choice: TwinChoice): void {
  const question = props.statement.questions.find((asked) => asked.key === key)
  if (question !== undefined) emit('answer', question, choice)
}

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

      <ul v-if="statement.notes.length + statement.facts.length" class="flex flex-col gap-1 text-sm text-muted" data-testid="dry-run-notes">
        <li v-for="note in [...statement.notes, ...statement.facts]" :key="note">{{ note }}</li>
      </ul>

      <QuestionList v-if="twinItems.length > 0" :items="twinItems" :options="TWIN_CHOICES.file" :label="twinWords.choice" :heading="twinWords.title" :intro="twinWords.intro.file" @answer="answerTwin">
        <template #amount="{ item }">
          <MoneyText :cents="item.amount" sign="always" tone="flow" />
        </template>
      </QuestionList>

      <ul v-if="statement.rows.length" class="flex flex-col divide-y divide-default" :class="{ 'border-t border-default': twinItems.length > 0 }" data-testid="dry-run-rows">
        <ProposalRow
          v-for="(row, index) in statement.rows"
          :key="`${row.reference}-${index}`"
          :title="row.counterparty || row.description || words.statement.noCounterparty"
          :caption="dayLabel(row.date)"
          :quiet="row.inLedger"
          flush
          data-testid="dry-run-row"
        >
          <template #details>
            <span v-if="row.counterparty && row.description" class="break-words type-caption">{{ row.description }}</span>
            <span class="mt-1 flex flex-wrap gap-1">
              <UBadge v-if="row.inLedger && waitingRefs.has(row.reference)" :label="words.statement.waitsForAnswer" color="info" variant="subtle" size="sm" />
              <UBadge v-else-if="row.inLedger" :label="words.statement.onLedger" color="neutral" variant="subtle" size="sm" />
              <UBadge v-else-if="row.verdict" :label="names.category(row.verdict.category)" :color="row.verdict.flaggedBy === 'rule' ? 'success' : 'warning'" variant="subtle" size="sm" />
              <UBadge v-if="row.replaces" :label="words.statement.replacesCopied" color="info" variant="subtle" size="sm" />
              <UBadge v-if="row.verdict?.flaggedBy === 'ai'" :label="words.statement.waitsForReview" color="warning" variant="outline" size="sm" />
              <UBadge v-for="reason in row.reviewReasons" :key="reason" :label="reviewReasonLabel(reason)" color="warning" variant="outline" size="sm" />
            </span>
          </template>
          <template #amount>
            <MoneyText :cents="row.amount" sign="always" :tone="row.inLedger ? undefined : 'flow'" :class="{ 'text-muted': row.inLedger }" />
            <MoneyText v-if="row.balance !== null" :cents="row.balance" class="type-caption" />
          </template>
        </ProposalRow>
      </ul>
    </div>
  </AppCard>
</template>
