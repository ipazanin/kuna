<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useTemplateRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import UButton from '@nuxt/ui/components/Button.vue'
import UPopover from '@nuxt/ui/components/Popover.vue'
import USlideover from '@nuxt/ui/components/Slideover.vue'

import { syncAge } from '../../calendar/syncAge'
import { usePhoneLayout } from '../../layout/viewport'
import { intlLocale } from '../../text/language'
import { listInWords } from '../../text/listInWords'
import { SCOPE_WORDS } from '../application/syncRun'
import type { SyncControl, SyncRun } from '../application/syncRun'
import SyncStepList from './SyncStepList.vue'

/**
 * The sync control: what the sync is doing, Sign in to Google or Allow access while the page lacks
 * a permission, the problems of the last sync, or how long ago it ran. A tap does what it says: it
 * syncs, asks Google, or opens the steps, in a popover from 640 px and a bottom sheet on a phone.
 * A dot on the button says a file kept in this browser holds changes in no exported file.
 */
const props = withDefaults(
  defineProps<{
    control: SyncControl
    /** The last sync, whose steps the list shows. */
    run?: SyncRun | null
    /** The top bar's form: one button, with the full time and the step in what a screen reader hears. */
    compact?: boolean
    /** What a file kept in this browser has not exported yet, in a sentence, or null while every such file is exported in time. */
    exportReminder?: string | null
  }>(),
  { run: null, compact: false, exportReminder: null },
)

const emit = defineEmits<{
  sync: []
  /** Asks Google for what the steps and the settings lack. */
  allow: []
  /** Finds the books on Drive, since no file is chosen yet. */
  find: []
}>()

const phone = usePhoneLayout()
const listOpen = ref(false)
const route = useRoute()
// A link in the steps, such as Import, opens its screen, which the sheet would cover.
watch(
  () => route.fullPath,
  () => {
    listOpen.value = false
  },
)
const root = useTemplateRef<HTMLElement>('root')

