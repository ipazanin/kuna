<script setup lang="ts">
import { computed } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import USelect from '@nuxt/ui/components/Select.vue'
import USwitch from '@nuxt/ui/components/Switch.vue'
import UTextarea from '@nuxt/ui/components/Textarea.vue'

import CategoryPicker from '../../transactions/presentation/CategoryPicker.vue'
import type { Category } from '../../workbook/domain/workbook'
import { inTryingOrder } from '../domain/rule'
import type { Rule, RuleConfidence } from '../domain/rule'
import { DRAFT_CONDITION_COLUMNS, FLAG_COLUMNS } from '../domain/ruleDraft'
import type { ConditionColumn, DraftCondition, RuleDraft } from '../domain/ruleDraft'
import { CONDITION_LABELS } from '../domain/ruleSummary'

/** One rules row as a form: its conditions from the tab's columns, what it files, and where it is tried. */
const props = defineProps<{
  rules: readonly Rule[]
  categories: readonly Category[]
  /** The id the rule has on the tab now, when an existing rule is edited. */
  editingId: string | null
}>()

const draft = defineModel<RuleDraft>({ required: true })

/** USelect needs a value for "after every rule" that is not blank. Ids are trimmed, so none starts with a space. */
const LAST = ' last'

function update<Field extends keyof RuleDraft>(field: Field, value: RuleDraft[Field]): void {
  draft.value = { ...draft.value, [field]: value }
}

function labelOf(column: ConditionColumn): string {
  return column === 'counterparty_is_client' ? 'Counterparty is a client' : CONDITION_LABELS[column]
}

const unusedColumns = computed(() =>
  DRAFT_CONDITION_COLUMNS.filter((column) => !draft.value.conditions.some((condition) => condition.column === column)).map((column) => ({ value: column, label: labelOf(column) })),
)

function addCondition(column: ConditionColumn): void {
  const value: DraftCondition['value'] = FLAG_COLUMNS.has(column) || column === 'has_counterparty_iban' ? true : column === 'direction' ? 'debit' : ''
  update('conditions', [...draft.value.conditions, { column, value }])
}

function setCondition(index: number, value: DraftCondition['value']): void {
  update(
    'conditions',
    draft.value.conditions.map((condition, position) => (position === index ? { ...condition, value } : condition)),
  )
}

function removeCondition(index: number): void {
  update(
    'conditions',
    draft.value.conditions.filter((_, position) => position !== index),
  )
}

const directionItems = [
  { value: 'debit', label: 'Money out' },
  { value: 'credit', label: 'Money in' },
]

const presenceItems = [
  { value: 'TRUE', label: 'The row has one' },
  { value: 'FALSE', label: 'The row has none' },
]

const confidenceItems: { value: RuleConfidence; label: string }[] = [
  { value: 'rule', label: 'Settled' },
  { value: 'review', label: 'Waits for review' },
]

const placementItems = computed(() => [
  ...inTryingOrder(props.rules)
    .filter((rule) => rule.id !== props.editingId)
    .map((rule) => ({ value: rule.id, label: `Before ${rule.id}` })),
  { value: LAST, label: 'After every rule' },
])

function presenceOf(value: DraftCondition['value']): string {
  return String(value).toUpperCase() === 'FALSE' ? 'FALSE' : 'TRUE'
}
</script>

