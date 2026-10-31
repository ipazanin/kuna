<script setup lang="ts">
import { computed, onBeforeUnmount, toRef, watch } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import USelect from '@nuxt/ui/components/Select.vue'
import USwitch from '@nuxt/ui/components/Switch.vue'

import MoneyText from '../../../../shared/ui/MoneyText.vue'
import DrillLink from '../../../../shared/ui/DrillLink.vue'
import AppDialog from '../../../../shared/ui/AppDialog.vue'
import FormGrid from '../../../../shared/ui/FormGrid.vue'
import { useWorkbook } from '../../workbook/application/workbookStore'
import { pathInWords } from '../domain/invoiceFiling'
import InvoiceLinesEditor from './InvoiceLinesEditor.vue'
import { TERMS_LINK } from './invoicingLinks'
import { useInvoiceRun } from './useInvoiceRun'
import type { InvoiceRunMode } from './useInvoiceRun'
import { words } from './words'
import { words as writeWords } from '../../../../shared/storage/presentation/words'
import { plural } from '../../../../shared/text/translation'

const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  mode: InvoiceRunMode
}>()

const store = useWorkbook()
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

const title = computed(() => (reexport.value ? words.run.reexportTitle(run.number.value) : words.run.makeTitle))
const description = computed(() => (reexport.value ? words.run.reexportDescription : words.run.makeDescription))

const where = computed(() => {
  const path = run.path.value
  if (path === null) return ''
  return run.google.value ? words.run.filedAs(pathInWords(path)) : words.run.savedAs(path.fileName)
})

const STEP_ICONS = {
  waiting: 'i-lucide-circle-dashed',
  done: 'i-lucide-circle-check',
  failed: 'i-lucide-circle-x',
} as const

