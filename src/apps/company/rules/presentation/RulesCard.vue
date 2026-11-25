<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UBadge from '@nuxt/ui/components/Badge.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import USwitch from '@nuxt/ui/components/Switch.vue'

import AppCard from '../../../../shared/ui/AppCard.vue'
import MoveButtons from '../../../../shared/ui/MoveButtons.vue'
import RemovableChip from '../../../../shared/ui/RemovableChip.vue'
import ShowAllButton, { FIRST_SHOWN } from '../../../../shared/ui/ShowAllButton.vue'
import { rulesFiling } from '../../../../shared/categorising/domain/rulesFiling'
import { labelIdNamed, SORTING_CARDS } from '../../sorting/presentation/sortingLinks'
import { displayNamesOf } from '../../workbook/domain/displayName'
import { ruleTargetsOf } from '../domain/ruleTargets'
import ProblemList from '../../workbook-files/presentation/ProblemList.vue'
import CategoryChip from '../../transactions/presentation/CategoryChip.vue'
import { useWorkbook } from '../../workbook/application/workbookStore'
import { UNCLASSIFIED } from '../../workbook/domain/bucket'
import { recordsOf } from '../../../../shared/storage/domain/recordsRead'
import type { RuleTabRow } from '../domain/readRules'
import { categorise } from '../domain/categorise'
import { inTryingOrder } from '../../../../shared/categorising/domain/ruleOrder'
import type { Rule } from '../domain/rule'
import { blankDraft, draftOfRule } from '../domain/ruleDraft'
import { swapWithNeighbour } from '../domain/rulePlacement'
import { sameId } from '../domain/rulesTabChange'
import type { RuleRowEdit } from '../domain/rulesTabChange'
import { conditionInWords } from '../domain/ruleSummary'
import { categorisationContextOf } from '../domain/categorisationContext'
import RuleChangeDialog from './RuleChangeDialog.vue'
import type { PendingRulesChange } from './RuleChangeDialog.vue'
import RuleEditor from './RuleEditor.vue'
import type { RuleEditorSource } from './RuleEditor.vue'
import { words } from './words'
import { plural } from '../../../../shared/text/translation'

/**
 * The Rules card of Sorting in the order rules are tried, each with what it files and the labels it puts on, and each switched, moved, edited, deleted or added
 * through the same checked write. A `?category=` or `?label=` in the address shows only the rules that file under that category or put that label on, with a
 * chip that shows them all again. The move arrows show only with every rule, since the order means something only there. The first ten rules show
 * until Show all, or every rule when the rule a `?rule=` marks is further down.
 */
const { state } = useWorkbook()

const workbook = computed(() => state.workbook)
const ordered = computed(() => inTryingOrder(workbook.value?.rules ?? []))
const problems = computed(() => (workbook.value?.problems ?? []).filter((problem) => problem.tab === 'rules'))
const summary = computed(() => {
  const on = ordered.value.filter((rule) => rule.enabled).length
  return words.tab.summary(ordered.value.length, on)
})
const bucketBySlug = computed(() => new Map((workbook.value?.categories ?? []).map((category) => [category.slug, category.bucket])))
const labelNames = computed(() => new Map((workbook.value?.labels ?? []).map((label) => [label.id, label.name])))

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

const route = useRoute()
const router = useRouter()

/** The category or label the address shows the rules of, with the line an empty list says, or null for every rule. */
const shownFor = computed(() => {
  const current = workbook.value
  if (current === null) return null
  const slug = typeof route.query.category === 'string' ? route.query.category.trim().toLowerCase() : ''
  if (slug !== '' && current.categories.some((category) => category.slug === slug)) {
    const name = displayNamesOf(current).category(slug)
    return { key: slug, name, none: words.tab.noneInto(name) }
  }
  const labelId = labelIdNamed(route.query.label)
  const label = labelId === null ? undefined : current.labels.find((held) => held.id === labelId)
  return label === undefined ? null : { key: label.id, name: label.name, none: words.tab.noneOn(label.name) }
})

const shown = computed(() => (shownFor.value === null ? ordered.value : rulesFiling(ordered.value, shownFor.value.key, ruleTargetsOf)))

function showEveryRule(): void {
  const { category: _category, label: _label, ...query } = route.query
  void router.replace({ query, hash: `#${SORTING_CARDS.rules}` })
}

/** A link such as `?rule=accountant` marks that rule and scrolls to it. */
const highlightedId = computed(() => (typeof route.query.rule === 'string' ? route.query.rule.toLowerCase() : null))
const highlightedRow = ref<HTMLElement | null>(null)

function isHighlighted(rule: Rule): boolean {
  return rule.id.toLowerCase() === highlightedId.value
}

function holdIfHighlighted(rule: Rule, element: unknown): void {
  if (isHighlighted(rule)) highlightedRow.value = element instanceof HTMLElement ? element : null
}

const allShown = ref(false)
const listed = computed(() => (allShown.value ? shown.value : shown.value.slice(0, FIRST_SHOWN)))

