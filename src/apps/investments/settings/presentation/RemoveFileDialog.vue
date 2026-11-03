<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import { useToast } from '@nuxt/ui/composables/useToast'

import type { WorkbookChoice } from '../../../../shared/storage/application/workbookPorts'
import AppDialog from '../../../../shared/ui/AppDialog.vue'
import { PRICES_FILE_NAME } from '../../prices/domain/pricesFile'
import { useInvestmentsBooks } from '../../workbook/application/investmentsStore'
import type { RemovalReport, RemovalStep } from '../application/fileRemoval'
import { removeShownFile } from './useFileRemoval'
import { words } from './words'

/** Asks before Remove the Investments file, naming what goes and what stays, and lists each step's outcome when one fails. */
const open = defineModel<boolean>('open', { required: true })

const { state } = useInvestmentsBooks()
const toast = useToast()
const text = words.removal

const source = computed<WorkbookChoice['source']>(() => state.choice?.source ?? 'browser')
const onDrive = computed(() => source.value === 'drive')
const goes = computed(() => {
  const { file, prices, keys, copy } = text.driveGoes
  return onDrive.value ? [file(state.choice?.name ?? ''), prices(PRICES_FILE_NAME), keys, copy] : text.browserGoes
})
const stays = computed(() => (onDrive.value ? text.driveStays : text.browserStays))

const removing = ref(false)
const failure = ref<{ readonly lines: readonly string[]; readonly stillOpen: boolean } | null>(null)

watch(open, (opened) => {
  if (opened) failure.value = null
})

function stepName(step: RemovalStep, from: WorkbookChoice['source']): string {
  return step === 'file' ? text.steps[from === 'drive' ? 'drive-file' : 'browser-file'] : text.steps[step]
}

function linesOf(report: RemovalReport, from: WorkbookChoice['source']): string[] {
  return report.steps.map(({ step, outcome }) => {
    const name = stepName(step, from)
    if (outcome.kind === 'done') return text.outcomes.done(name)
    return outcome.kind === 'failed' ? text.outcomes.failed(name, outcome.message) : text.outcomes.notRun(name)
  })
}

async function remove(): Promise<void> {
  const from = source.value
  const fileName = state.choice?.name ?? ''
  removing.value = true
  failure.value = null
  try {
    const report = await removeShownFile()
    if (report === null) return
    if (!report.removed) {
      failure.value = { lines: linesOf(report, from), stillOpen: state.choice !== null }
      return
    }
    open.value = false
    const leftCopy = report.steps.some(({ step, outcome }) => step === 'prices-copy' && outcome.kind === 'failed')
    if (leftCopy) {
      toast.add({ title: text.copyLeft, description: linesOf(report, from).at(-1) ?? '', icon: 'i-lucide-triangle-alert', color: 'warning', duration: 10_000 })
    } else if (from === 'drive') {
      toast.add({ title: text.driveRemoved, description: text.driveRemovedNote(fileName, PRICES_FILE_NAME), icon: 'i-lucide-trash-2', color: 'success', duration: 10_000 })
    } else {
      toast.add({ title: text.browserRemoved, icon: 'i-lucide-trash-2', color: 'success', duration: 10_000 })
    }
  } catch (refused) {
    failure.value = { lines: [refused instanceof Error ? refused.message : String(refused)], stillOpen: true }
  } finally {
    removing.value = false
  }
}
</script>

<template>
  <AppDialog v-model:open="open" :title="onDrive ? text.driveTitle : text.browserTitle" :description="text.description" :dismissible="!removing">
    <div class="flex flex-col gap-4" data-testid="investments-remove-dialog">
      <section class="flex flex-col gap-2">
        <h3 class="type-label">{{ text.goes }}</h3>
        <ul class="list-disc space-y-1 ps-4 text-sm text-toned" data-testid="investments-remove-goes">
          <li v-for="line in goes" :key="line">{{ line }}</li>
        </ul>
      </section>
      <section class="flex flex-col gap-2">
        <h3 class="type-label">{{ text.stays }}</h3>
        <ul class="list-disc space-y-1 ps-4 text-sm text-toned" data-testid="investments-remove-stays">
          <li v-for="line in stays" :key="line">{{ line }}</li>
        </ul>
      </section>
      <UAlert
        v-if="failure"
        icon="i-lucide-triangle-alert"
        color="error"
        variant="subtle"
        :title="text.failed"
        v-bind="failure.stillOpen ? { description: text.stillOpen } : {}"
        data-testid="investments-remove-failed"
      />
      <ul v-if="failure" class="space-y-1 text-sm text-toned" data-testid="investments-remove-steps">
        <li v-for="line in failure.lines" :key="line">{{ line }}</li>
      </ul>
    </div>
    <template #end>
      <UButton :label="text.cancel" color="neutral" variant="ghost" :disabled="removing" data-testid="investments-remove-cancel" @click="open = false" />
      <UButton :label="text.remove" icon="i-lucide-trash-2" color="error" :loading="removing" data-testid="investments-remove-confirm" @click="remove" />
    </template>
  </AppDialog>
</template>
