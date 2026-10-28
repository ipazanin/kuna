<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UModal from '@nuxt/ui/components/Modal.vue'
import { useToast } from '@nuxt/ui/composables/useToast'

import { usePhoneLayout } from '../../../../shared/layout/viewport'
import { fileRows } from '../../review/application/fileRows'
import { waitingRowsSettledBy } from '../../review/domain/verdictChanges'
import CategoryChip from '../../transactions/presentation/CategoryChip.vue'
import type { WriteReceipt } from '../../../../shared/storage/application/recordWrites'
import { useDisplayNames } from '../../workbook/application/useDisplayNames'
import { useWorkbook } from '../../workbook/application/workbookStore'
import { UNCLASSIFIED } from '../../workbook/domain/bucket'
import { NO_RECORDS, recordsOf } from '../../../../shared/storage/domain/recordsRead'
import { useRecordWrites } from '../../workbook/presentation/useRecordWrites'
import { writeRulesChange } from '../application/ruleWrites'
import { useRulesChangePreview } from '../application/useRulesChange'
import type { CategoryCount } from '../domain/ruleCoverage'
import { draftChange } from '../domain/ruleDraft'
import type { EditedRule, RuleDraft } from '../domain/ruleDraft'
import type { RulesTabChange } from '../domain/rulesTabChange'
import { rulesChangeInWords } from '../domain/ruleSummary'
import { categorisationContextOf } from '../domain/transactionFacts'
import RuleChangeReview from './RuleChangeReview.vue'
import RuleForm from './RuleForm.vue'

export interface RuleEditorSource {
  readonly title: string
  readonly draft: RuleDraft
  /** The rule on the tab this edits, or null for a new one. */
  readonly edited: EditedRule | null
  /** How a person filed the rows the rule is made from, when they used more than one category. */
  readonly split?: readonly CategoryCount[]
}

/**
 * Adds, edits or deletes one rule with its back-test beside the form, live. Once saved it offers to
 * file the rows still waiting for review that the rule settles, and the save's toast with Undo shows
 * when the editor closes, so it never covers the editor's buttons on a phone.
 */
const props = defineProps<{
  source: RuleEditorSource | null
}>()

const open = defineModel<boolean>('open', { required: true })

const store = useWorkbook()
const { state } = store
const phone = usePhoneLayout()
const names = useDisplayNames()
const toast = useToast()
const recordWrites = useRecordWrites()

const draft = ref<RuleDraft | null>(props.source?.draft ?? null)
const accepted = ref(false)
const savedId = ref<string | null>(null)
const savedReceipt = shallowRef<WriteReceipt | null>(null)
const deleting = ref(false)

watch(
  () => props.source,
  (source) => {
    draft.value = source?.draft ?? null
    accepted.value = false
    savedId.value = null
    deleting.value = false
  },
)

watch(open, (isOpen) => {
  if (isOpen || savedReceipt.value === null) return
  recordWrites.announce(savedReceipt.value)
  savedReceipt.value = null
})

const change = computed((): RulesTabChange | null => {
  const workbook = state.workbook
  const records = state.records
  const edited = props.source?.edited ?? null
  if (draft.value === null || workbook === null || records === null) return null
  if (deleting.value && edited !== null) return { appended: null, edited: [], removed: edited.expected }
  return draftChange(draft.value, workbook.rules, recordsOf(records.rules), edited)
})

const preview = useRulesChangePreview(() => (open.value && savedId.value === null ? change.value : null))

watch(change, () => {
  accepted.value = false
})

const needsAcceptance = computed(() => (preview.value?.backtest.brokenAgreements.length ?? 0) + (preview.value?.backtest.humanConflicts.length ?? 0) > 0)
const canSave = computed(
  () =>
    preview.value !== null &&
    preview.value.refusals.length === 0 &&
    (!needsAcceptance.value || accepted.value) &&
    !state.writing,
)

function notWritten(title: string, failure: unknown): void {
  toast.add({ title, description: failure instanceof Error ? failure.message : String(failure), icon: 'i-lucide-triangle-alert', color: 'error', duration: 10_000 })
}

async function save(): Promise<void> {
  const pending = change.value
  if (pending === null || draft.value === null || !canSave.value) return
  const id = draft.value.id.trim()
  try {
    savedReceipt.value = await store.write(rulesChangeInWords(pending), (unit) => writeRulesChange(unit, pending))
    savedId.value = id
  } catch (failure) {
    notWritten('Not saved', failure)
  }
}

async function deleteRule(): Promise<void> {
  const pending = change.value
  const edited = props.source?.edited ?? null
  if (pending === null || edited === null || !canSave.value) return
  if (await recordWrites.write(rulesChangeInWords(pending), (unit) => writeRulesChange(unit, pending), { failedTitle: 'Not deleted' })) open.value = false
}

const waiting = computed(() => {
  const workbook = state.workbook
  if (savedId.value === null || workbook === null) return []
  return waitingRowsSettledBy(savedId.value, workbook.transactions, workbook.rules, categorisationContextOf(workbook))
})

const split = computed(() => (props.source?.split !== undefined && props.source.split.length > 1 ? props.source.split : null))
const splitRows = computed(() => split.value?.reduce((total, entry) => total + entry.count, 0) ?? 0)
const bucketBySlug = computed(() => new Map((state.workbook?.categories ?? []).map((category) => [category.slug, category.bucket])))

const onDrive = computed(() => state.workbook?.source === 'drive')

