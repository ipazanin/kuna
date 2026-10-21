<script lang="ts">
export type SyncState = 'first-run' | 'ready' | 'syncing' | 'error'
</script>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useId } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import { syncAge } from '../calendar/syncAge'

const props = withDefaults(
  defineProps<{
    state: SyncState
    /** ISO timestamp of the last successful sync. */
    syncedAt?: string | null
    errorMessage?: string
    /** The top bar's form: one button with how long ago, the full time and any error in what a screen reader hears. */
    compact?: boolean
  }>(),
  { syncedAt: null, errorMessage: '', compact: false },
)

const emit = defineEmits<{
  /** On first run this opens the Picker, since no Sheet is chosen yet. */
  sync: []
}>()

const dayAndTime = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const timeOnly = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' })
const fullStamp = new Intl.DateTimeFormat('en-GB', { dateStyle: 'full', timeStyle: 'short' })

const syncedAtDate = computed(() => (props.syncedAt ? new Date(props.syncedAt) : null))

/** The clock the "5 min ago" wording reads, moved on every minute. */
const now = ref(new Date())
const ticking = setInterval(() => {
  now.value = new Date()
}, 60_000)
onBeforeUnmount(() => clearInterval(ticking))

const syncLabel = computed(() => (props.state === 'syncing' ? 'Syncing' : props.state === 'error' ? 'Try again' : 'Sync'))

const asOfText = computed(() => {
  const synced = syncedAtDate.value
  if (synced === null) return 'Not synced yet'
  const sameDay = synced.toDateString() === now.value.toDateString()
  return `As of ${sameDay ? `today, ${timeOnly.format(synced)}` : dayAndTime.format(synced)}`
})

/** The top bar's one button: how long ago on one line, or what it is doing. */
const compactLabel = computed(() => {
  if (props.state === 'syncing') return 'Syncing…'
  if (props.state === 'error') return 'Try again'
  return syncedAtDate.value === null ? 'Sync' : syncAge(syncedAtDate.value, now.value)
})

/** What a screen reader hears for that button: its visible words first, then the full time of the last sync. */
const compactName = computed(() => {
  const synced = syncedAtDate.value
  if (props.state === 'syncing') return 'Syncing'
  const last = synced === null ? 'not synced yet' : `last synced ${fullStamp.format(synced)}`
  if (props.state === 'error') return `Try again. Sync failed, ${last}`
  return synced === null ? 'Sync. Not synced yet' : `Synced ${syncAge(synced, now.value)}, ${fullStamp.format(synced)}. Sync now`
})

const errorDetailId = useId()
</script>

<template>
  <div class="flex min-w-0 items-center gap-2" :class="compact ? 'justify-end' : 'flex-wrap justify-between'" data-testid="sync-status">
    <template v-if="state === 'first-run'">
      <p v-if="!compact" class="w-full text-xs text-muted">Pick the Google Sheet that holds your ledger.</p>
      <UButton
        icon="i-lucide-file-spreadsheet"
        :label="compact ? 'Choose Sheet' : 'Choose your Sheet'"
        size="sm"
        @click="emit('sync')"
      />
    </template>

    <template v-else>
      <p v-if="compact && state === 'error'" class="sr-only" role="status">Sync failed</p>
      <UButton
        v-if="compact"
        :icon="state === 'error' ? 'i-lucide-triangle-alert' : 'i-lucide-refresh-cw'"
        loading-icon="i-lucide-refresh-cw"
        :label="compactLabel"
        :aria-label="compactName"
        :loading="state === 'syncing'"
        :disabled="state === 'syncing'"
        :aria-describedby="state === 'error' && errorMessage ? errorDetailId : undefined"
        color="neutral"
        variant="outline"
        size="sm"
        class="top-bar-action"
        :class="{ 'text-error': state === 'error' }"
        data-testid="compact-sync"
        @click="emit('sync')"
      />
      <template v-else>
        <p v-if="state === 'error'" class="flex min-w-0 items-center gap-1.5 text-xs font-medium text-error" role="status">
          <UIcon name="i-lucide-triangle-alert" class="size-3.5 shrink-0" aria-hidden="true" />
          <span>Sync failed</span>
        </p>
        <p v-else class="min-w-0 truncate text-xs text-muted" role="status">
          <time v-if="syncedAtDate" :datetime="syncedAt ?? undefined" :title="fullStamp.format(syncedAtDate)" class="figure">
            {{ asOfText }}
          </time>
          <span v-else>{{ asOfText }}</span>
        </p>

        <UButton
          icon="i-lucide-refresh-cw"
          :label="syncLabel"
          :loading="state === 'syncing'"
          :disabled="state === 'syncing'"
          :aria-describedby="state === 'error' && errorMessage ? errorDetailId : undefined"
          color="neutral"
          variant="outline"
          size="sm"
          @click="emit('sync')"
        />
      </template>

      <p
        v-if="state === 'error' && errorMessage"
        :id="errorDetailId"
        class="text-xs text-muted"
        :class="compact ? 'sr-only' : 'w-full'"
      >
        {{ errorMessage }}
      </p>
    </template>
  </div>
</template>
