<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UCheckbox from '@nuxt/ui/components/Checkbox.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import { useToast } from '@nuxt/ui/composables/useToast'

import { forgetAssistChoices } from '../../shared/ai/infrastructure/assistSettings'
import { forgetKunaStart } from '../../shared/app/kunaStart'
import { forgetGoogleSignIn } from '../../shared/google/googleAuth'
import type { GoogleScope } from '../../shared/google/googleScopes'
import { withGoogleAccess } from '../../shared/google/withGoogleAccess'
import { forgetKeysHere } from '../../shared/secrets/presentation/pageSecrets'
import { deleteKeysFromGoogle, secretsHeldHere } from '../../shared/secrets/presentation/secretsStep'
import { removalWent } from '../../shared/storage/application/appData'
import type { DataPlace } from '../../shared/storage/application/appData'
import DataPlaceChoices from '../../shared/storage/presentation/DataPlaceChoices.vue'
import { backupsLabel, removalLines } from '../../shared/storage/presentation/removalLines'
import { words as storageWords } from '../../shared/storage/presentation/words'
import { switchAutoSync } from '../../shared/sync/infrastructure/autoSyncSwitch'
import { usePageSync } from '../../shared/sync/presentation/pageSync'
import AppDialog from '../../shared/ui/AppDialog.vue'
import { installedApps } from '../routing/appRegistry'
import { deleteAllOfKuna, nameTyped } from './deleteAllOfKuna'
import type { KunaDeletionPorts, KunaDeletionReport, SharedThing } from './deleteAllOfKuna'
import { words } from './words'

/** Asks before deleting all of Kuna: what each app really has, what they share, a backup per app, and the name typed. Everything chosen that fails is listed. */
const open = defineModel<boolean>('open', { required: true })

const text = words.deleteData.all
const KUNA_NAME = 'Kuna'
const toast = useToast()
const router = useRouter()
const sync = usePageSync()

const appsHolding = computed(() => installedApps().filter((app) => app.data.held() !== null))
const chosen = ref<Readonly<Record<string, readonly DataPlace[]>>>({})
const things = ref<readonly SharedThing[]>([])
const withBackups = ref(false)
/** Each app's count, or null when it is not known without a sign-in. */
const backupCounts = ref<readonly (number | null)[]>([])
const appsOnDrive = computed(() => appsHolding.value.filter((app) => app.data.held()?.source === 'drive'))
const backupTotal = computed(() => (backupCounts.value.includes(null) ? null : (backupCounts.value as readonly number[]).reduce((total, count) => total + count, 0)))
const offersBackups = computed(() => appsOnDrive.value.length > 0 && backupTotal.value !== 0)
const typed = ref('')
const deleting = ref(false)
const failure = ref<readonly string[] | null>(null)

const keysHere = computed(() => secretsHeldHere())

const sharedRows = computed(() => [
  ...(keysHere.value ? [{ thing: 'browser-keys', label: text.browserKeys, note: text.browserKeysNote } as const] : []),
  { thing: 'google-keys', label: text.googleKeys, note: text.googleKeysNote } as const,
  { thing: 'browser-settings', label: text.browserSettings, note: text.browserSettingsNote } as const,
])

/** Keys in the Google account start unticked, as the one thing here with no way back, and so do the backups, which are the way back. */
watch(open, (opened) => {
  if (!opened) return
  chosen.value = Object.fromEntries(appsHolding.value.map((app) => [app.id, app.data.held()?.places ?? []]))
  things.value = [...(keysHere.value ? (['browser-keys'] as const) : []), 'browser-settings']
  withBackups.value = false
  backupCounts.value = appsOnDrive.value.map(() => null)
  void Promise.all(appsOnDrive.value.map((app) => app.data.backupsOnDrive())).then((counts) => {
    backupCounts.value = counts
  })
  typed.value = ''
  failure.value = null
})

function tickThing(thing: SharedThing, on: boolean | 'indeterminate'): void {
  things.value = on === true ? [...things.value, thing] : things.value.filter((held) => held !== thing)
}

const picks = computed(() =>
  appsHolding.value
    .map((app) => ({ data: app.data, places: chosen.value[app.id] ?? [], backups: withBackups.value && offersBackups.value && app.data.held()?.source === 'drive' }))
    .filter(({ places, backups }) => places.length > 0 || backups),
)
const somethingChosen = computed(() => picks.value.length > 0 || things.value.length > 0)
const confirmed = computed(() => nameTyped(typed.value, KUNA_NAME))

