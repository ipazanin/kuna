<script setup lang="ts">
import { computed, ref } from 'vue'
import UBadge from '@nuxt/ui/components/Badge.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'
import UButton from '@nuxt/ui/components/Button.vue'

import AskChatButton from '../../../../shared/ai/presentation/AskChatButton.vue'
import { useChatElement } from '../../../../shared/ai/presentation/chatDock'
import { assistKeyKept } from '../../../../shared/ai/presentation/aiProvider'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { capitalised } from '../../../../shared/text/capitalised'
import FactGrid from '../../../../shared/ui/FactGrid.vue'
import type { Fact } from '../../../../shared/ui/FactGrid.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'
import ProposalRow from '../../../../shared/ui/ProposalRow.vue'
import { reviewReasonLabel } from '../../imports/domain/camtStatement'
import type { Verdict } from '../../../../shared/categorising/domain/categorise'
import CategoryChip from './CategoryChip.vue'
import CategoryPicker from './CategoryPicker.vue'
import { useDisplayNames } from '../../workbook/application/useDisplayNames'
import { UNCLASSIFIED } from '../../workbook/domain/bucket'
import type { Bucket } from '../../workbook/domain/bucket'
import { LEDGER_RECORDS } from '../../workbook/domain/coreKinds'
import type { Category, Transaction } from '../../workbook/domain/workbook'
import { COMPANY_APP } from '../../workbook/domain/companyApp'
import type { TransactionSignals } from '../../../../shared/categorising/domain/transactionFacts'
import type { WriteSaving } from '../../../../shared/storage/presentation/useRecordWrites'
import { words } from './words'

/** One row waiting for review: what it is, what the rules say about it now, and what a person can do. */
const props = defineProps<{
  transaction: Transaction
  /** What the rules on the tab would file it as today. */
  verdict: Verdict
  categories: readonly Category[]
  expanded: boolean
  /** True when the splits tab already splits the row, so Split edits its parts. */
  split: boolean
  saving: WriteSaving
  /** True when the owner flagged the row's counterparty as a person. */
  personCounterparty: boolean
}>()

const emit = defineEmits<{
  toggle: []
  confirm: []
  recategorise: [category: string]
  makeRule: []
  split: []
  treatCounterparty: []
}>()

const names = useDisplayNames()
const rowSaving = computed(() => props.saving(`confirm-${props.transaction.id}`) || props.saving(`recategorise-${props.transaction.id}`))

const SIGNAL_LABELS: Readonly<Record<keyof TransactionSignals, string>> = words.review.item.signals

/** What the row's details show: what the rules say, then its IBAN and signals as the bank wrote them, then what the statement asks. */
const facts = computed((): (Fact & { readonly look: 'verdict' | 'identifier' | 'words' })[] => [
  { label: words.review.item.rulesSay, value: '', look: 'verdict' },
  ...(props.transaction.counterpartyIban ? [{ label: words.review.item.counterpartyIban, value: props.transaction.counterpartyIban, look: 'identifier' as const }] : []),
  ...(Object.keys(SIGNAL_LABELS) as (keyof TransactionSignals)[])
    .filter((field) => props.transaction.signals[field] !== '')
    .map((field) => ({ label: SIGNAL_LABELS[field], value: props.transaction.signals[field], look: 'identifier' as const })),
  ...(props.transaction.reviewReasons.length > 0 ? [{ label: words.review.item.statementAsks, value: props.transaction.reviewReasons.map(reviewReasonLabel).join(', '), look: 'words' as const }] : []),
])

const reasons = computed(() => [
  ...(props.transaction.bucket === UNCLASSIFIED ? [{ label: words.unclassified, color: 'warning' as const }] : []),
  ...(props.transaction.flaggedBy === 'ai' ? [{ label: words.noRule, color: 'info' as const }] : []),
  ...props.transaction.reviewReasons.map((reason) => ({ label: capitalised(reviewReasonLabel(reason)), color: 'warning' as const })),
])

const bucketBySlug = computed(() => new Map(props.categories.map((category) => [category.slug, category.bucket])))

function bucketOf(category: string): Bucket {
  return bucketBySlug.value.get(category) ?? UNCLASSIFIED
}

const confirmable = computed(() => props.transaction.bucket !== UNCLASSIFIED)

const picked = ref<string | undefined>(undefined)

/** The row by its day and account, as its summary line reads, never by its counterparty or amount, so the chat tag names no payee. */
const rowName = computed(() => `${dayLabel(props.transaction.date)}, ${names.value.account(props.transaction.account)}`)
const { ask, marked } = useChatElement(
  () => ({
    key: `company-review-row-${props.transaction.id}`,
    label: rowName.value,
    about: { kind: 'record', app: COMPANY_APP, recordKind: LEDGER_RECORDS.name, id: props.transaction.id },
  }),
  'row',
)

