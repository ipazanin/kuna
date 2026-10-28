<script setup lang="ts">
import { computed, onBeforeUnmount, toRef, watch } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import UModal from '@nuxt/ui/components/Modal.vue'
import USelect from '@nuxt/ui/components/Select.vue'
import USwitch from '@nuxt/ui/components/Switch.vue'

import { usePhoneLayout } from '../../../../shared/layout/viewport'
import MoneyText from '../../../../shared/ui/MoneyText.vue'
import DrillLink from '../../../../shared/ui/DrillLink.vue'
import { useWorkbook } from '../../workbook/application/workbookStore'
import { pathInWords } from '../domain/invoiceFiling'
import InvoiceLinesEditor from './InvoiceLinesEditor.vue'
import { TERMS_LINK } from './invoicingLinks'
import { useInvoiceRun } from './useInvoiceRun'
import type { InvoiceRunMode } from './useInvoiceRun'

const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  mode: InvoiceRunMode
}>()

const store = useWorkbook()
const phone = usePhoneLayout()
const run = useInvoiceRun(toRef(props, 'mode'))
const { stage, steps } = run

watch(open, (opening) => {
  if (opening) run.reset()
})
onBeforeUnmount(run.dispose)

const reexport = computed(() => props.mode.kind === 'reexport')
const clientItems = computed(() => (store.state.workbook?.clients ?? []).map((client) => ({ label: client.name || client.slug, value: client.slug })))
const editable = computed(() => stage.value.kind === 'edit')
const busy = computed(() => stage.value.kind === 'checking' || stage.value.kind === 'running')

const title = computed(() => (reexport.value ? `Re-export invoice ${run.number.value}` : 'Make an invoice'))
const description = computed(() =>
  reexport.value
    ? 'Draws the PDF again, replaces it in Drive and saves a fresh mail draft. The register row changes only where the lines do.'
    : 'Draws the PDF, files it, saves the mail draft and adds the invoice to the register, in that order, once the checks pass.',
)

const where = computed(() => {
  const path = run.path.value
  if (path === null) return ''
  return run.google.value ? `Filed as ${pathInWords(path)} in the invoice folder.` : `Saved as ${path.fileName} by the browser, since this workbook has no Drive.`
})

const STEP_LABELS = {
  file: 'File the PDF in Drive',
  download: 'Save the PDF',
  draft: 'Save the mail draft',
  register: 'Write the register row',
} as const

const STEP_ICONS = {
  waiting: 'i-lucide-circle-dashed',
  done: 'i-lucide-circle-check',
  failed: 'i-lucide-circle-x',
} as const

const readyLines = computed(() => {
  const current = stage.value
  const path = run.path.value
  if (current.kind !== 'ready' || path === null) return []
  const lines = [reexport.value ? `Invoice ${run.number.value} stays as numbered.` : `Invoice ${run.number.value} is free on the invoices tab.`]
  if (current.target !== null) {
    const found = path.folders.slice(0, path.folders.length - current.target.toCreate.length)
    if (found.length > 0) lines.push(`Found ${found.join('/')} in the invoice folder.`)
    if (current.target.toCreate.length > 0) lines.push(`Will make ${current.target.toCreate.join('/')}.`)
    lines.push(
      current.target.existing === null
        ? `No file named ${path.fileName} is in view there.`
        : `${path.fileName} is there and will be replaced.`,
    )
  }
  return lines
})

const clientName = computed(() => {
  const client = store.state.workbook?.clients.find((candidate) => candidate.slug === run.client.value)
  return client?.name || run.client.value
})

const mailInWords = computed(() => {
  const mail = run.mail.value
  if (mail === null) return ''
  return run.google.value && run.mailDraft.value ? `A draft to ${mail.to}, “${mail.subject}”` : `No draft. The PDF downloads, and Gmail opens “${mail.subject}” for you to attach it.`
})

const offerCompose = computed(() => stage.value.kind === 'finished' && !run.failed.value && !(run.google.value && run.mailDraft.value))
</script>

