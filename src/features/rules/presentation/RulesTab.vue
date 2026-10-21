<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UBadge from '@nuxt/ui/components/Badge.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import USwitch from '@nuxt/ui/components/Switch.vue'

import AppCard from '../../../shared/ui/AppCard.vue'
import ProblemList from '../../excel/presentation/ProblemList.vue'
import CategoryChip from '../../transactions/presentation/CategoryChip.vue'
import { useWorkbook } from '../../workbook/application/workbookStore'
import { UNCLASSIFIED } from '../../workbook/domain/bucket'
import { categorise } from '../domain/categorise'
import { inTryingOrder } from '../domain/rule'
import type { Rule } from '../domain/rule'
import { blankDraft, draftOfRule } from '../domain/ruleDraft'
import { swapWithNeighbour } from '../domain/rulePlacement'
import type { RuleRowEdit } from '../domain/rulesTabChange'
import { conditionInWords } from '../domain/ruleSummary'
import { categorisationContextOf } from '../domain/transactionFacts'
import RuleChangeDialog from './RuleChangeDialog.vue'
import type { PendingRulesChange } from './RuleChangeDialog.vue'
import RuleEditor from './RuleEditor.vue'
import type { RuleEditorSource } from './RuleEditor.vue'

/** The rules tab in the order rules are tried, each switched, moved, edited or added through the same checked write. */
const { state } = useWorkbook()

const workbook = computed(() => state.workbook)
const ordered = computed(() => inTryingOrder(workbook.value?.rules ?? []))
const problems = computed(() => (workbook.value?.problems ?? []).filter((problem) => problem.tab === 'rules'))
const summary = computed(() => {
  const on = ordered.value.filter((rule) => rule.enabled).length
  return `${ordered.value.length} ${ordered.value.length === 1 ? 'rule' : 'rules'}, ${on} switched on`
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

/** A link such as `?tab=rules&rule=accountant` marks that rule and scrolls to it. */
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

function rowOf(rule: Rule): RuleRowEdit['expected'] | null {
  return state.snapshot?.rules.find((row) => row.sheetRow === rule.sheetRow)?.cells ?? null
}

function addRule(): void {
  editorSource.value = { title: 'Add a rule', draft: blankDraft(workbook.value?.rules ?? []), edited: null }
  editorOpen.value = true
}

function editRule(rule: Rule): void {
  const source = draftOfRule(rule, state.snapshot?.rules ?? [], workbook.value?.rules ?? [])
  if (source === null) return
  editorSource.value = { title: `Edit ${rule.id}`, ...source }
  editorOpen.value = true
}

function toggleRule(rule: Rule): void {
  const expected = rowOf(rule)
  if (expected === null) return
  const switching = rule.enabled ? 'Switch off' : 'Switch on'
  pending.value = {
    title: `${switching} ${rule.id}`,
    description: rule.enabled ? 'It stays on the tab and is no longer tried.' : 'It is tried again at its place in the order.',
    change: { appended: null, edited: [{ id: rule.id, expected, cells: { ...expected, enabled: !rule.enabled } }] },
    saved: `${rule.enabled ? 'Switched off' : 'Switched on'} ${rule.id}`,
    action: switching,
  }
  dialogOpen.value = true
}

function moveRule(rule: Rule, way: 'earlier' | 'later'): void {
  const orders = swapWithNeighbour(workbook.value?.rules ?? [], rule.id, way)
  if (orders === null) return
  const edited = [...orders].flatMap(([id, order]): RuleRowEdit[] => {
    const moved = ordered.value.find((candidate) => candidate.id === id)
    const expected = moved === undefined ? null : rowOf(moved)
    return expected === null ? [] : [{ id, expected, cells: { ...expected, order } }]
  })
  pending.value = {
    title: `Try ${rule.id} ${way}`,
    description: orders.size === 2 ? 'It trades orders with its neighbour.' : 'Two rules share an order, so every rule is renumbered in steps of 100.',
    change: { appended: null, edited },
    saved: `Moved ${rule.id}`,
    action: 'Move it',
  }
  dialogOpen.value = true
}
</script>

<template>
  <AppCard
    title="Rules"
    subtitle="Tried from the top. The first enabled rule whose conditions all hold decides a row. Every save is checked the way the Apps Script reads the tab."
    collapse-id="review.rules"
    :summary="summary"
    :reveal="highlightedId !== null"
    data-testid="rules-tab"
  >
    <template #actions>
      <UButton label="Add rule" icon="i-lucide-plus" color="neutral" variant="outline" size="sm" :disabled="state.writing" data-testid="add-rule" @click="addRule" />
    </template>

    <div v-if="problems.length" class="flex flex-col gap-3 px-4 pt-4 sm:px-5">
      <UAlert
        icon="i-lucide-octagon-x"
        color="error"
        variant="subtle"
        :title="`${problems.length} ${problems.length === 1 ? 'row' : 'rows'} on the rules tab cannot be read`"
        description="The Apps Script refuses the whole tab while any is left, and the app saves no rule until they are fixed in the workbook."
      />
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
          :label="rule.enabled ? 'On' : 'Off'"
          :aria-label="`${rule.enabled ? 'Switch off' : 'Switch on'} ${rule.id}`"
          :disabled="state.writing"
          class="rule-switch"
          @update:model-value="toggleRule(rule)"
        />
        <div class="rule-main">
          <p class="flex flex-wrap items-center gap-2">
            <span class="identifier text-highlighted">{{ rule.id }}</span>
            <UBadge :label="rule.confidence === 'rule' ? 'Settles' : 'Waits for review'" :color="rule.confidence === 'rule' ? 'neutral' : 'info'" variant="subtle" size="sm" />
          </p>
          <ul class="mt-1.5 flex flex-wrap gap-1.5">
            <li v-for="condition in rule.conditions" :key="condition.column" class="condition">{{ conditionInWords(condition) }}</li>
          </ul>
          <p v-if="rule.note" class="mt-1.5 text-xs text-muted">{{ rule.note }}</p>
        </div>
        <div class="rule-outcome">
          <CategoryChip :category="rule.category" :bucket="bucketBySlug.get(rule.category) ?? UNCLASSIFIED" />
          <p class="figure text-xs text-muted">
            Decides {{ decided.get(rule.id) ?? 0 }} {{ (decided.get(rule.id) ?? 0) === 1 ? 'row' : 'rows' }}, order {{ rule.order }}
          </p>
        </div>
        <div class="rule-actions">
          <UButton icon="i-lucide-arrow-up" color="neutral" variant="ghost" size="sm" :aria-label="`Try ${rule.id} earlier`" :disabled="index === 0 || state.writing" @click="moveRule(rule, 'earlier')" />
          <UButton
            icon="i-lucide-arrow-down"
            color="neutral"
            variant="ghost"
            size="sm"
            :aria-label="`Try ${rule.id} later`"
            :disabled="index === ordered.length - 1 || state.writing"
            @click="moveRule(rule, 'later')"
          />
          <UButton label="Edit" icon="i-lucide-pencil" color="neutral" variant="outline" size="sm" :disabled="state.writing" data-testid="edit-rule" @click="editRule(rule)" />
        </div>
      </li>
    </ol>
    <p v-else class="px-4 py-6 text-sm text-muted sm:px-5">No rules yet. Every row then waits for review, so add one for each counterparty that always means the same category.</p>
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