const highlightedFurtherDown = computed(() => shown.value.findIndex(isHighlighted) >= FIRST_SHOWN)
watch(
  highlightedFurtherDown,
  (furtherDown) => {
    if (furtherDown) allShown.value = true
  },
  { immediate: true },
)

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
  <AppCard
    :id="SORTING_CARDS.rules"
    :title="words.tab.title"
    :subtitle="words.tab.subtitle"
    collapse-id="company-sorting.rules"
    :summary="summary"
    :reveal="highlightedId !== null || route.hash === `#${SORTING_CARDS.rules}`"
    data-testid="company-rules"
  >
    <template #actions>
      <UButton :label="words.tab.add" icon="i-lucide-plus" color="neutral" variant="outline" size="sm" data-testid="add-rule" @click="addRule" />
    </template>

    <div v-if="problems.length" class="flex flex-col gap-3 px-4 pt-4 sm:px-5">
      <UAlert icon="i-lucide-octagon-x" color="error" variant="subtle" :title="plural(words.tab.unreadable(problems.length), problems.length)" :description="words.tab.unreadableHelp" />
      <ProblemList :problems="problems" />
    </div>

    <div v-if="shownFor !== null" class="flex flex-wrap items-center gap-2 px-4 pt-3 sm:px-5" data-testid="company-rules-shown-for">
      <RemovableChip :label="words.tab.onlyFor(shownFor.name)" :remove-label="words.tab.showAll(shownFor.name)" icon="i-lucide-filter" @remove="showEveryRule" />
    </div>

    <template v-if="shown.length">
      <ol class="mt-3 divide-y divide-default border-t border-default" data-testid="rules-list">
        <li
          v-for="rule in listed"
          :key="rule.id"
          :ref="(element) => holdIfHighlighted(rule, element)"
          class="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 border-s-3 py-3 ps-[calc(1rem-3px)] pe-4 @2xl:grid-cols-[auto_minmax(0,1fr)_15rem_auto] @2xl:items-start @2xl:ps-[calc(1.25rem-3px)] @2xl:pe-5"
          :class="isHighlighted(rule) ? 'border-s-primary bg-elevated' : 'border-s-transparent'"
          :aria-current="isHighlighted(rule) ? 'true' : undefined"
          data-testid="rule-row"
        >
          <USwitch
            :model-value="rule.enabled"
            :label="rule.enabled ? words.tab.on : words.tab.off"
            :aria-label="words.tab.switchName(rule.enabled, rule.id)"
            class="pt-0.5"
            @update:model-value="toggleRule(rule)"
          />
          <div :class="{ 'opacity-60': !rule.enabled }">
            <p class="flex flex-wrap items-center gap-2">
              <span class="identifier text-highlighted">{{ rule.id }}</span>
              <UBadge :label="rule.confidence === 'rule' ? words.tab.settles : words.tab.waitsForReview" :color="rule.confidence === 'rule' ? 'neutral' : 'info'" variant="subtle" size="sm" />
            </p>
            <ul class="mt-1.5 flex flex-wrap gap-1.5">
              <li v-for="condition in rule.conditions" :key="condition.column" class="rounded-control bg-elevated px-2 py-px type-caption wrap-anywhere">{{ conditionInWords(condition) }}</li>
            </ul>
            <p v-if="rule.note" class="mt-1.5 type-caption" data-testid="rule-note">{{ rule.note }}</p>
          </div>
          <div class="col-start-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 @2xl:col-start-3 @2xl:flex-col @2xl:items-start" :class="{ 'opacity-60': !rule.enabled }">
            <span class="flex min-w-0 flex-wrap items-center gap-1.5">
              <CategoryChip :category="rule.category" :bucket="bucketBySlug.get(rule.category) ?? UNCLASSIFIED" />
              <UBadge
                v-for="label in rule.labels ?? []"
                :key="label"
                :label="labelNames.get(label) ?? ''"
                icon="i-lucide-tag"
                color="neutral"
                variant="subtle"
                size="sm"
                class="max-w-full"
                data-testid="rule-label"
              />
            </span>
            <p class="figure type-caption">{{ words.tab.decides(decided.get(rule.id) ?? 0, rule.order) }}</p>
          </div>
          <div class="col-start-2 flex justify-end gap-1 @2xl:col-start-4">
            <MoveButtons
              v-if="shownFor === null"
              :up-label="words.tab.earlier(rule.id)"
              :down-label="words.tab.later(rule.id)"
              :first="rule === ordered[0]"
              :last="rule === ordered.at(-1)"
              @up="moveRule(rule, 'earlier')"
              @down="moveRule(rule, 'later')"
            />
            <UButton :label="words.tab.edit" icon="i-lucide-pencil" color="neutral" variant="outline" size="sm" class="self-center" data-testid="edit-rule" @click="editRule(rule)" />
          </div>
        </li>
      </ol>
      <ShowAllButton v-if="shown.length > FIRST_SHOWN" v-model:expanded="allShown" :total="shown.length" class="px-4 pt-3 sm:px-5" />
    </template>
    <p v-else-if="shownFor !== null" class="px-4 pt-3 pb-4 type-aside sm:px-5" data-testid="company-rules-none-for">{{ shownFor.none }}</p>
    <p v-else class="px-4 py-6 type-aside sm:px-5">{{ words.tab.none }}</p>
    <div class="h-2" />

    <RuleEditor v-model:open="editorOpen" :source="editorSource" />
    <RuleChangeDialog v-model:open="dialogOpen" :pending="pending" />
  </AppCard>
</template>