function recategorise(category: string | undefined): void {
  if (category !== undefined && category !== '') {
    emit('recategorise', category)
  }
  picked.value = undefined
}
</script>

<template>
  <li v-bind="marked" data-testid="review-row">
    <ProposalRow
      as="button"
      :title="transaction.counterparty || words.noCounterparty"
      :class="{ 'bg-elevated': expanded }"
      class="focus-visible:-outline-offset-2"
      :aria-expanded="expanded"
      @click="emit('toggle')"
    >
      <template #details>
        <span class="mt-1 flex flex-wrap items-center gap-1.5">
          <UIcon v-if="rowSaving" name="i-lucide-loader-circle" class="size-3.5 shrink-0 animate-spin text-muted" data-testid="review-row-saving" />
          <CategoryChip :category="transaction.category" :bucket="transaction.bucket" />
          <UBadge v-for="reason in reasons" :key="reason.label" :label="reason.label" :color="reason.color" variant="subtle" size="sm" />
        </span>
      </template>
      <template #amount>
        <MoneyText :cents="transaction.amount" tone="flow" />
        <span class="figure type-caption">{{ rowName }}</span>
      </template>
    </ProposalRow>

    <div v-if="expanded" class="flex flex-col gap-3 bg-elevated px-4 pb-4 sm:px-5" data-testid="review-details">
      <p v-if="transaction.description" class="text-sm text-toned">{{ transaction.description }}</p>

      <FactGrid :facts="facts">
        <template #value="{ fact }">
          <span v-if="fact.look === 'verdict'" class="flex flex-wrap items-center gap-1.5">
            <CategoryChip :category="verdict.category" :bucket="bucketOf(verdict.category)" />
            <span v-if="verdict.ruleId" class="text-xs text-muted">
              {{ words.review.item.by }} <span class="identifier">{{ verdict.ruleId }}</span
              >{{ verdict.flaggedBy === 'ai' ? words.review.item.sendsToReview : '' }}
            </span>
            <span v-else class="text-xs text-muted">{{ words.review.item.noRuleDecides }}</span>
          </span>
          <span v-else class="text-sm text-default" :class="{ 'identifier break-all': fact.look === 'identifier' }">{{ fact.value }}</span>
        </template>
      </FactGrid>

      <p v-if="!confirmable" class="text-xs text-muted">{{ words.review.item.notConfirmable }}</p>
      <div class="flex flex-wrap items-center gap-2 pt-1">
        <UButton
          v-if="confirmable"
          :label="words.review.item.confirm(names.category(transaction.category))"
          icon="i-lucide-check"
          size="sm"
          :loading="saving(`confirm-${transaction.id}`)"
          :disabled="rowSaving"
          data-testid="confirm-row"
          @click="emit('confirm')"
        />
        <CategoryPicker
          v-model="picked"
          :categories="categories"
          :placeholder="words.review.item.recategorise"
          :loading="saving(`recategorise-${transaction.id}`)"
          :disabled="rowSaving"
          size="sm"
          data-testid="recategorise-row"
          @update:model-value="recategorise"
        />
        <UButton v-if="confirmable" :label="words.review.item.makeThisARule" icon="i-lucide-list-plus" color="neutral" variant="outline" size="sm" data-testid="make-rule" @click="emit('makeRule')" />
        <UButton
          v-if="transaction.amount !== 0"
          :label="split ? words.review.item.editSplit : words.review.item.split"
          :icon="split ? 'i-lucide-pencil' : 'i-lucide-split'"
          color="neutral"
          variant="outline"
          size="sm"
          :data-testid="split ? 'edit-split' : 'split-row'"
          @click="emit('split')"
        />
        <AskChatButton :label="rowName" data-testid="review-row-ask" @ask="ask" />
      </div>
      <div v-if="transaction.counterparty.trim() !== '' && assistKeyKept" class="flex flex-col items-start gap-1" data-testid="review-person">
        <UButton
          :label="personCounterparty ? words.review.item.asCompany : words.review.item.asPerson"
          :icon="personCounterparty ? 'i-lucide-store' : 'i-lucide-user-round'"
          color="neutral"
          variant="outline"
          size="sm"
          :loading="saving(`person-${transaction.id}`)"
          :disabled="saving(`person-${transaction.id}`)"
          data-testid="treat-counterparty"
          @click="emit('treatCounterparty')"
        />
        <p class="type-caption">{{ words.review.item.asPersonHelp }}</p>
      </div>
    </div>
  </li>
</template>
