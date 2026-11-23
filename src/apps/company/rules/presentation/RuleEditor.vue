<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'

import CategoryChip from '../../transactions/presentation/CategoryChip.vue'
import { useDisplayNames } from '../../workbook/application/useDisplayNames'
import { useWorkbook } from '../../workbook/application/workbookStore'
import { UNCLASSIFIED } from '../../workbook/domain/bucket'
import { recordsOf } from '../../../../shared/storage/domain/recordsRead'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import AppDialog from '../../../../shared/ui/AppDialog.vue'
import { waitingRowsSettledBySave, writeRuleSave, writeRulesChange } from '../application/ruleWrites'
import { useRulesChangePreview } from '../application/useRulesChange'
import type { CategoryCount } from '../domain/ruleCoverage'
import { draftChange } from '../domain/ruleDraft'
import type { EditedRule, RuleDraft } from '../domain/ruleDraft'
import type { RulesTabChange } from '../domain/rulesTabChange'
import { rulesChangeInWords } from '../domain/ruleSummary'
import { ruleLabelIdsIn } from '../domain/readRules'
import { useTypedLabels } from '../../labels/presentation/useTypedLabels'
import { storesItems } from '../../workbook/domain/rowItems'
import RuleChangeReview from './RuleChangeReview.vue'
import RuleForm from './RuleForm.vue'
import { words } from './words'
import { plural } from '../../../../shared/text/translation'

export interface RuleEditorSource {
  readonly title: string
  readonly draft: RuleDraft
  /** The rule on the tab this edits, or null for a new one. */
  readonly edited: EditedRule | null
  /** How a person filed the rows the rule is made from, when they used more than one category. */
  readonly split?: readonly CategoryCount[]
}

/**
 * Adds, edits or deletes one rule with its back-test beside the form, live. A save files the rows still
 * waiting for review that the rule settles in the same write, with the rule's labels and the labels typed into the form, so one
 * Undo takes back all of it.
 */
const props = defineProps<{
  source: RuleEditorSource | null
}>()

const open = defineModel<boolean>('open', { required: true })

const SAVE_RULE_KEY = 'save-rule'
const DELETE_RULE_KEY = 'delete-rule'

const store = useWorkbook()
const { state } = store
const names = useDisplayNames()
const recordWrites = useRecordWrites(store)

const draft = ref<RuleDraft | null>(props.source?.draft ?? null)
const accepted = ref(false)
const deleting = ref(false)
const typed = useTypedLabels()

watch(
  () => props.source,
  (source) => {
    draft.value = source?.draft ?? null
    accepted.value = false
    deleting.value = false
    typed.forget()
  },
)

/** The labels the form offers, the books' and those typed into it, or null on books from before items, which keep none. */
const labelChoices = computed(() => (state.records !== null && storesItems(state.records) ? typed.choices.value : null))
const ruleLabels = computed(() => ruleLabelIdsIn(labelChoices.value ?? [], labelChoices.value !== null))

function createLabel(name: string): void {
  if (draft.value !== null) draft.value = { ...draft.value, labels: typed.withTyped(draft.value.labels, name) }
}

const change = computed((): RulesTabChange | null => {
  const workbook = state.workbook
  const records = state.records
  const edited = props.source?.edited ?? null
  if (draft.value === null || workbook === null || records === null) return null
  if (deleting.value && edited !== null) return { appended: null, edited: [], removed: edited.expected }
  return draftChange(draft.value, workbook.rules, recordsOf(records.rules), edited)
})

const preview = useRulesChangePreview(
  () => (open.value ? change.value : null),
  () => labelChoices.value ?? [],
)

watch(change, () => {
  accepted.value = false
})

const needsAcceptance = computed(() => (preview.value?.backtest.brokenAgreements.length ?? 0) + (preview.value?.backtest.humanConflicts.length ?? 0) > 0)
const canSave = computed(() => preview.value !== null && preview.value.refusals.length === 0 && (!needsAcceptance.value || accepted.value))

/** The rows still waiting that the rule settles, which its save files. None while deleting, or for a rule that only flags rows for review. */
const waiting = computed(() => {
  const workbook = state.workbook
  const records = state.records
  const pending = change.value
  if (deleting.value || draft.value === null || workbook === null || records === null || pending === null) return []
  return waitingRowsSettledBySave(workbook, records.rules, pending, draft.value.id.trim(), ruleLabels.value)
})

