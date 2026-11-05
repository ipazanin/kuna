<script setup lang="ts">
import { computed, ref } from 'vue'
import UBadge from '@nuxt/ui/components/Badge.vue'
import UButton from '@nuxt/ui/components/Button.vue'

import { fileRow, joinWithTyped, notAPair, pairRows, payeeCondition, rowsRuleWouldFile, writeRule } from '../application/statementWrites'
import { reviewQueue } from '../domain/reviewQueue'
import type { WaitingRow } from '../domain/reviewQueue'
import ReviewRow from './ReviewRow.vue'
import { ruleTestOf } from './ruleTest'
import { words } from './words'
import type { TransferPair } from '../../pairing/domain/transferPairs'
import { wantsSavingsAccount } from '../../pairing/domain/wantsSavingsAccount'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import type { Category } from '../../workbook/domain/category'
import type { SpendingRuleCondition } from '../../workbook/domain/spendingRule'
import type { Transaction } from '../../workbook/domain/transaction'
import { words as spendingWords } from '../../words'
import { today } from '../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import { intlLocale } from '../../../../shared/text/language'
import { plural } from '../../../../shared/text/translation'
import AppCard from '../../../../shared/ui/AppCard.vue'
import AppDialog from '../../../../shared/ui/AppDialog.vue'
import EmptyState from '../../../../shared/ui/EmptyState.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'
import ShowAllButton, { FIRST_SHOWN } from '../../../../shared/ui/ShowAllButton.vue'

/** The rows waiting for a category, the transfers the pairing made and the lone legs waiting for their other side. */
const store = useSpendingBooks()
const writes = useRecordWrites(store)

const book = computed(() => store.state.workbook)
const queue = computed(() => (book.value === null ? null : reviewQueue(book.value, today())))
const accounts = computed(() => book.value?.accounts ?? [])
const categories = computed(() => book.value?.categories ?? [])
const transfer = computed(() => categories.value.find((category) => category.kind === 'transfer') ?? null)

/** A first import waits with thousands of rows, each with a menu, which a phone cannot lay out at once. */
const allShown = ref(false)
const shownWaiting = computed(() => (allShown.value ? (queue.value?.waiting ?? []) : (queue.value?.waiting ?? []).slice(0, FIRST_SHOWN)))

const accountOf = (row: Transaction) => accounts.value.find((account) => account.id === row.account)
const formatOf = (row: Transaction) => ({ currency: accountOf(row)?.currency ?? 'EUR', locale: intlLocale })

/** The rule Always for this payee would make, while its dialog asks. */
const askedRule = ref<{ readonly condition: SpendingRuleCondition; readonly category: Category } | null>(null)
const ruleDialogOpen = ref(false)

function askRule(condition: SpendingRuleCondition, category: Category): void {
  askedRule.value = { condition, category }
  ruleDialogOpen.value = true
}

const rowsFiled = computed(() => (book.value === null || askedRule.value === null ? 0 : rowsRuleWouldFile(book.value, askedRule.value.condition, askedRule.value.category.id)))

async function makeRule(): Promise<void> {
  const current = book.value
  const asked = askedRule.value
  if (current === null || asked === null) return
  if (await writes.write(words.rules.made, (unit) => writeRule(unit, current, asked.condition, asked.category.id), { key: 'make-rule', failedTitle: words.review.notWritten }))
    ruleDialogOpen.value = false
}

async function file(row: Transaction, category: Category): Promise<void> {
  const condition = payeeCondition(row)
  await writes.write(words.review.filed, (unit) => fileRow(unit, row, category), {
    failedTitle: words.review.notWritten,
    ...(condition === null ? {} : { follow: { label: words.review.always, icon: 'i-lucide-list-plus', run: () => askRule(condition, category) } }),
  })
}

async function join({ maybeTyped }: WaitingRow): Promise<void> {
  if (maybeTyped !== null) await writes.write(words.review.joined, (unit) => joinWithTyped(unit, maybeTyped.typed, maybeTyped.bank), { failedTitle: words.review.notWritten })
}

async function pair({ maybeTransfer }: WaitingRow): Promise<void> {
  const category = transfer.value
  if (maybeTransfer !== null && category !== null) await writes.write(words.review.paired, (unit) => pairRows(unit, maybeTransfer, category.id), { failedTitle: words.review.notWritten })
}

