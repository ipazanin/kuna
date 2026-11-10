<script setup lang="ts">
import { computed, ref } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'

import { deleteRule } from '../application/statementWrites'
import { ruleGroups } from '../domain/ruleGroups'
import type { RuleOverlap } from '../domain/ruleGroups'
import RuleDialog from './RuleDialog.vue'
import { ruleTestOf } from './ruleTest'
import { words } from './words'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import type { Category } from '../../workbook/domain/category'
import type { SpendingRule } from '../../workbook/domain/spendingRule'
import { words as spendingWords } from '../../words'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import { listInWords } from '../../../../shared/text/listInWords'
import { plural } from '../../../../shared/text/translation'
import AppCard from '../../../../shared/ui/AppCard.vue'
import EmptyState from '../../../../shared/ui/EmptyState.vue'

/** Spending's rules under the category each files into, each with Change and Delete and where a withdrawal's cash goes, and a group's Add for several payees or IBANs at once. */
const store = useSpendingBooks()
const writes = useRecordWrites(store)

const groups = computed(() => {
  const book = store.state.workbook
  if (book === null) return []
  const names = new Map(book.categories.map((category) => [category.id, category.name]))
  const testOf = (rule: SpendingRule) => (rule.condition.column === 'counterparty_iban' ? rule.condition.iban : words.rules.quoted(rule.condition.fragment))
  const categoryOf = (rule: SpendingRule) => names.get(rule.category) ?? ''
  const accounts = new Map(book.accounts.map((account) => [account.id, account.name]))
  const goesToOf = ({ withdrawal }: SpendingRule): string | null => {
    if (withdrawal === null) return null
    const named = withdrawal.cashAccount === null ? undefined : accounts.get(withdrawal.cashAccount)
    return named === undefined ? words.rules.withdrawalByCurrency : words.rules.withdrawalTo(named)
  }
  return ruleGroups(book).map((group) => ({
    ...group,
    rules: group.rules.map((rule) => ({ rule, test: ruleTestOf(rule.condition), goesTo: goesToOf(rule) })),
    warnings: sharingOneLater(group.overlaps).map(({ firsts, then, firstOnlyMoneyIn }) =>
      words.rules.overlap({ test: listInWords(firsts.map(testOf)), category: categoryOf(firsts[0]!) }, { test: testOf(then), category: categoryOf(then) }, firstOnlyMoneyIn),
    ),
  }))
})

/** The overlaps with one later rule and earlier rules of one category, as one warning, so three Ina stations against Ina read as one sentence. */
function sharingOneLater(overlaps: readonly RuleOverlap[]): readonly { readonly firsts: readonly SpendingRule[]; readonly then: SpendingRule; readonly firstOnlyMoneyIn: boolean }[] {
  const merged = new Map<string, { firsts: SpendingRule[]; then: SpendingRule; firstOnlyMoneyIn: boolean }>()
  for (const { first, then, firstOnlyMoneyIn } of overlaps) {
    const key = `${then.id} ${first.category}`
    const held = merged.get(key)
    if (held === undefined) merged.set(key, { firsts: [first], then, firstOnlyMoneyIn })
    else held.firsts.push(first)
  }
  return [...merged.values()]
}

const dialogOpen = ref(false)
const editing = ref<SpendingRule | null>(null)
const addingTo = ref<Category | null>(null)

function openDialog(rule: SpendingRule | null, category: Category | null): void {
  editing.value = rule
  addingTo.value = category
  dialogOpen.value = true
}

async function remove(rule: SpendingRule): Promise<void> {
  const book = store.state.workbook
  if (book !== null) await writes.write(words.rules.deleted, (unit) => deleteRule(unit, book, rule), { key: `delete-${rule.id}`, failedTitle: spendingWords.form.notDeleted })
}
</script>

<template>
  <div>
    <EmptyState v-if="groups.length === 0" icon="i-lucide-list-ordered" :title="words.rules.empty" :description="words.rules.emptyDescription" data-testid="spending-rules-empty">
      <template #actions>
        <UButton :label="words.rules.add" icon="i-lucide-plus" data-testid="spending-rules-add" @click="openDialog(null, null)" />
      </template>
    </EmptyState>
    <AppCard v-else :title="words.rules.title" :subtitle="words.rules.subtitle" data-testid="spending-rules">
      <template #actions>
        <UButton :label="words.rules.add" icon="i-lucide-plus" color="neutral" variant="outline" size="sm" data-testid="spending-rules-add" @click="openDialog(null, null)" />
      </template>
      <div class="flex flex-col pt-3 pb-2">
        <section v-for="group in groups" :key="group.category.id" data-testid="spending-rule-group">
          <div class="group-row flex items-center gap-2 px-4 sm:px-5">
            <span class="flex min-w-0 flex-1 flex-col py-2">
              <span class="break-words" data-testid="spending-rule-group-name">{{ group.category.name }}</span>
              <span class="break-words type-caption">{{
                [group.parent?.name ?? '', plural(words.rules.count(group.rules.length), group.rules.length)].filter((part) => part !== '').join(' · ')
              }}</span>
            </span>
            <UButton
              :label="words.rules.addHere"
              icon="i-lucide-plus"
              color="neutral"
              variant="ghost"
              size="sm"
              class="shrink-0"
              :aria-label="words.rules.addTo(group.category.name)"
              data-testid="spending-rule-group-add"
              @click="openDialog(null, group.category)"
            />
          </div>
          <UAlert
            v-if="group.warnings.length > 0"
            color="warning"
            variant="subtle"
            icon="i-lucide-triangle-alert"
            :title="words.rules.overlapTitle"
            class="mx-4 mt-2 mb-1 w-auto sm:mx-5"
            data-testid="spending-rule-overlap"
          >
            <template #description>
              <p v-for="warning in group.warnings" :key="warning">{{ warning }}</p>
            </template>
          </UAlert>
          <ul class="flex flex-col">
            <li v-for="{ rule, test, goesTo } in group.rules" :key="rule.id" class="flex items-center gap-2 border-b border-default ps-4 pe-4 sm:ps-5 sm:pe-5" data-testid="spending-rule">
              <span class="flex min-w-0 flex-1 flex-col gap-0.5 py-2">
                <span class="text-sm break-words text-highlighted">{{ test }}</span>
                <span v-if="goesTo !== null" class="break-words type-caption" data-testid="spending-rule-goes-to">{{ goesTo }}</span>
              </span>
              <div class="flex shrink-0 items-center">
                <UButton
                  icon="i-lucide-pencil"
                  color="neutral"
                  variant="ghost"
                  class="size-11 justify-center"
                  :aria-label="words.rules.edit(test)"
                  data-testid="spending-rule-edit"
                  @click="openDialog(rule, null)"
                />
                <UButton
                  icon="i-lucide-trash-2"
                  color="neutral"
                  variant="ghost"
                  class="size-11 justify-center"
                  :aria-label="words.rules.delete(test)"
                  :loading="writes.saving(`delete-${rule.id}`)"
                  data-testid="spending-rule-delete"
                  @click="remove(rule)"
                />
              </div>
            </li>
          </ul>
        </section>
      </div>
    </AppCard>
    <RuleDialog v-model:open="dialogOpen" :rule="editing" :category="addingTo" />
  </div>
</template>
