<script setup lang="ts">
import { ref, watch } from 'vue'
import { useToast } from '@nuxt/ui/composables/useToast'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import USelect from '@nuxt/ui/components/Select.vue'

import type { ClosesCsvRefusal } from '../domain/closesCsv'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { plural } from '../../../../shared/text/translation'
import AppCard from '../../../../shared/ui/AppCard.vue'
import FileDrop from '../../../../shared/ui/FileDrop.vue'
import { fetchAddedInBackground } from './pricesStep'
import { runProblem } from './runProblem'
import { useClosesImport } from './useClosesImport'
import type { ClosesFileRow } from './useClosesImport'
import { usePrices } from './usePrices'
import { words } from './words'

/**
 * The Prices tab's import of daily closes from CSV files, such as a vendor's free key never reaches back to: each file
 * matched to a holding by its name, its dry run, and one write of them all into the prices file.
 */
const prices = usePrices()
const toast = useToast()
const closesImport = useClosesImport()
const text = words.closesImport
const dropped = ref<File[] | null>(null)
const importing = ref(false)

watch(dropped, (files) => {
  if (files !== null && files.length > 0) void closesImport.read(files)
})

function refusal(reason: ClosesCsvRefusal): string {
  return reason.kind === 'unreadable' ? text.refused.unreadable(reason.line) : reason.kind === 'repeated-day' ? text.refused['repeated-day'](reason.day) : text.refused[reason.kind]
}

/** Why a file read well still has no holding, or null once it has one. */
function unmatched(row: ClosesFileRow): string | null {
  return row.line !== null ? null : row.matches.length === 0 ? text.noMatch : text.twoMatch
}

function clearFiles(): void {
  closesImport.clear()
  dropped.value = null
}

async function importCloses(): Promise<void> {
  const lines = closesImport.lines.value
  if (lines.length === 0) return
  importing.value = true
  try {
    const run = await prices.importCloses(lines)
    if (run === 'no-books') return
    if (run.kind === 'written') {
      toast.add({ title: plural(text.imported(lines.length), lines.length), description: text.importedNote, icon: 'i-lucide-check', color: 'success' })
      clearFiles()
      fetchAddedInBackground(prices)
    } else {
      toast.add({ title: text.notImported, description: runProblem(run) ?? '', icon: 'i-lucide-triangle-alert', color: 'error', duration: 10_000 })
    }
  } finally {
    importing.value = false
  }
}
</script>

<template>
  <AppCard :title="text.title" :subtitle="text.subtitle" data-testid="investments-closes-import">
    <div class="flex flex-col gap-4 px-4 pt-3 pb-4 sm:px-5 sm:pb-5">
      <FileDrop v-model="dropped" multiple accept=".csv,text/csv" :label="text.drop" :description="text.dropMore" icon="i-lucide-file-spreadsheet" />
      <ul v-if="closesImport.rows.value.length > 0" class="flex flex-col" data-testid="closes-import-files">
        <li v-for="row in closesImport.rows.value" :key="row.name" class="flex flex-col gap-2 border-t border-default py-3 first:border-t-0 first:pt-0" data-testid="closes-import-file">
          <span class="type-label break-all">{{ row.name }}</span>
          <p v-if="row.reading.kind === 'refused'" class="type-body text-error" data-testid="closes-import-refused">{{ refusal(row.reading.refusal) }}</p>
          <template v-else>
            <UFormField v-if="row.matches.length !== 1" :label="text.holding" :help="unmatched(row) ?? ''">
              <USelect
                v-bind="row.line === null ? {} : { modelValue: row.line.instrument.id }"
                :items="closesImport.holdings.value.map((instrument) => ({ value: instrument.id, label: `${instrument.name} (${instrument.symbol})` }))"
                :placeholder="text.pick"
                class="w-full"
                data-testid="closes-import-holding"
                @update:model-value="closesImport.pick(row.name, String($event))"
              />
            </UFormField>
            <p v-else-if="row.line !== null" class="type-body text-highlighted">{{ row.line.instrument.name }} ({{ row.line.instrument.symbol }})</p>
            <template v-if="row.line !== null">
              <p class="type-caption" data-testid="closes-import-adds">{{ text.adds(row.line.added, dayLabel(row.line.first), dayLabel(row.line.last), row.line.replaced) }}</p>
              <p class="type-caption">{{ text.currency(row.line.instrument.currency) }}</p>
              <p v-if="row.line.gapFrom !== null" class="type-caption text-warning" data-testid="closes-import-gap">{{ text.gap(dayLabel(row.line.gapFrom), dayLabel(row.line.first)) }}</p>
            </template>
          </template>
        </li>
      </ul>
      <div v-if="closesImport.rows.value.length > 0" class="flex flex-wrap gap-2">
        <UButton
          icon="i-lucide-file-input"
          :label="plural(text.import(closesImport.lines.value.length), closesImport.lines.value.length)"
          :loading="importing || closesImport.reading.value"
          :disabled="importing || closesImport.lines.value.length === 0"
          data-testid="closes-import-confirm"
          @click="importCloses"
        />
        <UButton :label="text.clear" color="neutral" variant="ghost" :disabled="importing" @click="clearFiles" />
      </div>
    </div>
  </AppCard>
</template>
