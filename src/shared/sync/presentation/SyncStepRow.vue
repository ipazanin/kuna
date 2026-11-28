<script setup lang="ts">
import { computed } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import { TONE_ICONS } from '../../ui/toneText'
import type { RunStep, StepLink, StepState } from '../application/syncRun'
import { words as syncWords } from '../application/words'
import { usePageSync } from './pageSync'
import { words } from './words'

/** One step of a sync with its line, and Undo or a link where the step left one. */
const props = defineProps<{
  /** The id of the app whose step it is. */
  app: string
  step: RunStep
  /** Whether a sync is under way, which holds Undo back. */
  running: boolean
  /** Said instead of the step's own line, such as Off on Kuna settings' mail card. */
  line?: string | undefined
  /** Offered when the step left no link of its own. */
  link?: StepLink | null
  /** Leaves Undo to another list of the same run, such as the Sync card beside Kuna settings' mail card. */
  withoutUndo?: boolean
}>()

const page = usePageSync()

const ICONS: Readonly<Record<StepState['kind'], { readonly name: string; readonly tone: string }>> = {
  off: { name: 'i-lucide-circle-off', tone: 'text-muted' },
  queued: { name: 'i-lucide-circle-dashed', tone: 'text-muted' },
  running: { name: 'i-lucide-loader-circle', tone: 'text-muted animate-spin' },
  done: { name: 'i-lucide-check', tone: 'text-success' },
  waits: { name: TONE_ICONS.warning, tone: 'text-warning' },
  'needs-access': { name: 'i-lucide-key-round', tone: 'text-warning' },
  failed: { name: TONE_ICONS.error, tone: 'text-error' },
  skipped: { name: 'i-lucide-circle-slash', tone: 'text-muted' },
}

const shownLine = computed(() => {
  if (props.line !== undefined) return props.line
  const { state } = props.step
  switch (state.kind) {
    case 'off':
      return syncWords.off
    case 'queued':
      return syncWords.waiting
    default:
      return state.line
  }
})

/** The session write the step made, while Undo can still put it back. */
const undoable = computed(() => {
  if (props.withoutUndo) return null
  const { state } = props.step
  return state.kind === 'done' || state.kind === 'waits' ? page.undoable(props.app, state.writeId) : null
})

const shownLink = computed(() => {
  const { state } = props.step
  const own = state.kind === 'done' || state.kind === 'waits' || state.kind === 'failed' ? state.link : null
  return own ?? props.link ?? null
})
</script>

<template>
  <li class="flex items-start gap-2" :data-step="step.id" :data-state="step.state.kind">
    <UIcon :name="ICONS[step.state.kind].name" class="mt-0.5 size-4 shrink-0" :class="ICONS[step.state.kind].tone" aria-hidden="true" />
    <div class="flex min-w-0 flex-1 flex-col gap-1">
      <p class="type-body break-words">
        <span class="font-medium text-highlighted">{{ step.label }}</span>
        <span class="sr-only">:</span>
        {{ shownLine }}
      </p>
      <div v-if="undoable || shownLink" class="flex flex-wrap items-center gap-x-3 gap-y-1">
        <UButton
          v-if="undoable"
          :label="words.steps.undo"
          icon="i-lucide-undo-2"
          color="neutral"
          variant="outline"
          size="xs"
          :loading="page.undoing.value"
          :disabled="page.undoing.value || running"
          data-testid="sync-step-undo"
          @click="page.undo(app, undoable)"
        />
        <UButton v-if="shownLink" :to="shownLink.to" :label="shownLink.label" trailing-icon="i-lucide-arrow-right" color="neutral" variant="link" size="sm" class="px-0" />
      </div>
    </div>
  </li>
</template>