const PORTS: KunaDeletionPorts = {
  syncsOver: () => sync.settled(),
  syncing: () => sync.running(),
  forgetBrowserKeys: forgetKeysHere,
  deleteGoogleKeys: deleteKeysFromGoogle,
  forgetBrowserSettings() {
    forgetKunaStart()
    forgetAssistChoices()
    switchAutoSync(true)
    if (!installedApps().some((app) => app.data.held()?.source === 'drive')) forgetGoogleSignIn()
  },
}

function linesOf(report: KunaDeletionReport): readonly string[] {
  const appLines = report.apps.flatMap(({ data, report: removal }) => (removalWent(removal) ? [] : removalLines(removal).map((line) => `${data.name}. ${line}`)))
  const sharedLines = report.shared.flatMap(({ thing, failure: reason }) => (reason === null ? [] : [text.sharedFailed(sharedRows.value.find((row) => row.thing === thing)?.label ?? thing, reason)]))
  return [...appLines, ...sharedLines]
}

function scopesOfChoice(): readonly GoogleScope[] {
  return [
    ...(picks.value.some(({ places, backups }) => backups || places.includes('drive-file')) ? (['drive.file'] as const) : []),
    ...(things.value.includes('google-keys') ? (['drive.appdata'] as const) : []),
  ]
}

async function remove(): Promise<void> {
  deleting.value = true
  failure.value = null
  try {
    const report = await withGoogleAccess(scopesOfChoice(), () => deleteAllOfKuna(PORTS, picks.value, things.value))
    if (!report.complete) {
      failure.value = linesOf(report)
      chosen.value = Object.fromEntries(appsHolding.value.map((app) => [app.id, app.data.held()?.places ?? []]))
      things.value = things.value.filter((thing) => report.shared.some((done) => done.thing === thing && done.failure !== null))
      return
    }
    open.value = false
    toast.add({
      title: text.deleted,
      ...(report.apps.some(({ report: removal }) => removal.steps.some(({ step }) => step === 'drive-file')) ? { description: text.deletedNote } : {}),
      icon: 'i-lucide-trash-2',
      color: 'success',
      duration: 10_000,
    })
    if (appsHolding.value.length === 0) void router.push('/')
  } catch (refused) {
    failure.value = [refused instanceof Error ? refused.message : String(refused)]
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <AppDialog v-model:open="open" :title="text.title" :description="text.description" :dismissible="!deleting">
    <div class="flex flex-col gap-5" data-testid="delete-kuna-dialog">
      <DataPlaceChoices v-for="app in appsHolding" :key="app.id" :chosen="chosen[app.id] ?? []" :data="app.data" named :disabled="deleting" @update:chosen="chosen = { ...chosen, [app.id]: $event }" />
      <section class="flex flex-col gap-3">
        <h3 class="type-label">{{ text.shared }}</h3>
        <UCheckbox
          v-if="offersBackups"
          v-model="withBackups"
          :label="backupsLabel(backupTotal)"
          :description="storageWords.deleteData.backupsNote"
          :disabled="deleting"
          data-testid="delete-kuna-backups"
        />
        <UCheckbox
          v-for="row in sharedRows"
          :key="row.thing"
          :model-value="things.includes(row.thing)"
          :label="row.label"
          :description="row.note"
          :disabled="deleting"
          :data-testid="`delete-kuna-${row.thing}`"
          @update:model-value="tickThing(row.thing, $event)"
        />
      </section>
      <p class="type-caption" data-testid="delete-kuna-stays">{{ text.stays }}</p>
      <UFormField :label="text.typeName(KUNA_NAME)">
        <UInput v-model="typed" class="w-full" autocomplete="off" :disabled="deleting" data-testid="delete-kuna-name" />
      </UFormField>
      <UAlert v-if="failure" icon="i-lucide-triangle-alert" color="error" variant="subtle" :title="text.failed" :description="text.failedNote" data-testid="delete-kuna-failed" />
      <ul v-if="failure" class="space-y-1 text-sm text-toned" data-testid="delete-kuna-steps">
        <li v-for="line in failure" :key="line">{{ line }}</li>
      </ul>
    </div>
    <template #end>
      <UButton :label="text.cancel" color="neutral" variant="ghost" :disabled="deleting" data-testid="delete-kuna-cancel" @click="open = false" />
      <UButton :label="text.confirm" icon="i-lucide-trash-2" color="error" :loading="deleting" :disabled="!confirmed || !somethingChosen" data-testid="delete-kuna-confirm" @click="remove" />
    </template>
  </AppDialog>
</template>
