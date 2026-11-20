<script setup lang="ts">
import { computed } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import { dateFormat } from '../../calendar/dateFormat'
import { listedSteps } from '../application/syncRun'
import type { SyncRun } from '../application/syncRun'
import SyncStepRow from './SyncStepRow.vue'
import { words } from './words'

/** The steps of the last sync, each with its line, and Undo or a link where the step left one. A run over several apps names each app over its steps. */
const props = defineProps<{
  run: SyncRun | null
}>()

const emit = defineEmits<{
  /** Runs every step again. */
  sync: []
}>()

const stamp = dateFormat({ day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

const running = computed(() => props.run !== null && props.run.finishedAt === null)
const when = computed(() => {
  const run = props.run
  if (run === null) return words.steps.none
  return running.value ? words.steps.since(stamp(new Date(run.startedAt))) : words.steps.last(stamp(new Date(run.finishedAt ?? run.startedAt)))
})
</script>

<template>
  <div class="flex flex-col gap-3" data-testid="sync-steps">
    <p class="figure type-caption">{{ when }}</p>
    <div v-if="run" class="flex flex-col gap-3">
      <section v-for="group in run.groups" :key="group.app" class="flex flex-col gap-2" :aria-label="run.groups.length > 1 ? group.name : undefined" :data-group="group.app">
        <h3 v-if="run.groups.length > 1" class="type-label">{{ group.name }}</h3>
        <ol class="flex flex-col gap-2.5">
          <SyncStepRow v-for="step in listedSteps(group)" :key="step.id" :app="group.app" :step="step" :running="running" />
        </ol>
      </section>
    </div>
    <div v-if="!running" class="flex justify-end">
      <UButton :label="words.steps.again" icon="i-lucide-refresh-cw" color="neutral" variant="outline" size="sm" data-testid="sync-again" @click="emit('sync')" />
    </div>
  </div>
</template>