<template>
  <UModal v-model:open="open" :title="title" :description="description" :fullscreen="phone" :dismissible="!busy" :ui="{ header: 'pe-16 sm:pe-6', content: 'sm:max-w-2xl' }">
    <template #body>
      <div class="flex flex-col gap-5" data-testid="invoice-run">
        <UAlert
          v-if="stage.kind === 'edit' && stage.message"
          icon="i-lucide-triangle-alert"
          color="error"
          variant="subtle"
          title="Nothing was written"
          :description="stage.message"
          data-testid="invoice-run-refused"
        />

        <UAlert
          v-if="editable && run.problems.value.length > 0"
          icon="i-lucide-list-checks"
          color="warning"
          variant="subtle"
          title="Before the invoice can be made"
          data-testid="invoice-run-problems"
        >
          <template #description>
            <ul class="list-disc ps-4">
              <li v-for="problem in run.problems.value" :key="problem">{{ problem }}</li>
            </ul>
            <p class="mt-1">
              The clients and the invoice terms are on
              <DrillLink :to="TERMS_LINK" in-prose class="text-highlighted" @click="open = false">Invoicing, Clients</DrillLink>.
            </p>
          </template>
        </UAlert>

        <template v-if="editable || stage.kind === 'checking'">
          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField label="Client">
              <USelect
                v-model="run.client.value"
                :items="clientItems"
                placeholder="Choose a client"
                class="w-full"
                :disabled="reexport || !editable"
                data-testid="invoice-run-client"
                @update:model-value="run.fillLines()"
              />
            </UFormField>
            <UFormField label="Issued" help="Today, unless you say otherwise.">
              <UInput v-model="run.issued.value" type="date" class="w-full" :disabled="reexport || !editable" data-testid="invoice-run-issued" @change="run.issueChanged()" />
            </UFormField>
            <UFormField label="Number" :help="reexport ? 'The number it was issued under.' : `The next by the pattern is ${run.suggestedNumber.value || 'not known yet'}.`">
              <UInput
                :model-value="run.number.value"
                class="w-full"
                :disabled="reexport || !editable"
                data-testid="invoice-run-number"
                @update:model-value="run.typeNumber(String($event))"
              />
            </UFormField>
            <UFormField label="Due" help="A month after the issue date.">
              <UInput v-model="run.due.value" type="date" class="w-full" :disabled="reexport || !editable" data-testid="invoice-run-due" />
            </UFormField>
            <UFormField label="Work from" help="The delivery period, the issue month unless the work was another.">
              <UInput v-model="run.periodFrom.value" type="date" class="w-full" :disabled="reexport || !editable" />
            </UFormField>
            <UFormField label="Work to">
              <UInput v-model="run.periodTo.value" type="date" class="w-full" :disabled="reexport || !editable" />
            </UFormField>
          </div>

          <InvoiceLinesEditor v-model:lines="run.lines.value" :total="run.total.value" :disabled="!editable" @plan="run.fillLines()" @merge="run.mergeLines()" />

          <div class="flex flex-col gap-2 text-sm">
            <p class="text-toned" data-testid="invoice-run-where">{{ where }}</p>
            <USwitch
              v-if="run.google.value"
              v-model="run.mailDraft.value"
              label="Create the mail draft"
              description="Saves a Gmail draft with the PDF attached. The first time, Google asks you to allow drafts. Nothing is ever sent."
              :disabled="!editable"
              data-testid="invoice-run-draft"
            />
            <p v-if="run.mail.value" class="min-w-0 break-words text-xs text-muted">
              To {{ run.mail.value.to || 'nobody yet' }}, “{{ run.mail.value.subject }}”
            </p>
          </div>
        </template>
        <dl v-else class="summary" data-testid="invoice-run-summary">
          <dt>Invoice</dt>
          <dd>{{ run.number.value }} to {{ clientName }}</dd>
          <dt>Total</dt>
          <dd><MoneyText :cents="run.total.value" /> in {{ run.lines.value.length }} {{ run.lines.value.length === 1 ? 'line' : 'lines' }}</dd>
          <dt>File</dt>
          <dd class="break-all">{{ run.path.value ? pathInWords(run.path.value) : '' }}</dd>
          <dt>Mail</dt>
          <dd class="break-words">{{ mailInWords }}</dd>
        </dl>

        <UAlert
          v-if="stage.kind === 'hidden'"
          icon="i-lucide-folder-search"
          color="warning"
          variant="subtle"
          :title="`The app cannot see a ${stage.segment} folder`"
          :description="`Google lets the app see only folders it made or you picked. If ${stage.path} exists, pick it, and pick the folders beside it too. If it does not, make it.`"
          data-testid="invoice-run-hidden"
        />

        <ul v-if="stage.kind === 'ready'" class="flex flex-col gap-1.5 text-sm" data-testid="invoice-run-ready">
          <li v-for="line in readyLines" :key="line" class="flex items-start gap-2">
            <UIcon name="i-lucide-check" class="mt-0.5 size-4 shrink-0 text-success" />
            <span class="text-toned">{{ line }}</span>
          </li>
        </ul>

        <ol v-if="steps.length > 0" class="flex flex-col gap-2 text-sm" data-testid="invoice-run-steps">
          <li v-for="step in steps" :key="step.kind" class="flex items-start gap-2" :data-status="step.status">
            <UIcon
              :name="STEP_ICONS[step.status]"
              class="mt-0.5 size-4 shrink-0"
              :class="{ 'text-success': step.status === 'done', 'text-error': step.status === 'failed', 'text-muted': step.status === 'waiting' }"
            />
            <span class="min-w-0">
              <span class="block text-highlighted">{{ STEP_LABELS[step.kind] }}</span>
              <span v-if="step.note" class="block break-words text-xs" :class="step.status === 'failed' ? 'text-error' : 'text-muted'">{{ step.note }}</span>
            </span>
          </li>
        </ol>

        <p v-if="run.previewError.value" class="text-xs text-error">{{ run.previewError.value }}</p>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full flex-wrap items-center gap-2">
        <UButton
          v-if="run.previewUrl.value"
          :href="run.previewUrl.value"
          target="_blank"
          rel="noopener"
          label="Open the PDF"
          icon="i-lucide-file-text"
          color="neutral"
          variant="ghost"
          data-testid="invoice-run-preview"
        />
        <div class="ms-auto flex flex-wrap justify-end gap-2">
          <template v-if="stage.kind === 'edit' || stage.kind === 'checking'">
            <UButton label="Cancel" color="neutral" variant="ghost" :disabled="busy" @click="open = false" />
            <UButton
              label="Check"
              icon="i-lucide-list-checks"
              :loading="stage.kind === 'checking'"
              :disabled="busy || run.problems.value.length > 0 || store.state.writing"
              data-testid="invoice-run-check"
              @click="run.check()"
            />
          </template>
          <template v-else-if="stage.kind === 'hidden'">
            <UButton label="Back" color="neutral" variant="ghost" @click="run.back()" />
            <UButton :label="`Create ${stage.segment}`" icon="i-lucide-folder-plus" color="neutral" variant="outline" data-testid="invoice-run-create-folder" @click="run.createHiddenFolder()" />
            <UButton :label="`Pick ${stage.segment}`" icon="i-lucide-folder-open" data-testid="invoice-run-pick-folder" @click="run.check()" />
          </template>
          <template v-else-if="stage.kind === 'ready'">
            <UButton label="Back" color="neutral" variant="ghost" @click="run.back()" />
            <UButton :label="reexport ? 'Re-export' : 'Make the invoice'" icon="i-lucide-send-horizontal" data-testid="invoice-run-make" @click="run.make()" />
          </template>
          <template v-else>
            <UButton
              v-if="offerCompose && run.composeUrl.value"
              :href="run.composeUrl.value"
              target="_blank"
              rel="noopener"
              label="Write the mail in Gmail"
              icon="i-lucide-mail"
              color="neutral"
              variant="outline"
              data-testid="invoice-run-compose"
            />
            <UButton v-if="stage.kind === 'finished'" label="Download the PDF" icon="i-lucide-download" color="neutral" variant="outline" @click="run.downloadPdf()" />
            <UButton
              v-if="run.failed.value"
              label="Retry the remaining steps"
              icon="i-lucide-rotate-cw"
              :loading="stage.kind === 'running'"
              :disabled="busy"
              data-testid="invoice-run-retry"
              @click="run.make()"
            />
            <UButton label="Close" color="neutral" :variant="run.failed.value ? 'ghost' : 'solid'" :disabled="busy" data-testid="invoice-run-close" @click="open = false" />
          </template>
        </div>
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.summary {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.25rem 1rem;
  font-size: 0.875rem;
}

.summary dt {
  color: var(--ui-text-muted);
}

.summary dd {
  color: var(--ui-text-highlighted);
}
</style>