const readyLines = computed(() => {
  const current = stage.value
  const path = run.path.value
  if (current.kind !== 'ready' || path === null) return []
  const lines = [reexport.value ? words.run.keepsNumber(run.number.value) : words.run.numberFree(run.number.value)]
  if (current.target !== null) {
    const found = path.folders.slice(0, path.folders.length - current.target.toCreate.length)
    if (found.length > 0) lines.push(words.run.found(found.join('/')))
    if (current.target.toCreate.length > 0) lines.push(words.run.willMake(current.target.toCreate.join('/')))
    lines.push(current.target.existing === null ? words.run.noFileThere(path.fileName) : words.run.replacesFile(path.fileName))
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
  return run.google.value && run.mailDraft.value ? words.run.draftTo(mail.to, mail.subject) : words.run.noDraft(mail.subject)
})

const offerCompose = computed(() => stage.value.kind === 'finished' && !run.failed.value && !(run.google.value && run.mailDraft.value))
</script>

<template>
  <AppDialog v-model:open="open" width="2xl" :title="title" :description="description" :dismissible="!busy">
    <div class="flex flex-col gap-5" data-testid="invoice-run">
      <UAlert
        v-if="stage.kind === 'edit' && stage.message"
        icon="i-lucide-triangle-alert"
        color="error"
        variant="subtle"
        :title="writeWords.nothingWritten"
        :description="stage.message"
        data-testid="invoice-run-refused"
      />

      <UAlert v-if="editable && run.problems.value.length > 0" icon="i-lucide-list-checks" color="warning" variant="subtle" :title="words.run.beforeMaking" data-testid="invoice-run-problems">
        <template #description>
          <ul class="list-disc ps-4">
            <li v-for="problem in run.problems.value" :key="problem">{{ problem }}</li>
          </ul>
          <p class="mt-1">
            {{ words.run.termsAreOn }}
            <DrillLink :to="TERMS_LINK" in-prose class="text-highlighted" @click="open = false">{{ words.run.clientsTab }}</DrillLink
            >.
          </p>
        </template>
      </UAlert>

      <template v-if="editable || stage.kind === 'checking'">
        <FormGrid>
          <UFormField :label="words.run.client">
            <USelect
              v-model="run.client.value"
              :items="clientItems"
              :placeholder="words.run.clientPlaceholder"
              class="w-full"
              :disabled="reexport || !editable"
              data-testid="invoice-run-client"
              @update:model-value="run.fillLines()"
            />
          </UFormField>
          <UFormField :label="words.run.issued" :help="words.run.issuedHelp">
            <UInput v-model="run.issued.value" type="date" class="w-full" :disabled="reexport || !editable" data-testid="invoice-run-issued" @change="run.issueChanged()" />
          </UFormField>
          <UFormField :label="words.run.number" :help="reexport ? words.run.issuedUnder : words.run.nextNumber(run.suggestedNumber.value)">
            <UInput :model-value="run.number.value" class="w-full" :disabled="reexport || !editable" data-testid="invoice-run-number" @update:model-value="run.typeNumber(String($event))" />
          </UFormField>
          <UFormField :label="words.run.due" :help="words.run.dueHelp">
            <UInput v-model="run.due.value" type="date" class="w-full" :disabled="reexport || !editable" data-testid="invoice-run-due" />
          </UFormField>
          <UFormField :label="words.run.workFrom" :help="words.run.workFromHelp">
            <UInput v-model="run.periodFrom.value" type="date" class="w-full" :disabled="reexport || !editable" />
          </UFormField>
          <UFormField :label="words.run.workTo">
            <UInput v-model="run.periodTo.value" type="date" class="w-full" :disabled="reexport || !editable" />
          </UFormField>
        </FormGrid>

        <InvoiceLinesEditor v-model:lines="run.lines.value" :total="run.total.value" :disabled="!editable" @plan="run.fillLines()" @merge="run.mergeLines()" />

        <div class="flex flex-col gap-2 text-sm">
          <p class="text-toned" data-testid="invoice-run-where">{{ where }}</p>
          <USwitch
            v-if="run.google.value"
            v-model="run.mailDraft.value"
            :label="words.run.draftSwitch"
            :description="words.run.draftSwitchHelp"
            :disabled="!editable"
            data-testid="invoice-run-draft"
          />
          <p v-if="run.mail.value" class="min-w-0 break-words text-xs text-muted">{{ words.run.mailTo(run.mail.value.to, run.mail.value.subject) }}</p>
        </div>
      </template>
      <dl v-else class="summary" data-testid="invoice-run-summary">
        <dt>{{ words.run.invoice }}</dt>
        <dd>{{ words.run.numberTo(run.number.value, clientName) }}</dd>
        <dt>{{ words.run.total }}</dt>
        <dd><MoneyText :cents="run.total.value" /> {{ plural(words.run.inLines(run.lines.value.length), run.lines.value.length) }}</dd>
        <dt>{{ words.run.file }}</dt>
        <dd class="break-all">{{ run.path.value ? pathInWords(run.path.value) : '' }}</dd>
        <dt>{{ words.run.mail }}</dt>
        <dd class="break-words">{{ mailInWords }}</dd>
      </dl>

      <UAlert
        v-if="stage.kind === 'hidden'"
        icon="i-lucide-folder-search"
        color="warning"
        variant="subtle"
        :title="words.run.hiddenTitle(stage.segment)"
        :description="words.run.hiddenDescription(stage.path)"
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
            <span class="block text-highlighted">{{ words.run.steps[step.kind] }}</span>
            <span v-if="step.note" class="block break-words text-xs" :class="step.status === 'failed' ? 'text-error' : 'text-muted'">{{ step.note }}</span>
          </span>
        </li>
      </ol>

      <p v-if="run.previewError.value" class="text-xs text-error">{{ run.previewError.value }}</p>
    </div>
    <template #start>
      <UButton
        v-if="run.previewUrl.value"
        :href="run.previewUrl.value"
        target="_blank"
        rel="noopener"
        :label="words.run.openPdf"
        icon="i-lucide-file-text"
        color="neutral"
        variant="ghost"
        data-testid="invoice-run-preview"
      />
    </template>
    <template #end>
      <template v-if="stage.kind === 'edit' || stage.kind === 'checking'">
        <UButton :label="words.run.cancel" color="neutral" variant="ghost" :disabled="busy" @click="open = false" />
        <UButton
          :label="words.run.check"
          icon="i-lucide-list-checks"
          :loading="stage.kind === 'checking'"
          :disabled="busy || run.problems.value.length > 0 || store.state.writing"
          data-testid="invoice-run-check"
          @click="run.check()"
        />
      </template>
      <template v-else-if="stage.kind === 'hidden'">
        <UButton :label="words.run.back" color="neutral" variant="ghost" @click="run.back()" />
        <UButton
          :label="words.run.createFolder(stage.segment)"
          icon="i-lucide-folder-plus"
          color="neutral"
          variant="outline"
          data-testid="invoice-run-create-folder"
          @click="run.createHiddenFolder()"
        />
        <UButton :label="words.run.pickFolder(stage.segment)" icon="i-lucide-folder-open" data-testid="invoice-run-pick-folder" @click="run.check()" />
      </template>
      <template v-else-if="stage.kind === 'ready'">
        <UButton :label="words.run.back" color="neutral" variant="ghost" @click="run.back()" />
        <UButton :label="reexport ? words.run.reexport : words.run.makeInvoice" icon="i-lucide-send-horizontal" data-testid="invoice-run-make" @click="run.make()" />
      </template>
      <template v-else>
        <UButton
          v-if="offerCompose && run.composeUrl.value"
          :href="run.composeUrl.value"
          target="_blank"
          rel="noopener"
          :label="words.run.compose"
          icon="i-lucide-mail"
          color="neutral"
          variant="outline"
          data-testid="invoice-run-compose"
        />
        <UButton v-if="stage.kind === 'finished'" :label="words.run.download" icon="i-lucide-download" color="neutral" variant="outline" @click="run.downloadPdf()" />
        <UButton v-if="run.failed.value" :label="words.run.retry" icon="i-lucide-rotate-cw" :loading="stage.kind === 'running'" :disabled="busy" data-testid="invoice-run-retry" @click="run.make()" />
        <UButton :label="words.run.close" color="neutral" :variant="run.failed.value ? 'ghost' : 'solid'" :disabled="busy" data-testid="invoice-run-close" @click="open = false" />
      </template>
    </template>
  </AppDialog>
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
