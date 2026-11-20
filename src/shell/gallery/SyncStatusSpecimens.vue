<script setup lang="ts">
import type { SyncControl, SyncRun } from '../../shared/sync/application/syncRun'
import SyncStatus from '../../shared/sync/presentation/SyncStatus.vue'
import AppCard from '../../shared/ui/AppCard.vue'
import GallerySection from './GallerySection.vue'

/** One of each state of the sync control, Allow access also after a closed popup, over a last sync whose statement mail step filed a statement. */
const SYNC_CONTROLS: readonly SyncControl[] = [
  { kind: 'ready', syncedAt: '2026-10-16T06:04:00Z' },
  { kind: 'running', label: 'Statement mail', position: 2, of: 3, line: 'Filing 3 rows' },
  { kind: 'sign-in', failure: null },
  { kind: 'allow-access', scopes: ['gmail.readonly'], labels: ['Statement mail'], failure: null },
  { kind: 'allow-access', scopes: ['gmail.readonly'], labels: ['Statement mail'], failure: "Google's window was closed before access was allowed." },
  { kind: 'problems', count: 1, labels: ['Statement mail'] },
]

const SYNC_RUN: SyncRun = {
  startedAt: '2026-10-16T06:03:52Z',
  finishedAt: '2026-10-16T06:04:00Z',
  groups: [
    {
      app: 'company',
      name: 'Company',
      steps: [
        { id: 'books', label: 'Books', scopes: ['drive.file'], state: { kind: 'done', line: 'Up to date', writeId: null, link: null } },
        {
          id: 'mail',
          label: 'Statement mail',
          scopes: ['gmail.readonly'],
          state: { kind: 'waits', line: 'Filed statement 028, 3 rows. 1 statement was not filed.', writeId: null, link: { label: 'Import', to: '/gallery' } },
        },
      ],
    },
  ],
}
</script>

<template>
  <GallerySection id="sync-status" title="Sync status" description="Every state of the sync control, in the sidebar and compact in the phone top bar.">
    <div class="grid gap-3 sm:grid-cols-2 @4xl:grid-cols-4">
      <AppCard v-for="(control, index) in SYNC_CONTROLS" :key="index" as="div" class="p-4"><SyncStatus :control="control" :run="SYNC_RUN" /></AppCard>
    </div>
    <h3 class="type-label">Compact, as in the phone top bar</h3>
    <div class="flex flex-wrap gap-3">
      <AppCard v-for="(control, index) in SYNC_CONTROLS" :key="index" as="div" class="p-4"><SyncStatus :control="control" :run="SYNC_RUN" compact /></AppCard>
    </div>
    <h3 class="type-label">While a write to the books runs</h3>
    <div class="flex flex-wrap gap-3">
      <AppCard as="div" class="w-60 p-4"><SyncStatus :control="SYNC_CONTROLS[0]!" :run="SYNC_RUN" saving /></AppCard>
      <AppCard as="div" class="p-4"><SyncStatus :control="SYNC_CONTROLS[0]!" :run="SYNC_RUN" compact saving /></AppCard>
    </div>
  </GallerySection>
</template>
