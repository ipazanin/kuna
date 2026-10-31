<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UBadge from '@nuxt/ui/components/Badge.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import USwitch from '@nuxt/ui/components/Switch.vue'

import AppCard from '../../../../shared/ui/AppCard.vue'
import ProblemList from '../../workbook-files/presentation/ProblemList.vue'
import CategoryChip from '../../transactions/presentation/CategoryChip.vue'
import { useWorkbook } from '../../workbook/application/workbookStore'
import { UNCLASSIFIED } from '../../workbook/domain/bucket'
import { recordsOf } from '../../../../shared/storage/domain/recordsRead'
import type { RuleTabRow } from '../domain/readRules'
import { categorise } from '../domain/categorise'
import { inTryingOrder } from '../domain/rule'
import type { Rule } from '../domain/rule'
import { blankDraft, draftOfRule } from '../domain/ruleDraft'
import { swapWithNeighbour } from '../domain/rulePlacement'
import { sameId } from '../domain/rulesTabChange'
import type { RuleRowEdit } from '../domain/rulesTabChange'
import { conditionInWords } from '../domain/ruleSummary'
import { categorisationContextOf } from '../domain/transactionFacts'
import RuleChangeDialog from './RuleChangeDialog.vue'
import type { PendingRulesChange } from './RuleChangeDialog.vue'
import RuleEditor from './RuleEditor.vue'
import type { RuleEditorSource } from './RuleEditor.vue'
import { words } from './words'
import { plural } from '../../../../shared/text/translation'

/** The rules tab in the order rules are tried, each switched, moved, edited, deleted or added through the same checked write. */
const { state } = useWorkbook()

const workbook = computed(() => state.workbook)
const ordered = computed(() => inTryingOrder(workbook.value?.rules ?? []))
const problems = computed(() => (workbook.value?.problems ?? []).filter((problem) => problem.tab === 'rules'))
const summary = computed(() => {
  const on = ordered.value.filter((rule) => rule.enabled).length
  return words.tab.summary(ordered.value.length, on)
})
const bucketBySlug = computed(() => new Map((workbook.value?.categories ?? []).map((category) => [category.slug, category.bucket])))

/** How many ledger rows each rule decides today. */
const decided = computed(() => {
  const counts = new Map<string, number>()
  const current = workbook.value
  if (current === null) return counts
  const context = categorisationContextOf(current)
  for (const transaction of current.transactions) {
    const ruleId = categorise(transaction, current.rules, context).ruleId
    if (ruleId !== null) counts.set(ruleId, (counts.get(ruleId) ?? 0) + 1)
  }
  return counts
})

/** A link such as `?tab=category-rules&rule=accountant` marks that rule and scrolls to it. */
const route = useRoute()
const highlightedId = computed(() => (typeof route.query.rule === 'string' ? route.query.rule.toLowerCase() : null))
const highlightedRow = ref<HTMLElement | null>(null)

function isHighlighted(rule: Rule): boolean {
  return rule.id.toLowerCase() === highlightedId.value
}

function holdIfHighlighted(rule: Rule, element: unknown): void {
  if (isHighlighted(rule)) highlightedRow.value = element instanceof HTMLElement ? element : null
}

/** Scrolls once the marked row is on the page, which on a first load comes after the rules arrive. */
watch(highlightedRow, (row) => row?.scrollIntoView({ block: 'center' }), { flush: 'post' })

const editorOpen = ref(false)
const editorSource = ref<RuleEditorSource | null>(null)
const dialogOpen = ref(false)
const pending = ref<PendingRulesChange | null>(null)

function ruleRows(): readonly RuleTabRow[] {
  return state.records === null ? [] : recordsOf(state.records.rules)
}

function rowOf(rule: Rule): RuleRowEdit['expected'] | null {
  return ruleRows().find((row) => sameId(row.fields.rule, rule.id))?.fields ?? null
}

function addRule(): void {
  editorSource.value = { title: words.tab.addTitle, draft: blankDraft(workbook.value?.rules ?? []), edited: null }
  editorOpen.value = true
}

function editRule(rule: Rule): void {
  const source = draftOfRule(rule, ruleRows(), workbook.value?.rules ?? [])
  if (source === null) return
  editorSource.value = { title: words.tab.editTitle(rule.id), ...source }
  editorOpen.value = true
}

function toggleRule(rule: Rule): void {
  const expected = rowOf(rule)
  if (expected === null) return
  pending.value = {
    title: words.tab.switchName(rule.enabled, rule.id),
    description: rule.enabled ? words.tab.staysOnTab : words.tab.triedAgain,
    change: { appended: null, edited: [{ id: rule.id, expected, fields: { ...expected, enabled: !rule.enabled } }], removed: null },
    saved: words.tab.switched(!rule.enabled, rule.id),
    action: rule.enabled ? words.tab.switchOff : words.tab.switchOn,
  }
  dialogOpen.value = true
}

function moveRule(rule: Rule, way: 'earlier' | 'later'): void {
  const orders = swapWithNeighbour(workbook.value?.rules ?? [], rule.id, way)
  if (orders === null) return
  const edited = [...orders].flatMap(([id, order]): RuleRowEdit[] => {
    const moved = ordered.value.find((candidate) => candidate.id === id)
    const expected = moved === undefined ? null : rowOf(moved)
    return expected === null ? [] : [{ id, expected, fields: { ...expected, order: String(order) } }]
  })
  pending.value = {
    title: words.tab.tryWay(rule.id, way),
    description: orders.size === 2 ? words.tab.tradesOrders : words.tab.renumbers,
    change: { appended: null, edited, removed: null },
    saved: words.tab.moved(rule.id),
    action: words.tab.moveIt,
  }
  dialogOpen.value = true
}
</script>

