<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'
import UModal from '@nuxt/ui/components/Modal.vue'
import { useToast } from '@nuxt/ui/composables/useToast'

import { usePhoneLayout } from '../../../shared/layout/viewport'
import { useWorkbook } from '../../workbook/application/workbookStore'
import { previewImport } from '../application/workbookFiles'
import type { ImportPreview } from '../application/workbookFiles'
import ProblemList from './ProblemList.vue'

/** The file to import. Setting it opens the dialog, and the dialog sets it back to null when it closes. */
const file = defineModel<File | null>('file', { required: true })

const emit = defineEmits<{
  imported: []
}>()

const store = useWorkbook()
const toast = useToast()
// Full screen on a phone, so Import sits at the bottom under the thumb.
const phone = usePhoneLayout()

const dayFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

/** "settings, rules or clients". */
function inWords(tabs: readonly string[]): string {
  return tabs.length <= 1 ? (tabs[0] ?? '') : `${tabs.slice(0, -1).join(', ')} or ${tabs[tabs.length - 1]}`
}

// Shallow, so the tabs stay plain objects. IndexedDB cannot store a reactive proxy.
const preview = shallowRef<ImportPreview | null>(null)
const failure = ref<string | null>(null)
// The underlying error of a file that could not be read, shown under the message. Empty shows nothing.
const failureDetail = ref('')
const importing = ref(false)

watch(
  file,
  async (chosen) => {
    preview.value = null
    failure.value = null
    failureDetail.value = ''
    if (chosen === null) return
    try {
      const read = await previewImport(chosen)
      if (file.value === chosen) preview.value = read
    } catch (problem) {
      if (file.value !== chosen) return
      failure.value = problem instanceof Error ? problem.message : String(problem)
      const cause = problem instanceof Error ? problem.cause : undefined
      failureDetail.value = cause instanceof Error ? `${cause.name}: ${cause.message}` : cause === undefined ? '' : String(cause)
    }
  },
  { immediate: true },
)

const open = computed({
  get: () => file.value !== null,
  set: (opened: boolean) => {
    if (!opened) file.value = null
  },
})

const replacesLocal = computed(() => store.state.choice?.source === 'excel')

const facts = computed(() => {
  const summary = preview.value?.summary
  if (summary === undefined) return []
  const range = summary.dateRange
  return [
    { label: 'Transactions', value: String(summary.transactionCount) },
    { label: 'Dates', value: range === null ? 'None yet' : `${dayFormat.format(new Date(range.from))} to ${dayFormat.format(new Date(range.to))}` },
    { label: summary.accounts.length === 1 ? 'Account' : 'Accounts', value: summary.accounts.length === 0 ? 'None yet' : summary.accounts.join(', ') },
    { label: 'Categories', value: String(summary.categoryCount) },
  ]
})

async function confirmImport(): Promise<void> {
  const chosen = preview.value
  if (chosen === null || chosen.summary.refusal !== null) return
  importing.value = true
  await store.replaceLocalWorkbook(chosen.tabs, chosen.title)
  importing.value = false
  if (store.state.status === 'error') {
    failure.value = store.state.error
    return
  }
  toast.add({ title: 'Imported', description: `${chosen.summary.transactionCount} transactions from ${chosen.fileName}`, icon: 'i-lucide-check', color: 'success' })
  file.value = null
  emit('imported')
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="file ? `Import ${file.name}` : 'Import'"
    description="Check what the file holds. Nothing changes until you import it."
    :fullscreen="phone"
    :ui="{ content: 'sm:max-w-xl', header: 'pe-16 sm:pe-6', footer: 'pb-[max(1rem,env(safe-area-inset-bottom))]' }"
  >
    <template #body>
      <div data-testid="import-summary" class="flex flex-col gap-4">
        <p v-if="!preview && !failure" class="flex items-center gap-2 text-sm text-muted">
          <UIcon name="i-lucide-loader-circle" class="size-4 animate-spin" aria-hidden="true" />
          Reading the file
        </p>

        <UAlert
          v-if="failure"
          data-testid="import-failure"
          icon="i-lucide-triangle-alert"
          color="error"
          variant="subtle"
          :title="failure"
          :description="failureDetail"
          :ui="{ description: 'figure break-words text-xs' }"
        />

        <template v-if="preview">
          <UAlert
            v-if="preview.summary.refusal"
            icon="i-lucide-file-x"
            color="error"
            variant="subtle"
            :title="preview.summary.refusal"
            description="Start from the template: it has the tabs and columns the app reads."
          />
          <template v-else>
            <dl class="grid gap-px sm:grid-cols-2 overflow-hidden rounded-control border border-default bg-[var(--border-default)]">
              <div v-for="fact in facts" :key="fact.label" class="min-w-0 bg-raised px-3 py-2.5">
                <dt class="text-xs text-muted">{{ fact.label }}</dt>
                <dd class="figure mt-0.5 truncate text-sm font-medium text-highlighted" :title="fact.value">{{ fact.value }}</dd>
              </div>
            </dl>

            <p v-if="preview.summary.defaultedTabs.length" class="text-sm text-muted">
              No {{ inWords(preview.summary.defaultedTabs) }} tab, so {{ preview.summary.defaultedTabs.length === 1 ? 'it reads' : 'they read' }} as
              empty and the defaults apply.
            </p>

            <section v-if="preview.summary.problems.length" class="flex flex-col gap-2">
              <h3 class="text-sm font-medium text-highlighted">
                {{ preview.summary.problems.length }} {{ preview.summary.problems.length === 1 ? 'row' : 'rows' }} the app could not use as written
              </h3>
              <ProblemList :problems="preview.summary.problems" />
            </section>
            <p v-else class="flex items-center gap-2 text-sm text-toned">
              <UIcon name="i-lucide-check" class="size-4 text-positive" aria-hidden="true" />
              Every row reads cleanly.
            </p>

            <UAlert
              v-if="replacesLocal"
              icon="i-lucide-replace"
              color="warning"
              variant="subtle"
              title="This replaces the workbook kept in this browser"
              description="Changes you made here since your last export are lost. Export first if you want to keep them."
            />
          </template>
        </template>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full flex-wrap justify-end gap-2">
        <UButton label="Cancel" color="neutral" variant="ghost" @click="open = false" />
        <UButton
          icon="i-lucide-file-input"
          label="Import"
          :loading="importing"
          :disabled="!preview || preview.summary.refusal !== null || importing"
          @click="confirmImport"
        />
      </div>
    </template>
  </UModal>
</template>
