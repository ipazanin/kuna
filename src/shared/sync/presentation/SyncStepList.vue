<script setup lang="ts">
import { computed } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import { intlLocale } from '../../text/language'
import DrillLink from '../../ui/DrillLink.vue'
import type { RunStep, StepState, SyncRun } from '../application/syncRun'
import { usePageSync } from './pageSync'

/** The steps of the last sync, each with its line, and Undo or a link where the step left one. A run over several apps names each app over its steps. */
const props = defineProps<{
  run: SyncRun | null
}>()

const emit = defineEmits<{
  /** Runs every step again. */
  sync: []
}>()

const page = usePageSync()

const stamp = new Intl.DateTimeFormat(intlLocale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

const ICONS: Readonly<Record<StepState['kind'], { readonly name: string; readonly tone: string }>> = {
  off: { name: 'i-lucide-circle-off', tone: 'text-muted' },
  queued: { name: 'i-lucide-circle-dashed', tone: 'text-muted' },
  running: { name: 'i-lucide-loader-circle', tone: 'text-muted animate-spin' },
  done: { name: 'i-lucide-check', tone: 'text-success' },
  waits: { name: 'i-lucide-circle-alert', tone: 'text-warning' },
  'needs-access': { name: 'i-lucide-key-round', tone: 'text-warning' },
  failed: { name: 'i-lucide-triangle-alert', tone: 'text-error' },
  skipped: { name: 'i-lucide-circle-slash', tone: 'text-muted' },
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

/** The session write a step of the app made, while Undo can still put it back. */
function undoable(app: string, step: RunStep) {
  const { state } = step
  return state.kind === 'done' || state.kind === 'waits' ? page.undoable(app, state.writeId) : null
}

function linkOf(step: RunStep) {
  return step.state.kind === 'done' || step.state.kind === 'waits' || step.state.kind === 'failed' ? step.state.link : null
}
</script>

<template>
  <div class="flex flex-col gap-3" data-testid="sync-steps">
    <p class="figure text-xs text-muted">{{ when }}</p>
    <div v-if="run" class="flex flex-col gap-3">
      <section v-for="group in run.groups" :key="group.app" class="flex flex-col gap-2" :aria-label="run.groups.length > 1 ? group.name : undefined" :data-group="group.app">
        <h3 v-if="run.groups.length > 1" class="text-xs font-medium text-muted">{{ group.name }}</h3>
        <ol class="flex flex-col gap-2.5">
          <li v-for="step in group.steps" :key="step.id" class="flex items-start gap-2" :data-step="step.id" :data-state="step.state.kind">
            <UIcon :name="ICONS[step.state.kind].name" class="mt-0.5 size-4 shrink-0" :class="ICONS[step.state.kind].tone" aria-hidden="true" />
            <div class="flex min-w-0 flex-1 flex-col gap-1">
              <p class="text-sm break-words text-toned">
                <span class="font-medium text-highlighted">{{ step.label }}</span>
                <span class="sr-only">:</span>
                {{ lineOf(step) }}
              </p>
              <div v-if="undoable(group.app, step) || linkOf(step)" class="flex flex-wrap items-center gap-x-3 gap-y-1">
                <UButton
                  v-if="undoable(group.app, step)"
                  label="Undo"
                  icon="i-lucide-undo-2"
                  color="neutral"
                  variant="outline"
                  size="xs"
                  :loading="page.undoing.value"
                  :disabled="page.undoing.value || running"
                  data-testid="sync-step-undo"
                  @click="page.undo(group.app, undoable(group.app, step)!)"
                />
                <DrillLink v-if="linkOf(step)" :to="linkOf(step)!.to" class="text-sm font-medium text-highlighted">{{ linkOf(step)!.label }}</DrillLink>
              </div>
            </div>
          </li>
        </ol>
      </section>
    </div>
    <div v-if="!running" class="flex justify-end">
      <UButton label="Sync again" icon="i-lucide-refresh-cw" color="neutral" variant="outline" size="sm" data-testid="sync-again" @click="emit('sync')" />
    </div>
  </div>
</template>
