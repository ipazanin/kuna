<script setup lang="ts">
import { computed, ref } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import { mailSourcesOf, sourcesOn } from '../../shared/sync/application/mailSources'
import type { MailSourceRow } from '../../shared/sync/application/mailSources'
import type { RunStep, StepLink, StepState } from '../../shared/sync/application/syncRun'
import SyncStepRow from '../../shared/sync/presentation/SyncStepRow.vue'
import { usePageSync } from '../../shared/sync/presentation/pageSync'
import AppCard from '../../shared/ui/AppCard.vue'
import AppDialog from '../../shared/ui/AppDialog.vue'
import DrillLink from '../../shared/ui/DrillLink.vue'
import { words } from './words'
import EmptyState from '../../shared/ui/EmptyState.vue'

/**
 * Kuna settings: every app's mail source with its line from this page's run and a link to its card, and one button that turns
 * each source off in its own app's book. Each source is turned on again in its app.
 */
const page = usePageSync()
const text = words.mail

const apps = computed(() =>
  mailSourcesOf(
    page.syncedGroups().map((group) => ({ app: group.app, name: group.name, steps: group.steps() })),
    page.run.value,
  ),
)
const on = computed(() => sourcesOn(apps.value))
const running = computed(() => page.run.value !== null && page.run.value.finishedAt === null)

/** The row a source shows as a step: the run's step once it ran, or the step off or waiting for its first run. */
function stepOf(row: MailSourceRow): RunStep {
  if (row.standing.kind === 'ran') return row.standing.step
  const state: StepState = row.standing.kind === 'off' ? { kind: 'off', leftOut: false } : { kind: 'queued' }
  return { id: row.id, label: row.label, scopes: [], state }
}

/** A source that is off or has not run links to its app's card, where it is turned on again. */
function linkOf(row: MailSourceRow, appName: string): StepLink {
  return row.standing.kind === 'ran' ? row.source.link : { label: text.settingsOf(appName), to: row.source.link.to }
}

function lineOf(row: MailSourceRow): string | undefined {
  if (row.standing.kind === 'off') return text.off
  if (row.standing.kind === 'not-run') return text.notRun
  return undefined
}

/** While every app with a source on has its file saved by a newer Kuna, no stop can go through. */
const allRefused = computed(() =>
  on.value.every(
    (row) =>
      page
        .syncedGroups()
        .find((group) => group.app === row.app)
        ?.store.savedByNewerApp() ?? false,
  ),
)

const open = ref(false)
const stopping = ref(false)

/** Each source in turn, so one app's failure leaves the next to stop. Each app's toast says how its own write went. */
async function stopAll(): Promise<void> {
  stopping.value = true
  for (const row of on.value) {
    try {
      await row.source.stop()
    } catch {
      // The app's own toast says why its write failed.
    }
  }
  stopping.value = false
  open.value = false
}
</script>

<template>
  <AppCard :title="text.title" :subtitle="text.subtitle" data-testid="mail-card">
    <EmptyState v-if="apps.length === 0" line :title="text.none" data-testid="mail-card-none" />
    <div v-else class="flex flex-col gap-4 px-4 pt-3 pb-4 sm:px-5 sm:pb-5">
      <section v-for="app in apps" :key="app.app" class="flex flex-col gap-2" :aria-label="app.name" :data-group="app.app">
        <h3 class="type-label">{{ app.name }}</h3>
        <ol class="flex flex-col gap-2.5">
          <SyncStepRow v-for="row in app.sources" :key="row.id" :app="app.app" :step="stepOf(row)" :running="running" :line="lineOf(row)" :link="linkOf(row, app.name)" without-undo />
        </ol>
      </section>
      <div v-if="on.length > 0" class="flex flex-wrap gap-2">
        <UButton icon="i-lucide-mail-x" :label="text.stop" color="neutral" variant="outline" size="sm" data-testid="mail-stop" @click="open = true" />
      </div>
      <p v-else class="type-aside" data-testid="mail-all-off">{{ text.allOff }}</p>
    </div>
    <AppDialog v-model:open="open" :title="text.stopTitle" :description="text.stopDescription" :dismissible="!stopping" changes>
      <ul class="flex flex-col gap-3" data-testid="mail-stop-dialog">
        <li v-for="row in on" :key="`${row.app}-${row.id}`" class="flex flex-col gap-0.5">
          <p class="type-body">
            <span class="font-medium text-highlighted">{{ row.label }}</span>
            <span class="sr-only">:</span>
            {{ row.name }}
          </p>
          <DrillLink :to="row.source.link.to" class="type-card-title inline-target">{{ text.settingsOf(row.name) }}</DrillLink>
        </li>
      </ul>
      <template #end>
        <UButton :label="text.cancel" color="neutral" variant="ghost" :disabled="stopping" @click="open = false" />
        <UButton :label="text.stopConfirm" icon="i-lucide-mail-x" :loading="stopping" :disabled="allRefused" data-testid="mail-stop-confirm" @click="stopAll" />
      </template>
    </AppDialog>
  </AppCard>
</template>
