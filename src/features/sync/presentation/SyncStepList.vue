<script setup lang="ts">
import { computed } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import DrillLink from '../../../shared/ui/DrillLink.vue'
import { canUndo } from '../../workbook/application/createWorkbookStore'
import { useWorkbook } from '../../workbook/application/workbookStore'
import { useRecordWrites } from '../../workbook/presentation/useRecordWrites'
import type { RunStep, StepState, SyncRun } from '../domain/syncRun'

/** The steps of the last sync, each with its line, and Undo or a link where the step left one. */
const props = defineProps<{
  run: SyncRun | null
}>()

const emit = defineEmits<{
  /** Runs every step again. */
  sync: []
}>()

const store = useWorkbook()
const writes = useRecordWrites()

const stamp = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

const ICONS: Readonly<Record<StepState['kind'], { readonly name: string; readonly tone: string }>> = {
  off: { name: 'i-lucide-circle-off', tone: 'text-dimmed' },
  queued: { name: 'i-lucide-circle-dashed', tone: 'text-dimmed' },
  running: { name: 'i-lucide-loader-circle', tone: 'text-muted animate-spin' },
  done: { name: 'i-lucide-check', tone: 'text-[var(--tone-positive)]' },
  waits: { name: 'i-lucide-circle-alert', tone: 'text-warning' },
  'needs-access': { name: 'i-lucide-key-round', tone: 'text-warning' },
  failed: { name: 'i-lucide-triangle-alert', tone: 'text-error' },
  skipped: { name: 'i-lucide-circle-slash', tone: 'text-dimmed' },
}

const running = computed(() => props.run !== null && props.run.finishedAt === null)
const when = computed(() => {
  const run = props.run
  if (run === null) return 'No sync on this page yet.'
  return running.value ? `Syncing since ${stamp.format(new Date(run.startedAt))}` : `Last sync ${stamp.format(new Date(run.finishedAt ?? run.startedAt))}`
})

function lineOf(step: RunStep): string {
  const { state } = step
  switch (state.kind) {
    case 'off':
      return 'Off in Settings'
    case 'queued':
      return 'Waiting to start'
    default:
      return state.line
  }
}

/** The session write a step made, while Undo can still put it back. */
function undoable(step: RunStep) {
  const { state } = step
  if (state.kind !== 'done' && state.kind !== 'waits') return null
  const write = store.state.writes.find((written) => written.id === state.writeId)
  return write !== undefined && canUndo(write, store.state.writes) ? write : null
}

function linkOf(step: RunStep) {
  return step.state.kind === 'done' || step.state.kind === 'waits' ? step.state.link : null
}
</script>

<template>
  <div class="flex flex-col gap-3" data-testid="sync-steps">
    <p class="figure text-xs text-muted">{{ when }}</p>
    <ol v-if="run" class="flex flex-col gap-2.5">
      <li v-for="step in run.steps" :key="step.id" class="flex items-start gap-2" :data-step="step.id" :data-state="step.state.kind">
        <UIcon :name="ICONS[step.state.kind].name" class="mt-0.5 size-4 shrink-0" :class="ICONS[step.state.kind].tone" aria-hidden="true" />
        <div class="flex min-w-0 flex-1 flex-col gap-1">
          <p class="text-sm break-words text-toned">
            <span class="font-medium text-highlighted">{{ step.label }}</span>
            <span class="sr-only">:</span>
            {{ lineOf(step) }}
          </p>
          <div v-if="undoable(step) || linkOf(step)" class="flex flex-wrap items-center gap-x-3 gap-y-1">
            <UButton
              v-if="undoable(step)"
              label="Undo"
              icon="i-lucide-undo-2"
              color="neutral"
              variant="outline"
              size="xs"
              :loading="writes.busy.value"
              :disabled="writes.busy.value || running"
              data-testid="sync-step-undo"
              @click="writes.undo(undoable(step)!)"
            />
            <DrillLink v-if="linkOf(step)" :to="linkOf(step)!.to" class="text-sm font-medium text-highlighted">{{ linkOf(step)!.label }}</DrillLink>
          </div>
        </div>
      </li>
    </ol>
    <div v-if="!running" class="flex justify-end">
      <UButton label="Sync again" icon="i-lucide-refresh-cw" color="neutral" variant="outline" size="sm" data-testid="sync-again" @click="emit('sync')" />
    </div>
  </div>
</template>