<template>
  <div class="flex flex-col gap-5" data-testid="rule-form">
    <div class="grid gap-4 sm:grid-cols-2">
      <UFormField label="Rule id" help="A short name, used once, such as merchant-telecom.">
        <UInput :model-value="draft.id" class="identifier w-full" aria-label="Rule id" @update:model-value="update('id', String($event))" />
      </UFormField>
      <UFormField label="Tried" help="Rules are tried from the top, and the first one whose conditions all hold decides the row.">
        <USelect
          :model-value="draft.before ?? LAST"
          :items="placementItems"
          class="w-full"
          aria-label="Tried before"
          data-testid="rule-placement"
          @update:model-value="update('before', $event === LAST ? null : String($event))"
        />
      </UFormField>
    </div>

    <fieldset class="flex flex-col gap-3">
      <legend class="text-sm font-medium text-highlighted">Conditions</legend>
      <p class="-mt-1 text-xs text-muted">Every condition must hold. Text is compared without accents or case.</p>
      <ul v-if="draft.conditions.length" class="flex flex-col gap-2">
        <li v-for="(condition, index) in draft.conditions" :key="condition.column" class="condition-row" data-testid="rule-condition">
          <span class="text-sm text-toned">{{ labelOf(condition.column) }}</span>
          <USelect
            v-if="condition.column === 'direction'"
            :model-value="String(condition.value).toLowerCase()"
            :items="directionItems"
            class="w-full sm:w-48"
            :aria-label="labelOf(condition.column)"
            @update:model-value="setCondition(index, String($event))"
          />
          <USelect
            v-else-if="condition.column === 'has_counterparty_iban'"
            :model-value="presenceOf(condition.value)"
            :items="presenceItems"
            class="w-full sm:w-48"
            :aria-label="labelOf(condition.column)"
            @update:model-value="setCondition(index, $event === 'TRUE')"
          />
          <span v-else-if="FLAG_COLUMNS.has(condition.column)" class="text-xs text-muted">holds</span>
          <UInput
            v-else
            :model-value="String(condition.value)"
            class="identifier w-full sm:w-64"
            :aria-label="labelOf(condition.column)"
            @update:model-value="setCondition(index, String($event))"
          />
          <UButton icon="i-lucide-x" color="neutral" variant="ghost" size="sm" :aria-label="`Remove ${labelOf(condition.column)}`" @click="removeCondition(index)" />
        </li>
      </ul>
      <p v-else class="text-xs text-dimmed">No condition yet. An enabled rule needs at least one.</p>
      <USelect
        v-if="unusedColumns.length"
        :key="draft.conditions.length"
        :items="unusedColumns"
        placeholder="Add a condition"
        icon="i-lucide-plus"
        color="neutral"
        variant="outline"
        class="w-full sm:w-64"
        aria-label="Add a condition"
        data-testid="add-condition"
        @update:model-value="$event && addCondition($event as ConditionColumn)"
      />
    </fieldset>

    <div class="grid gap-4 sm:grid-cols-2">
      <UFormField label="Files the row as">
        <CategoryPicker
          :model-value="draft.category"
          :categories="categories"
          :allow-none="draft.confidence === 'review'"
          class="w-full"
          data-testid="rule-category"
          @update:model-value="update('category', $event ?? '')"
        />
      </UFormField>
      <UFormField label="Confidence" :help="draft.confidence === 'rule' ? 'Files the row as rule, settled.' : 'Files it as ai, so it shows on Review.'">
        <USelect
          :model-value="draft.confidence"
          :items="confidenceItems"
          class="w-full"
          aria-label="Confidence"
          @update:model-value="update('confidence', $event as RuleConfidence)"
        />
      </UFormField>
    </div>

    <UFormField label="Note" help="Why the rule exists and why it sits where it does.">
      <UTextarea :model-value="draft.note" :rows="2" autoresize class="w-full" aria-label="Note" @update:model-value="update('note', String($event))" />
    </UFormField>

    <USwitch :model-value="draft.enabled" label="Enabled" description="A rule that is off stays on the tab and is never tried." @update:model-value="update('enabled', $event)" />
  </div>
</template>

<style scoped>
.condition-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.5rem 0.75rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-control);
  background: var(--surface-elevated);
}

.condition-row > :nth-child(2) {
  grid-column: 1;
}

.condition-row > :last-child {
  grid-column: 2;
  grid-row: 1 / span 2;
}

@media (min-width: 640px) {
  .condition-row {
    grid-template-columns: 14rem minmax(0, 1fr) auto;
  }

  .condition-row > :nth-child(2) {
    grid-column: 2;
  }

  .condition-row > :last-child {
    grid-column: 3;
    grid-row: 1;
  }
}
</style>
