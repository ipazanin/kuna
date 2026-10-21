<script setup lang="ts">
import { computed } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import { useWorkbook } from '../../workbook/application/workbookStore'
import { exportReminderDue } from '../domain/exportReminder'
import { useExport } from './useExport'

/** Where an Excel-mode workbook lives and when it was last written to a file, with the export button. */
withDefaults(
  defineProps<{
    /** The narrow top-bar form: the button alone, with the reminder in its label. */
    compact?: boolean
  }>(),
  { compact: false },
)

const { state } = useWorkbook()
const { exporting, exportNow } = useExport()

const dayFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' })

const meta = computed(() => state.snapshot?.meta ?? null)
const exportedText = computed(() => {
  const exportedAt = meta.value?.lastExportedAt ?? null
  return exportedAt === null ? 'Not exported yet' : `Exported ${dayFormat.format(new Date(exportedAt))}`
})
const reminder = computed(() => {
  const since = meta.value?.unexportedSince ?? null
  return since !== null && exportReminderDue(since, new Date()) ? `Changes since ${dayFormat.format(new Date(since))} are in no exported file.` : null
})
</script>

<template>
  <div class="flex min-w-0 items-center gap-2" :class="compact ? 'justify-end' : 'flex-wrap justify-between'" data-testid="local-status">
    <div v-if="!compact" class="min-w-0">
      <p class="truncate text-xs text-toned">Kept in this browser</p>
      <p class="figure truncate text-xs text-muted">{{ exportedText }}</p>
    </div>
    <UButton
      icon="i-lucide-download"
      :label="compact ? 'Export' : 'Export to Excel'"
      :loading="exporting"
      :disabled="exporting || state.workbook === null"
      :aria-label="compact && reminder ? `Export to Excel. ${reminder}` : undefined"
      color="neutral"
      variant="outline"
      size="sm"
      :class="{ 'top-bar-action': compact, 'has-reminder': compact && reminder }"
      @click="exportNow"
    />
    <p v-if="reminder && !compact" class="flex w-full items-start gap-1.5 text-xs text-[var(--tone-warning)]" role="status">
      <UIcon name="i-lucide-clock-alert" class="mt-px size-3.5 shrink-0" aria-hidden="true" />
      <span>{{ reminder }}</span>
    </p>
  </div>
</template>

<style scoped>
.has-reminder {
  position: relative;
}

.has-reminder::after {
  content: '';
  position: absolute;
  top: 0;
  right: 0.5rem;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--tone-warning);
  box-shadow: 0 0 0 2px var(--surface-page);
}
</style>