async function save(): Promise<void> {
  const pending = change.value
  const workbook = state.workbook
  const records = state.records
  if (pending === null || draft.value === null || workbook === null || records === null || !canSave.value) return
  const settledBy = draft.value.id.trim()
  const filed = waiting.value.length
  const carried = new Set(draft.value.labels)
  const labels = ruleLabels.value
  const work = (unit: Parameters<typeof writeRuleSave>[0]) => {
    typed.addCarried(unit, carried)
    writeRuleSave(unit, workbook, records, pending, settledBy, labels)
  }
  const written = await recordWrites.write(rulesChangeInWords(pending), work, {
    key: SAVE_RULE_KEY,
    failedTitle: words.editor.notSaved,
    ...(filed === 0 ? {} : { description: plural(words.editor.filedBy(filed, settledBy), filed) }),
  })
  if (written) open.value = false
}

async function deleteRule(): Promise<void> {
  const pending = change.value
  const edited = props.source?.edited ?? null
  if (pending === null || edited === null || !canSave.value) return
  if (await recordWrites.write(rulesChangeInWords(pending), (unit) => writeRulesChange(unit, pending), { key: DELETE_RULE_KEY, failedTitle: words.editor.notDeleted })) open.value = false
}

const split = computed(() => (props.source?.split !== undefined && props.source.split.length > 1 ? props.source.split : null))
const splitRows = computed(() => split.value?.reduce((total, entry) => total + entry.count, 0) ?? 0)
const bucketBySlug = computed(() => new Map((state.workbook?.categories ?? []).map((category) => [category.slug, category.bucket])))
</script>

<template>
  <AppDialog
    v-model:open="open"
    changes
    width="3xl"
    :title="deleting && source?.edited ? words.editor.deleteTitle(source.edited.id) : (source?.title ?? words.editor.rule)"
    :description="deleting ? words.editor.deleteDescription : words.editor.formDescription"
  >
    <div v-if="deleting" class="flex flex-col gap-4" data-testid="rule-delete">
      <p class="type-body">{{ words.editor.leavesTab }}</p>
      <RuleChangeReview v-if="preview" v-model:accepted="accepted" :preview="preview" :labels="labelChoices ?? []" />
    </div>
    <div v-else-if="draft" class="flex flex-col gap-6" data-testid="rule-editor">
      <UAlert v-if="split" icon="i-lucide-split" color="warning" variant="subtle" :title="words.editor.splitTitle(splitRows, split.length)" data-testid="rule-split">
        <template #description>
          <ul class="mt-1 flex flex-wrap gap-1.5">
            <li v-for="entry in split" :key="entry.category" class="flex items-center gap-1">
              <CategoryChip :category="entry.category" :bucket="bucketBySlug.get(entry.category) ?? UNCLASSIFIED" />
              <span class="figure type-caption">{{ entry.count }}</span>
            </li>
          </ul>
          <p class="mt-2">{{ words.editor.startsOn(names.category(split[0]!.category)) }}</p>
        </template>
      </UAlert>
      <RuleForm
        v-model="draft"
        :rules="state.workbook?.rules ?? []"
        :categories="state.workbook?.categories ?? []"
        :labels="labelChoices"
        :label-refused="typed.refused.value"
        :editing-id="source?.edited?.id ?? null"
        @create-label="createLabel"
      />
      <section class="flex flex-col gap-3 border-t border-default pt-5">
        <header>
          <h2 class="type-card-title">{{ words.editor.backtest }}</h2>
          <p class="mt-0.5 type-caption">{{ words.editor.backtestHelp }}</p>
        </header>
        <RuleChangeReview v-if="preview" v-model:accepted="accepted" :preview="preview" :labels="labelChoices ?? []" />
        <UAlert v-if="waiting.length" icon="i-lucide-inbox" color="info" variant="subtle" :description="words.editor.filedOnSave" data-testid="rule-files-waiting" />
      </section>
    </div>

    <template v-if="!deleting && source?.edited" #start>
      <UButton :label="words.editor.delete" icon="i-lucide-trash-2" color="error" variant="ghost" data-testid="delete-rule" @click="deleting = true" />
    </template>
    <template #end>
      <template v-if="deleting">
        <UButton :label="words.editor.keep" color="neutral" variant="ghost" data-testid="keep-rule" @click="deleting = false" />
        <UButton
          :label="words.editor.deleteRule"
          icon="i-lucide-trash-2"
          color="error"
          :loading="recordWrites.saving(DELETE_RULE_KEY)"
          :disabled="!canSave"
          data-testid="confirm-delete-rule"
          @click="deleteRule"
        />
      </template>
      <template v-else>
        <UButton :label="words.editor.cancel" color="neutral" variant="ghost" @click="open = false" />
        <UButton
          :label="source?.edited ? words.editor.save : words.editor.add"
          icon="i-lucide-save"
          :loading="recordWrites.saving(SAVE_RULE_KEY)"
          :disabled="!canSave || recordWrites.refused.value"
          data-testid="save-rule"
          @click="save"
        />
      </template>
    </template>
  </AppDialog>
</template>
