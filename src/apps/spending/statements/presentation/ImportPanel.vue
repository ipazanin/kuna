<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import { writeDryRun } from '../application/statementWrites'
import { revolutStatement } from '../domain/revolutStatement'
import { statementDryRun } from '../domain/statementDryRun'
import DryRunLines from './DryRunLines.vue'
import { words } from './words'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import { today } from '../../../../shared/calendar/civilDate'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import { plural } from '../../../../shared/text/translation'
import AppCard from '../../../../shared/ui/AppCard.vue'
import FileDrop from '../../../../shared/ui/FileDrop.vue'
import { readFirstSheet } from '../../../../shared/xlsx/sheetGrids'

/** A dropped file's dry run, worked out again as the file changes, so an Undo brings it back. Nothing is written until the button. */
const store = useSpendingBooks()
const writes = useRecordWrites(store)

const picked = ref<File | null>(null)
const loading = ref(false)
const unreadable = ref<string | null>(null)
// Shallow, so the cells stay plain data.
const loaded = shallowRef<{ readonly name: string; readonly grid: Awaited<ReturnType<typeof readFirstSheet>> } | null>(null)

watch(picked, async (file) => {
  if (file === null) return
  loading.value = true
  unreadable.value = null
  loaded.value = null
  try {
    // A csv stays text, so its cells stay as written.
    const grid = await readFirstSheet(file.name.toLowerCase().endsWith('.csv') ? await file.text() : await file.arrayBuffer())
    loaded.value = { name: file.name, grid }
  } catch (failure) {
    unreadable.value = words.import.unreadable(failure instanceof Error ? failure.message : String(failure))
  } finally {
    loading.value = false
  }
})

const reading = computed(() => {
  const book = store.state.workbook
  return book === null || loaded.value === null ? null : revolutStatement(loaded.value.grid, loaded.value.name, book)
})
const refusal = computed(() => (reading.value !== null && 'refusal' in reading.value ? reading.value.refusal : null))
const dryRun = computed(() => {
  const book = store.state.workbook
  return book === null || reading.value === null || !('statement' in reading.value) ? null : statementDryRun(book, reading.value.statement, today())
})
const changes = computed(() => (dryRun.value === null ? 0 : dryRun.value.added.length + dryRun.value.changed.length))

async function confirm(): Promise<void> {
  const run = dryRun.value
  if (run !== null) await writes.write(words.import.imported, (unit) => writeDryRun(unit, run), { key: 'import', failedTitle: words.import.notImported })
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <AppCard :title="words.import.title" :subtitle="words.import.subtitle">
      <div class="flex flex-col gap-3 px-4 pt-3 pb-4 sm:px-5" data-testid="spending-import-file">
        <FileDrop v-model="picked" accept=".xlsx,.csv" :label="words.import.drop" :description="words.import.orChoose" />
        <p v-if="loading" class="flex items-center gap-2 text-sm text-muted">
          <UIcon name="i-lucide-loader-circle" class="size-4 animate-spin" aria-hidden="true" />
          {{ words.import.reading }}
        </p>
        <UAlert v-if="unreadable !== null || refusal !== null" icon="i-lucide-file-x" color="error" variant="subtle" :title="unreadable ?? refusal ?? ''" data-testid="spending-import-refused" />
      </div>
    </AppCard>
    <AppCard v-if="dryRun !== null && loaded !== null" :title="loaded.name" data-testid="spending-dry-run">
      <div class="flex flex-col gap-3 px-4 pt-3 pb-4 sm:px-5">
        <p class="text-sm text-highlighted" data-testid="spending-dry-run-summary">{{ words.import.summary(dryRun.newRows, dryRun.alreadyIn, dryRun.filled) }}</p>
        <ul v-if="dryRun.notes.length > 0" class="flex flex-col gap-1 text-sm text-muted" data-testid="spending-dry-run-notes">
          <li v-for="note in dryRun.notes" :key="note">{{ note }}</li>
        </ul>
        <DryRunLines :lines="dryRun.lines" />
        <UButton
          v-if="changes > 0"
          class="self-start"
          :label="plural(words.import.confirm(changes), changes)"
          icon="i-lucide-file-down"
          :loading="writes.saving('import')"
          data-testid="spending-import-confirm"
          @click="confirm"
        />
        <p v-else class="text-sm text-muted" data-testid="spending-import-nothing">{{ words.import.nothing }}</p>
      </div>
    </AppCard>
  </div>
</template>
