<script setup lang="ts">
import { computed, ref } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UBadge from '@nuxt/ui/components/Badge.vue'
import UButton from '@nuxt/ui/components/Button.vue'

import { rowsRulesWouldChange, writeRules } from '../application/statementWrites'
import type { RuleEdits } from '../application/statementWrites'
import { ruleOverlaps } from '../domain/ruleOverlaps'
import RuleApplyDialog from './RuleApplyDialog.vue'
import RuleDialog from './RuleDialog.vue'
import { changesHeldRule } from './ruleAsk'
import type { RuleAsk } from './ruleAsk'
import { conditionTestOf, conditionValuesOf, ruleTestOf, words } from './words'
import { loanTargets } from '../../links/application/loanRecords'
import { loanRuleOffers } from '../../links/domain/instalmentOffers'
import type { LoanRuleOffer } from '../../links/domain/instalmentOffers'
import { paidLoansIn, sameRecord } from '../../links/domain/linkTarget'
import { loanLinks } from '../../links/presentation/loanLinks'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import type { SpendingRule } from '../../workbook/domain/spendingRule'
import { words as spendingWords } from '../../words'
import { inTryingOrder } from '../../../../shared/categorising/domain/rule'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import { plural } from '../../../../shared/text/translation'
import AppCard from '../../../../shared/ui/AppCard.vue'
import EmptyState from '../../../../shared/ui/EmptyState.vue'
import ListRow from '../../../../shared/ui/ListRow.vue'

/**
 * Spending's rules in the order they are tried, each with its conditions, what it files and labels, Stop here, where a
 * withdrawal's cash goes or the loan its rows pay, and buttons to try it earlier or later, change it and delete it. Above them,
 * the rows two rules fit counted on the book, and a rule per loan that no rule names and whose linked rows' payee no rule tests
 * yet, made with one tap. Making, moving or deleting a rule asks whether the rows already in the book follow, when any would change.
 */
const store = useSpendingBooks()
const writes = useRecordWrites(store)
const loans = computed(() => loanTargets())
const book = computed(() => store.state.workbook)
const accountName = (id: string): string => book.value?.accounts.find((account) => account.id === id)?.name ?? ''

const offers = computed(() => {
  const current = book.value
  const targets = loans.value
  if (current === null || targets === null || typeof targets === 'string') return []
  const names = new Map(current.categories.map((category) => [category.id, category.name]))
  return loanRuleOffers(current, targets).map((offer) => {
    const test = conditionValuesOf(offer.condition, accountName)
    return { offer, key: `${offer.loan.link.key} ${test}`, title: words.rules.offerTitle(test, offer.loan.loanName), caption: words.rules.offerCaption(names.get(offer.category) ?? '') }
  })
})

/** The rule a loan offers, asked about first when rows already in the book would change. */
async function makeRule(key: string, title: string, { condition, category, loan }: LoanRuleOffer): Promise<void> {
  const edits: RuleEdits = { adding: [{ conditions: [condition], category, labels: [], stop: false, withdrawal: null, link: loan.link }] }
  const written = book.value !== null && changesHeldRule(book.value.rules, edits) ? words.rules.dialog.changed : words.rules.made
  await writeOrAsk({ edits, choice: 'apply', title: words.rules.apply.title, description: title, written }, `offer-${key}`)
}

const rules = computed(() => {
  const current = book.value
  if (current === null) return []
  const categories = new Map(current.categories.map((category) => [category.id, category.name]))
  const labels = new Map(current.labels.map((label) => [label.id, label.name]))
  const targets = loans.value
  const paidLoans = targets === null || typeof targets === 'string' ? null : paidLoansIn(targets)
  const goesToOf = ({ withdrawal, link }: SpendingRule): string | null => {
    if (link !== null) {
      if (paidLoans === null) return words.rules.paysUnread
      const loan = paidLoans.find((paid) => sameRecord(paid.link, link))
      return loan === undefined ? words.rules.paysGone : words.rules.paysLoan(loan.loanName)
    }
    if (withdrawal === null) return null
    const named = withdrawal.cashAccount === null ? undefined : accountName(withdrawal.cashAccount)
    return named === undefined || named === '' ? words.rules.withdrawalByCurrency : words.rules.withdrawalTo(named)
  }
  return inTryingOrder(current.rules).map((rule) => ({
    rule,
    tests: rule.conditions.map((condition) => conditionTestOf(condition, accountName)),
    name: ruleTestOf(rule, accountName),
    files: rule.category === null ? words.rules.labelsOnly : words.rules.filesUnder(categories.get(rule.category) ?? ''),
    labels: rule.labels.map((label) => labels.get(label) ?? ''),
    goesTo: goesToOf(rule),
  }))
})

const warnings = computed(() => {
  const current = book.value
  if (current === null) return []
  return ruleOverlaps(current).map(({ first, then, rows }) => ({
    key: `${first.id} ${then.id}`,
    text: plural(words.rules.overlap(ruleTestOf(first, accountName), ruleTestOf(then, accountName), rows), rows),
  }))
})

const dialogOpen = ref(false)
const editing = ref<SpendingRule | null>(null)

function openDialog(rule: SpendingRule | null): void {
  editing.value = rule
  dialogOpen.value = true
}

const asked = ref<RuleAsk | null>(null)
const askOpen = ref(false)

/** Writes a change at once when no row already in the book would change, and otherwise asks whether they follow it. */
async function writeOrAsk(ask: RuleAsk, key: string): Promise<void> {
  const current = book.value
  if (current === null) return
  if (rowsRulesWouldChange(current, ask.edits, loanLinks()) === 0) {
    await writes.write(ask.written, (unit) => writeRules(unit, current, ask.edits, loanLinks()), { key, failedTitle: spendingWords.form.notSaved })
    return
  }
  asked.value = ask
  askOpen.value = true
}

