<script setup lang="ts">
import { computed } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'
import UTooltip from '@nuxt/ui/components/Tooltip.vue'

import { dateFormat } from '../../calendar/dateFormat'
import type { CopyMeta } from '../application/workbookPorts'
import { exportReminderDue } from '../domain/exportReminder'
import { words } from './words'

/** Where an app's file kept in this browser lives and when it was last written to a file, with the export button. */
const props = withDefaults(
  defineProps<{
    /** The copy on screen, or null before one is. */
    meta: CopyMeta | null
    /** What the export button says, such as Export to Excel. */
    label: string
    exporting: boolean
    /** The narrow top-bar form: the button alone, with the reminder in its label. */
    compact?: boolean
    /** On the icon sidebar: the icon alone, with its name as a tooltip. */
    rail?: boolean
    /** The app's name, which leads the row in a list of the files kept in this browser, in place of saying where it is kept. */
    name?: string | null
  }>(),
  { compact: false, rail: false, name: null },
)

const emit = defineEmits<{ export: [] }>()

const dayFormat = dateFormat({ day: 'numeric', month: 'short' })

const exportedText = computed(() => {
  const exportedAt = props.meta?.lastExportedAt ?? null
  return exportedAt === null ? words.localFile.notExported : words.localFile.exported(dayFormat(new Date(exportedAt)))
})
const reminder = computed(() => {
  const since = props.meta?.unexportedSince ?? null
  return since !== null && exportReminderDue(since, new Date()) ? words.localFile.reminder(dayFormat(new Date(since))) : null
})
</script>

<template>
  <div
    class="flex min-w-0 gap-2"
    :class="rail ? 'items-center justify-center' : compact ? 'items-center justify-end' : name !== null ? 'flex-col items-start' : 'flex-wrap items-center justify-between'"
    data-testid="local-status"
  >
    <div v-if="!compact" class="min-w-0">
      <p class="truncate text-xs text-toned">{{ name ?? words.localFile.kept }}</p>
      <p class="figure truncate text-xs text-muted">{{ exportedText }}</p>
    </div>
    <UTooltip :text="words.localFile.export" :disabled="!rail" :content="{ side: 'right' }">
      <UButton
        icon="i-lucide-download"
        :label="rail ? '' : compact ? words.localFile.export : label"
        :loading="exporting"
        :disabled="exporting || meta === null"
        :aria-label="compact ? [label, reminder].filter(Boolean).join('. ') : undefined"
        color="neutral"
        variant="outline"
        size="sm"
        :class="{ 'top-bar-action': compact && !rail, 'has-reminder': compact && reminder }"
        @click="emit('export')"
      />
    </UTooltip>
    <p v-if="reminder && !compact" class="flex w-full items-start gap-1.5 text-xs text-warning" role="status">
      <UIcon name="i-lucide-clock-alert" class="mt-px size-3.5 shrink-0" aria-hidden="true" />
      <span>{{ reminder }}</span>
    </p>
  </div>
</template>