async function applyToWaiting(): Promise<void> {
  const count = waiting.value.length
  const verdicts = waiting.value
  const written = await recordWrites.write(`Filed ${count} ${count === 1 ? 'row' : 'rows'} by ${savedId.value}`, (unit) => fileRows(unit, state.records?.ledger ?? NO_RECORDS, verdicts, state.workbook?.categories ?? []), {
    failedTitle: 'Not written',
    description: 'Only rows that were waiting for review. Confirmed rows kept their category.',
  })
  if (written) open.value = false
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="savedId ? `Saved ${savedId}` : deleting && source?.edited ? `Delete ${source.edited.id}` : (source?.title ?? 'Rule')"
    v-bind="savedId ? {} : { description: deleting ? 'The back-test below lists the rows it decides today.' : 'The back-test below follows every change to the form.' }"
    :fullscreen="phone"
    :ui="{ content: 'sm:max-w-3xl', header: 'pe-16 sm:pe-6', footer: 'pb-[max(1rem,env(safe-area-inset-bottom))]' }"
  >
    <template #body>
      <div v-if="savedId === null && deleting" class="flex flex-col gap-4" data-testid="rule-delete">
        <p class="text-sm text-toned">
          Its row leaves the rules tab. Rows already filed keep their category, and new rows it would decide go to the next rule that holds, or
          wait for review.
        </p>
        <RuleChangeReview v-if="preview" v-model:accepted="accepted" :preview="preview" />
      </div>
      <div v-else-if="savedId === null && draft" class="flex flex-col gap-6" data-testid="rule-editor">
        <UAlert
          v-if="split"
          icon="i-lucide-split"
          color="warning"
          variant="subtle"
          :title="`A person filed these ${splitRows} rows in ${split.length} categories`"
          data-testid="rule-split"
        >
          <template #description>
            <ul class="mt-1 flex flex-wrap gap-1.5">
              <li v-for="entry in split" :key="entry.category" class="flex items-center gap-1">
                <CategoryChip :category="entry.category" :bucket="bucketBySlug.get(entry.category) ?? UNCLASSIFIED" />
                <span class="figure text-xs">{{ entry.count }}</span>
              </li>
            </ul>
            <p class="mt-2">
              The form starts on {{ names.category(split[0]!.category) }}, the most common. One rule files every next row the same way, so the
              back-test lists the others as confirmed rows it would file differently.
            </p>
          </template>
        </UAlert>
        <RuleForm v-model="draft" :rules="state.workbook?.rules ?? []" :categories="state.workbook?.categories ?? []" :editing-id="source?.edited?.id ?? null" />
        <section class="flex flex-col gap-3 border-t border-default pt-5">
          <header>
            <h2 class="text-sm font-medium text-highlighted">Back-test over the whole ledger</h2>
            <p class="mt-0.5 text-xs text-muted">Every row, filed by the rules as they are and as they would be.</p>
          </header>
          <RuleChangeReview v-if="preview" v-model:accepted="accepted" :preview="preview" />
        </section>
      </div>
      <div v-else class="flex flex-col gap-4" data-testid="rule-saved">
        <p class="text-sm text-toned">
          {{
            onDrive
              ? 'It is in the file on Drive now, and the next sync or import files new rows by it.'
              : 'It is in the workbook kept in this browser, and an export writes it into the file.'
          }}
        </p>
        <UAlert
          v-if="waiting.length"
          icon="i-lucide-inbox"
          color="info"
          variant="subtle"
          :title="`${waiting.length} ${waiting.length === 1 ? 'row waits' : 'rows wait'} for review that this rule settles`"
          description="Applying files them as the rule says, with flagged_by rule. Rows a person confirmed are left alone."
        />
        <p v-else class="text-sm text-muted">No row waiting for review is settled by it.</p>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full flex-wrap justify-end gap-2">
        <template v-if="savedId === null && deleting">
          <UButton label="Keep it" color="neutral" variant="ghost" data-testid="keep-rule" @click="deleting = false" />
          <UButton
            label="Delete rule"
            icon="i-lucide-trash-2"
            color="error"
            :loading="state.writing"
            :disabled="!canSave"
            data-testid="confirm-delete-rule"
            @click="deleteRule"
          />
        </template>
        <template v-else-if="savedId === null">
          <UButton
            v-if="source?.edited"
            label="Delete"
            icon="i-lucide-trash-2"
            color="error"
            variant="ghost"
            class="me-auto"
            :disabled="state.writing"
            data-testid="delete-rule"
            @click="deleting = true"
          />
          <UButton label="Cancel" color="neutral" variant="ghost" @click="open = false" />
          <UButton
            :label="source?.edited ? 'Save rule' : 'Add rule'"
            icon="i-lucide-save"
            :loading="state.writing"
            :disabled="!canSave"
            data-testid="save-rule"
            @click="save"
          />
        </template>
        <template v-else>
          <UButton label="Done" color="neutral" :variant="waiting.length ? 'ghost' : 'solid'" @click="open = false" />
          <UButton
            v-if="waiting.length"
            :label="`Apply to the ${waiting.length} ${waiting.length === 1 ? 'row' : 'rows'} still waiting`"
            icon="i-lucide-check-check"
            :loading="recordWrites.busy.value"
            :disabled="state.writing"
            data-testid="apply-rule"
            @click="applyToWaiting"
          />
        </template>
      </div>
    </template>
  </UModal>
</template>