async function undoPair(legs: TransferPair): Promise<void> {
  await writes.write(words.review.pairUndone, (unit) => notAPair(unit, legs), { key: `not-a-pair-${legs.debit.id}`, failedTitle: words.review.notWritten })
}
</script>

<template>
  <div v-if="queue !== null" class="flex flex-col gap-6">
    <p v-if="queue.wantingSavings > 0" class="text-sm text-muted" data-testid="spending-wants-savings">{{ plural(words.review.pocketsWaiting(queue.wantingSavings), queue.wantingSavings) }}</p>
    <EmptyState v-if="queue.waiting.length === 0" icon="i-lucide-inbox" :title="words.review.empty" :description="words.review.emptyDescription" data-testid="spending-review-empty" />
    <AppCard v-else :title="words.review.title" :subtitle="words.review.subtitle" data-testid="spending-review">
      <ul class="divide-y divide-default pt-1 pb-1">
        <ReviewRow
          v-for="waiting in shownWaiting"
          :key="waiting.row.id"
          :waiting="waiting"
          :categories="categories"
          :accounts="accounts"
          @file="file(waiting.row, $event)"
          @join="join(waiting)"
          @pair="pair(waiting)"
        />
      </ul>
      <div v-if="queue.waiting.length > FIRST_SHOWN" class="px-4 pb-3 sm:px-5">
        <ShowAllButton v-model:expanded="allShown" :total="queue.waiting.length" />
      </div>
    </AppCard>
    <AppCard v-if="queue.pairs.length > 0 || queue.loneLegs.length > 0" :title="words.review.pairs" :subtitle="words.review.pairsSubtitle" data-testid="spending-pairs">
      <ul class="divide-y divide-default pt-1 pb-1">
        <li v-for="legs in queue.pairs" :key="legs.debit.id" class="flex flex-col gap-2 px-4 py-3 sm:px-5" data-testid="spending-pair">
          <div class="flex items-start gap-3">
            <span class="flex min-w-0 flex-1 flex-col gap-0.5">
              <span class="break-words text-sm text-highlighted">{{ accountOf(legs.debit)?.name }} → {{ accountOf(legs.credit)?.name }}</span>
              <span class="break-words type-caption">{{ dayLabel(legs.debit.date) }}</span>
            </span>
            <MoneyText :cents="legs.debit.amount" sign="always" tone="flow" class="shrink-0 text-sm" :format="formatOf(legs.debit)" />
          </div>
          <UButton
            class="self-start"
            color="neutral"
            variant="outline"
            :label="words.review.notAPair"
            :loading="writes.saving(`not-a-pair-${legs.debit.id}`)"
            data-testid="spending-not-a-pair"
            @click="undoPair(legs)"
          />
        </li>
        <li v-for="leg in queue.loneLegs" :key="leg.id" class="flex items-start gap-3 px-4 py-3 sm:px-5" data-testid="spending-lone-leg">
          <span class="flex min-w-0 flex-1 flex-col gap-1">
            <span class="break-words text-sm text-highlighted">{{ leg.payee }}</span>
            <span class="break-words type-caption">{{ dayLabel(leg.date) }} · {{ accountOf(leg)?.name }}</span>
            <UBadge
              :label="wantsSavingsAccount(leg, accounts) ? words.review.wantsSavings : words.review.waitingForOther"
              color="neutral"
              variant="subtle"
              size="sm"
              class="self-start"
              data-testid="spending-lone-leg-state"
            />
          </span>
          <MoneyText :cents="leg.amount" sign="always" tone="flow" class="shrink-0 text-sm" :format="formatOf(leg)" />
        </li>
      </ul>
    </AppCard>
    <AppDialog v-model:open="ruleDialogOpen" :title="words.review.always" :description="askedRule === null ? undefined : `${ruleTestOf(askedRule.condition)} → ${askedRule.category.name}`">
      <p class="text-sm text-highlighted" data-testid="spending-rule-files">{{ plural(words.rules.files(rowsFiled), rowsFiled) }}</p>
      <template #end>
        <UButton :label="spendingWords.form.cancel" color="neutral" variant="ghost" data-testid="spending-rule-cancel" @click="ruleDialogOpen = false" />
        <UButton :label="words.rules.confirm" icon="i-lucide-list-plus" :loading="writes.saving('make-rule')" data-testid="spending-rule-confirm" @click="makeRule" />
      </template>
    </AppDialog>
  </div>
</template>