<template>
  <AppCard :title="words.tab.title" :subtitle="words.tab.subtitle" collapse-id="settings.category-rules" :summary="summary" :reveal="highlightedId !== null" data-testid="rules-tab">
    <template #actions>
      <UButton :label="words.tab.add" icon="i-lucide-plus" color="neutral" variant="outline" size="sm" :disabled="state.writing" data-testid="add-rule" @click="addRule" />
    </template>

    <div v-if="problems.length" class="flex flex-col gap-3 px-4 pt-4 sm:px-5">
      <UAlert icon="i-lucide-octagon-x" color="error" variant="subtle" :title="plural(words.tab.unreadable(problems.length), problems.length)" :description="words.tab.unreadableHelp" />
      <ProblemList :problems="problems" />
    </div>

    <ol v-if="ordered.length" class="mt-3 border-t border-default" data-testid="rules-list">
      <li
        v-for="(rule, index) in ordered"
        :key="rule.id"
        :ref="(element) => holdIfHighlighted(rule, element)"
        class="rule-row"
        :class="{ disabled: !rule.enabled, highlighted: isHighlighted(rule) }"
        :aria-current="isHighlighted(rule) ? 'true' : undefined"
        data-testid="rule-row"
      >
        <USwitch
          :model-value="rule.enabled"
          :label="rule.enabled ? words.tab.on : words.tab.off"
          :aria-label="words.tab.switchName(rule.enabled, rule.id)"
          :disabled="state.writing"
          class="rule-switch"
          @update:model-value="toggleRule(rule)"
        />
        <div class="rule-main">
          <p class="flex flex-wrap items-center gap-2">
            <span class="identifier text-highlighted">{{ rule.id }}</span>
            <UBadge :label="rule.confidence === 'rule' ? words.tab.settles : words.tab.waitsForReview" :color="rule.confidence === 'rule' ? 'neutral' : 'info'" variant="subtle" size="sm" />
          </p>
          <ul class="mt-1.5 flex flex-wrap gap-1.5">
            <li v-for="condition in rule.conditions" :key="condition.column" class="condition">{{ conditionInWords(condition) }}</li>
          </ul>
          <p v-if="rule.note" class="mt-1.5 text-xs text-muted">{{ rule.note }}</p>
        </div>
        <div class="rule-outcome">
          <CategoryChip :category="rule.category" :bucket="bucketBySlug.get(rule.category) ?? UNCLASSIFIED" />
          <p class="figure text-xs text-muted">{{ words.tab.decides(decided.get(rule.id) ?? 0, rule.order) }}</p>
        </div>
        <div class="rule-actions">
          <UButton
            icon="i-lucide-arrow-up"
            color="neutral"
            variant="ghost"
            size="sm"
            :aria-label="words.tab.earlier(rule.id)"
            :disabled="index === 0 || state.writing"
            @click="moveRule(rule, 'earlier')"
          />
          <UButton
            icon="i-lucide-arrow-down"
            color="neutral"
            variant="ghost"
            size="sm"
            :aria-label="words.tab.later(rule.id)"
            :disabled="index === ordered.length - 1 || state.writing"
            @click="moveRule(rule, 'later')"
          />
          <UButton :label="words.tab.edit" icon="i-lucide-pencil" color="neutral" variant="outline" size="sm" :disabled="state.writing" data-testid="edit-rule" @click="editRule(rule)" />
        </div>
      </li>
    </ol>
    <p v-else class="px-4 py-6 text-sm text-muted sm:px-5">{{ words.tab.none }}</p>
    <div class="h-2" />

    <RuleEditor v-model:open="editorOpen" :source="editorSource" />
    <RuleChangeDialog v-model:open="dialogOpen" :pending="pending" />
  </AppCard>
</template>

<style scoped>
.rule-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.5rem 0.75rem;
  padding: 0.75rem 1rem;
}

.rule-row + .rule-row {
  border-top: 1px solid var(--border-default);
}

.rule-row.highlighted {
  background: var(--surface-elevated);
  box-shadow: inset 3px 0 0 var(--accent);
}

.rule-row.disabled .rule-main,
.rule-row.disabled .rule-outcome {
  opacity: 0.6;
}

.rule-switch {
  padding-top: 0.125rem;
}

.rule-outcome,
.rule-actions {
  grid-column: 2;
}

.rule-outcome {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.375rem 0.75rem;
}

.rule-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.25rem;
}

.condition {
  padding: 0.0625rem 0.5rem;
  border-radius: var(--radius-control);
  background: var(--surface-elevated);
  font-size: 0.75rem;
  color: var(--ink-secondary);
  overflow-wrap: anywhere;
}

@media (min-width: 1024px) {
  .rule-row {
    grid-template-columns: auto minmax(0, 1fr) 15rem auto;
    align-items: start;
    padding-inline: 1.25rem;
  }

  .rule-outcome {
    grid-column: 3;
    flex-direction: column;
    align-items: flex-start;
  }

  .rule-actions {
    grid-column: 4;
  }
}
</style>