const timeOnly = new Intl.DateTimeFormat(intlLocale, { hour: '2-digit', minute: '2-digit' })
const dayAndTime = new Intl.DateTimeFormat(intlLocale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const fullStamp = new Intl.DateTimeFormat(intlLocale, { dateStyle: 'full', timeStyle: 'short' })

/** The clock the "5 min ago" wording reads, moved on every minute. */
const now = ref(new Date())
const ticking = setInterval(() => {
  now.value = new Date()
}, 60_000)
onBeforeUnmount(() => clearInterval(ticking))

const syncedAt = computed(() => (props.control.kind === 'ready' && props.control.syncedAt !== null ? new Date(props.control.syncedAt) : null))

const asOfText = computed(() => {
  const synced = syncedAt.value
  if (synced === null) return 'Not synced yet'
  return `As of ${synced.toDateString() === now.value.toDateString() ? `today, ${timeOnly.format(synced)}` : dayAndTime.format(synced)}`
})

const problemWords = computed(() => (props.control.kind === 'problems' ? (props.control.count === 1 ? '1 problem' : `${props.control.count} problems`) : ''))

/** What the steps that need access lack, in a sentence, such as "Statements need your Drive read access". */
const accessWords = computed(() => {
  const { control } = props
  if (control.kind !== 'allow-access') return ''
  const scopes = listInWords(control.scopes.map((scope) => SCOPE_WORDS[scope]))
  return `${listInWords([...control.labels])} ${control.labels.length === 1 ? 'needs' : 'need'} ${scopes}`
})

/** Why the last ask to Google gave no token, and that a tap asks again, or null. */
const failureWords = computed(() => {
  const { control } = props
  if ((control.kind !== 'allow-access' && control.kind !== 'sign-in') || control.failure === null) return null
  const why = /[.!?]$/.test(control.failure) ? control.failure : `${control.failure}.`
  return `${why} Tap ${control.kind === 'sign-in' ? 'Sign in to Google' : 'Allow access'} to try again.`
})

const label = computed(() => {
  const { control } = props
  switch (control.kind) {
    case 'find':
      return props.compact ? 'Find file' : 'Find your file'
    case 'running':
      return props.compact ? `${control.label} ${control.position}/${control.of}` : 'Syncing'
    case 'sign-in':
      return 'Sign in to Google'
    case 'allow-access':
      return 'Allow access'
    case 'problems':
      return problemWords.value
    case 'ready':
      return props.compact && syncedAt.value !== null ? syncAge(syncedAt.value, now.value) : 'Sync'
  }
})

/** What a screen reader hears for the button: its visible words first, then what they stand for, and the export reminder last. */
const name = computed(() => (props.exportReminder === null ? controlName.value : `${controlName.value}. ${props.exportReminder}`))

const controlName = computed(() => {
  const { control } = props
  switch (control.kind) {
    case 'find':
      return 'Find the file on Google Drive that holds your books'
    case 'running':
      return `Syncing, ${control.label}, step ${control.position} of ${control.of}: ${control.line}`
    case 'sign-in':
      return failureWords.value === null ? 'Sign in to Google, which the sync needs first' : `Sign in to Google. ${failureWords.value}`
    case 'allow-access':
      return `Allow access. ${failureWords.value === null ? '' : `${failureWords.value} `}${accessWords.value}`
    case 'problems':
      return `${problemWords.value} in the last sync. Show the steps`
    case 'ready': {
      const synced = syncedAt.value
      return synced === null ? 'Sync. Not synced yet' : `Synced ${syncAge(synced, now.value)}, ${fullStamp.format(synced)}. Sync now`
    }
  }
})

const ICONS: Readonly<Record<SyncControl['kind'], string>> = {
  find: 'i-lucide-hard-drive',
  running: 'i-lucide-refresh-cw',
  'sign-in': 'i-lucide-log-in',
  'allow-access': 'i-lucide-key-round',
  problems: 'i-lucide-triangle-alert',
  ready: 'i-lucide-refresh-cw',
}

/** The line beside the sidebar's button, which a screen reader hears as it changes. */
const statusLine = computed(() => {
  const { control } = props
  switch (control.kind) {
    case 'find':
      return 'Find the file on Google Drive that holds your books.'
    case 'running':
      return `${control.label} ${control.position}/${control.of}: ${control.line}`
    case 'sign-in':
      return failureWords.value ?? 'Google asks you to sign in before the sync.'
    case 'allow-access':
      return failureWords.value ?? accessWords.value
    case 'problems':
      return `Look at the ${listInWords([...control.labels])} ${control.labels.length === 1 ? 'step' : 'steps'}`
    case 'ready':
      return asOfText.value
  }
})

function tap(): void {
  switch (props.control.kind) {
    case 'find':
      emit('find')
      return
    case 'sign-in':
    case 'allow-access':
      emit('allow')
      return
    case 'problems':
      listOpen.value = true
      return
    case 'ready':
      emit('sync')
      return
    case 'running':
  }
}

/** The popover has no trigger of its own, so focus goes back to the control's button once it closes. */
function focusButton(event: Event): void {
  event.preventDefault()
  root.value?.querySelector<HTMLButtonElement>('[data-testid="sync-button"]')?.focus()
}

function syncAgain(): void {
  listOpen.value = false
  emit('sync')
}
</script>

<template>
  <div
    ref="root"
    class="flex min-w-0 items-center gap-2"
    :class="compact ? 'justify-end' : 'flex-wrap justify-between'"
    data-testid="sync-status"
    :data-control="control.kind"
  >
    <p v-if="compact" class="sr-only" role="status">{{ control.kind === 'running' || control.kind === 'problems' || control.kind === 'allow-access' || control.kind === 'sign-in' ? name : '' }}</p>
    <p
      v-else
      class="w-full min-w-0 text-xs"
      :class="{ 'font-medium text-error': control.kind === 'problems', 'text-muted': control.kind !== 'problems', truncate: control.kind === 'ready' || control.kind === 'running' }"
      role="status"
      data-testid="sync-line"
    >
      <time v-if="control.kind === 'ready' && syncedAt" :datetime="control.syncedAt ?? undefined" :title="fullStamp.format(syncedAt)" class="figure">{{ statusLine }}</time>
      <span v-else>{{ statusLine }}</span>
    </p>
    <UButton
      :icon="ICONS[control.kind]"
      loading-icon="i-lucide-refresh-cw"
      :label="label"
      :aria-label="name"
      :title="compact ? (failureWords ?? undefined) : undefined"
      :loading="control.kind === 'running'"
      :disabled="control.kind === 'running'"
      :color="control.kind === 'find' ? 'primary' : 'neutral'"
      :variant="control.kind === 'find' ? 'solid' : 'outline'"
      size="sm"
      :class="{ 'top-bar-action': compact, 'has-reminder': exportReminder !== null, 'text-error': control.kind === 'problems', 'text-warning': control.kind === 'allow-access' || control.kind === 'sign-in' }"
      data-testid="sync-button"
      @click="tap"
    />
    <UButton
      v-if="!compact && run !== null && control.kind !== 'running' && control.kind !== 'problems'"
      icon="i-lucide-list-checks"
      aria-label="The steps of the last sync"
      color="neutral"
      variant="ghost"
      size="sm"
      data-testid="sync-steps-open"
      @click="listOpen = true"
    />
  </div>
  <USlideover v-if="phone" v-model:open="listOpen" side="bottom" title="Sync" :ui="{ content: 'phone-sheet' }">
    <template #body>
      <SyncStepList :run="run" @sync="syncAgain" />
    </template>
  </USlideover>
  <UPopover v-else v-model:open="listOpen" :reference="root ?? undefined" :content="{ side: compact ? 'bottom' : 'right', align: 'end', collisionPadding: 12, onCloseAutoFocus: focusButton }">
    <template #content>
      <SyncStepList :run="run" class="w-80 max-w-[calc(100vw-2rem)] p-4" @sync="syncAgain" />
    </template>
  </UPopover>
</template>
