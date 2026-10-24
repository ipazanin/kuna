<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'
import UModal from '@nuxt/ui/components/Modal.vue'
import { useToast } from '@nuxt/ui/composables/useToast'

import { REDIRECT_SIGN_IN_QUERY } from '../../../shared/google/googleRedirect'
import { useMediaQuery, usePhoneLayout } from '../../../shared/layout/viewport'
import { useWorkbook } from '../../workbook/application/workbookStore'
import { useKeepOnDrive } from '../../workbook/presentation/useKeepOnDrive'
import { previewImport } from '../../workbook/presentation/workbookFiles'
import type { ImportPreview } from '../../workbook/presentation/workbookFiles'
import ProblemList from './ProblemList.vue'

/** The file to open. Setting it opens the dialog, and the dialog sets it back to null when it closes. */
const file = defineModel<File | null>('file', { required: true })

const emit = defineEmits<{
  imported: []
}>()

const store = useWorkbook()
const toast = useToast()
// Full screen on a phone, so the choices sit at the bottom under the thumb.
const phone = usePhoneLayout()
const signInByRedirect = useMediaQuery(REDIRECT_SIGN_IN_QUERY)
const { keeping, keepOnDrive } = useKeepOnDrive()

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

const replacesLocal = computed(() => store.state.choice?.source === 'browser')
const keepable = computed(() => preview.value !== null && preview.value.summary.refusal === null && !importing.value && !keeping.value)

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

async function keepInBrowser(): Promise<void> {
  const chosen = preview.value
  if (chosen === null || chosen.summary.refusal !== null) return
  importing.value = true
  await store.replaceLocalWorkbook(chosen.document, chosen.title)
  importing.value = false
  if (store.state.status === 'error') {
    failure.value = store.state.error
    return
  }
  toast.add({ title: 'Kept in this browser', description: `${chosen.summary.transactionCount} transactions from ${chosen.fileName}`, icon: 'i-lucide-check', color: 'success' })
  file.value = null
  emit('imported')
}

async function keepOnGoogleDrive(): Promise<void> {
  const chosen = preview.value
  if (chosen === null || chosen.summary.refusal !== null) return
  if (await keepOnDrive(chosen.document)) {
    file.value = null
    emit('imported')
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="file ? `Open ${file.name}` : 'Open a file'"
    description="Check what the file holds, then choose where to keep it. Nothing changes until you choose."
    :fullscreen="phone"
    :dismissible="!keeping && !importing"
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
            description="Open an Excel download of the Google Sheet, a file the app exported, or a ledgerboard file from the backups folder."
          />
          <template v-else>
            <dl class="grid gap-px sm:grid-cols-2 overflow-hidden rounded-control border border-default bg-[var(--border-default)]">
              <div v-for="fact in facts" :key="fact.label" class="min-w-0 bg-raised px-3 py-2.5">
                <dt class="text-xs text-muted">{{ fact.label }}</dt>
                <dd class="figure mt-0.5 truncate text-sm font-medium text-highlighted" :title="fact.value">{{ fact.value }}</dd>
              </div>
            </dl>

            <section class="flex flex-col gap-2" data-testid="record-counts">
              <h3 class="text-sm font-medium text-highlighted">{{ preview.recordCount }} {{ preview.recordCount === 1 ? 'record' : 'records' }}, by tab</h3>
              <dl class="record-counts text-sm">
                <div v-for="kind in preview.counts" :key="kind.name" class="flex min-w-0 items-baseline justify-between gap-3">
                  <dt class="truncate text-toned">{{ kind.name }}</dt>
                  <dd class="figure text-highlighted">{{ kind.count }}</dd>
                </div>
              </dl>
            </section>

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

            <p v-if="signInByRedirect" class="text-xs text-muted" data-testid="redirect-sign-in-note">
              Google may ask you to sign in first and bring you back here. Open the file again then.
            </p>
          </template>
        </template>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full flex-wrap justify-end gap-2">
        <UButton label="Cancel" color="neutral" variant="ghost" @click="open = false" />
        <UButton
          icon="i-lucide-monitor-smartphone"
          label="Keep in this browser"
          color="neutral"
          variant="outline"
          :loading="importing"
          :disabled="!keepable"
          @click="keepInBrowser"
        />
        <UButton icon="i-lucide-hard-drive-upload" label="Keep on Google Drive" :loading="keeping" :disabled="!keepable" @click="keepOnGoogleDrive" />
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.record-counts {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
  gap: 0.25rem 1.5rem;
}
</style>