async function move(rule: SpendingRule, name: string, direction: 'up' | 'down'): Promise<void> {
  const description = direction === 'up' ? words.rules.moveUp(name) : words.rules.moveDown(name)
  await writeOrAsk({ edits: { moving: { rule: rule.id, direction } }, choice: 'refile', title: words.rules.apply.title, description, written: words.rules.moved }, `${direction}-${rule.id}`)
}

async function remove(rule: SpendingRule, name: string): Promise<void> {
  await writeOrAsk({ edits: { deleting: [rule] }, choice: 'refile', title: words.rules.apply.title, description: words.rules.delete(name), written: words.rules.deleted }, `delete-${rule.id}`)
}
</script>

<template>
  <div>
    <EmptyState v-if="rules.length === 0 && offers.length === 0" icon="i-lucide-list-ordered" :title="words.rules.empty" :description="words.rules.emptyDescription" data-testid="spending-rules-empty">
      <template #actions>
        <UButton :label="words.rules.add" icon="i-lucide-plus" data-testid="spending-rules-add" @click="openDialog(null)" />
      </template>
    </EmptyState>
    <AppCard v-else :title="words.rules.title" :subtitle="words.rules.subtitle" data-testid="spending-rules">
      <template #actions>
        <UButton :label="words.rules.add" icon="i-lucide-plus" color="neutral" variant="outline" size="sm" data-testid="spending-rules-add" @click="openDialog(null)" />
      </template>
      <ul v-if="offers.length > 0" class="divide-y divide-default" data-testid="spending-rule-offers">
        <ListRow v-for="{ offer, key, title, caption } in offers" :key="key" :title="title" :caption="caption" data-testid="spending-rule-offer">
          <UButton
            class="self-start"
            :label="words.rules.makeRule"
            icon="i-lucide-list-plus"
            :loading="writes.saving(`offer-${key}`)"
            :disabled="writes.refused.value"
            data-testid="spending-rule-offer-make"
            @click="makeRule(key, title, offer)"
          />
        </ListRow>
      </ul>
      <UAlert
        v-if="warnings.length > 0"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :title="words.rules.overlapTitle"
        class="mx-4 mt-3 w-auto sm:mx-5"
        data-testid="spending-rule-overlap"
      >
        <template #description>
          <p v-for="warning in warnings" :key="warning.key" class="break-words">{{ warning.text }}</p>
        </template>
      </UAlert>
      <ol v-if="rules.length > 0" class="@container flex flex-col pt-1 pb-2" data-testid="spending-rule-list">
        <li
          v-for="({ rule, tests, name, files, labels, goesTo }, place) in rules"
          :key="rule.id"
          class="flex items-start gap-2 border-b border-default ps-4 pe-2 last:border-b-0 sm:ps-5 sm:pe-3"
          data-testid="spending-rule"
        >
          <span class="flex min-w-0 flex-1 flex-col gap-1 py-2">
            <span v-for="test in tests" :key="test" class="text-sm break-words text-highlighted" data-testid="spending-rule-test">{{ test }}</span>
            <span class="flex flex-wrap items-center gap-1">
              <span class="break-words type-caption" data-testid="spending-rule-files">{{ files }}</span>
              <UBadge v-for="label in labels" :key="label" :label="label" color="neutral" variant="subtle" size="sm" class="max-w-full" data-testid="spending-rule-label" />
              <UBadge v-if="rule.stop" :label="words.rules.stopHere" icon="i-lucide-octagon-x" color="neutral" variant="outline" size="sm" data-testid="spending-rule-stop" />
            </span>
            <span v-if="goesTo !== null" class="break-words type-caption" data-testid="spending-rule-goes-to">{{ goesTo }}</span>
          </span>
          <div class="grid shrink-0 grid-cols-2 @md:grid-cols-4">
            <UButton
              icon="i-lucide-arrow-up"
              color="neutral"
              variant="ghost"
              class="size-11 justify-center"
              :aria-label="words.rules.moveUp(name)"
              :disabled="place === 0"
              :loading="writes.saving(`up-${rule.id}`)"
              data-testid="spending-rule-up"
              @click="move(rule, name, 'up')"
            />
            <UButton
              icon="i-lucide-arrow-down"
              color="neutral"
              variant="ghost"
              class="size-11 justify-center"
              :aria-label="words.rules.moveDown(name)"
              :disabled="place === rules.length - 1"
              :loading="writes.saving(`down-${rule.id}`)"
              data-testid="spending-rule-down"
              @click="move(rule, name, 'down')"
            />
            <UButton
              icon="i-lucide-pencil"
              color="neutral"
              variant="ghost"
              class="size-11 justify-center"
              :aria-label="words.rules.edit(name)"
              data-testid="spending-rule-edit"
              @click="openDialog(rule)"
            />
            <UButton
              icon="i-lucide-trash-2"
              color="neutral"
              variant="ghost"
              class="size-11 justify-center"
              :aria-label="words.rules.delete(name)"
              :loading="writes.saving(`delete-${rule.id}`)"
              data-testid="spending-rule-delete"
              @click="remove(rule, name)"
            />
          </div>
        </li>
      </ol>
    </AppCard>
    <RuleDialog v-model:open="dialogOpen" :rule="editing" />
    <RuleApplyDialog v-model:open="askOpen" :asked="asked" />
  </div>
</template>
