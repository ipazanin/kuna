<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import { useToast } from '@nuxt/ui/composables/useToast'

import type { GoogleScope } from '../../shared/google/googleScopes'
import { withGoogleAccess } from '../../shared/google/withGoogleAccess'
import { forgetKeysHere } from '../../shared/secrets/presentation/pageSecrets'
import { deleteKeysFromGoogle, secretsHeldHere } from '../../shared/secrets/presentation/secretsStep'
import { placesTickedFirst, removalCanRetry, removalWent } from '../../shared/storage/application/appData'
import type { DataPlace, HeldData } from '../../shared/storage/application/appData'
import DataPlaceChoices from '../../shared/storage/presentation/DataPlaceChoices.vue'
import DeleteFailure from '../../shared/storage/presentation/DeleteFailure.vue'
import DeleteRow from '../../shared/storage/presentation/DeleteRow.vue'
import { removalLines } from '../../shared/storage/presentation/removalLines'
import type { RemovalLine } from '../../shared/storage/presentation/removalLines'
import { words as storageWords } from '../../shared/storage/presentation/words'
import { usePageSync } from '../../shared/sync/presentation/pageSync'
import AppDialog from '../../shared/ui/AppDialog.vue'
import { installedApps } from '../routing/appRegistry'
import { deleteAllOfKuna, forgetBrowserSettings, nameTyped, picksStillHeld } from './deleteAllOfKuna'
import type { KunaDeletionPorts, KunaDeletionReport, SharedThing } from './deleteAllOfKuna'
import { words } from './words'

/** Asks before deleting all of Kuna: what each app really has with its export and backups, what they share, and the name typed. What fails is said first. */
const open = defineModel<boolean>('open', { required: true })

const text = words.deleteData.all
const KUNA_NAME = 'Kuna'
const toast = useToast()
const router = useRouter()
const sync = usePageSync()

const appsHolding = computed(() => installedApps().filter((app) => app.data.held() !== null))
const chosen = ref<Readonly<Record<string, readonly DataPlace[]>>>({})
const things = ref<readonly SharedThing[]>([])
/** Whose backups the person ticked, by app. */
const backups = ref<Readonly<Record<string, boolean>>>({})
const typed = ref('')
const deleting = ref(false)
const failure = ref<{ readonly lines: readonly RemovalLine[]; readonly canRetry: boolean } | null>(null)
const someOnDrive = computed(() => appsHolding.value.some((app) => app.data.held()?.source === 'drive'))
const description = computed(() => (someOnDrive.value ? `${text.description} ${storageWords.deleteData.binRule}` : text.description))

const keysHere = computed(() => secretsHeldHere())

const sharedRows = computed(() => [
  ...(keysHere.value ? [{ thing: 'browser-keys', label: text.browserKeys, goes: text.browserKeysGo, stays: text.browserKeysStay } as const] : []),
  { thing: 'browser-settings', label: text.browserSettings, goes: text.browserSettingsGo, stays: text.browserSettingsStay } as const,
  { thing: 'google-keys', label: text.googleKeys, goes: text.googleKeysGo, stays: text.googleKeysStay, forGood: text.googleKeysForGood } as const,
])

/** What goes for good starts unticked, a file kept only here and the keys in the Google account, and so do the backups, which are the way back. */
watch(open, (opened) => {
  if (!opened) return
  chosen.value = Object.fromEntries(
    appsHolding.value.flatMap((app) => {
      const held = app.data.held()
      return held === null ? [] : [[app.id, placesTickedFirst(held, held.places)]]
    }),
  )
  things.value = [...(keysHere.value ? (['browser-keys'] as const) : []), 'browser-settings']
  backups.value = {}
  typed.value = ''
  failure.value = null
})

function tickThing(thing: SharedThing, on: boolean): void {
  things.value = on ? [...things.value, thing] : things.value.filter((held) => held !== thing)
}

const picks = computed(() =>
  appsHolding.value.map((app) => ({ data: app.data, places: chosen.value[app.id] ?? [], backups: backups.value[app.id] === true })).filter((pick) => pick.places.length > 0 || pick.backups),
)
const somethingChosen = computed(() => picks.value.length > 0 || things.value.length > 0)
const confirmed = computed(() => nameTyped(typed.value, KUNA_NAME))

const PORTS: KunaDeletionPorts = {
  syncsOver: () => sync.settled(),
  syncing: () => sync.running(),
  forgetBrowserKeys: forgetKeysHere,
  deleteGoogleKeys: deleteKeysFromGoogle,
  forgetBrowserSettings: () => forgetBrowserSettings(installedApps().some((app) => app.data.held()?.source === 'drive')),
}

function linesOf(report: KunaDeletionReport, heldBefore: ReadonlyMap<string, HeldData | null>): readonly RemovalLine[] {
  const appLines = report.apps.flatMap(({ data, report: removal }) => {
    const was = heldBefore.get(data.id)
    return removalWent(removal) || !was ? [] : removalLines(removal, was).map((line) => ({ ...line, text: `${data.name}: ${line.text}` }))
  })
  const sharedLines = report.shared.flatMap(({ thing, failure: reason }) =>
    reason === null ? [] : [{ kind: 'failed' as const, text: text.sharedFailed(sharedRows.value.find((row) => row.thing === thing)?.label ?? thing, reason) }],
  )
  return [...appLines, ...sharedLines]
}

function scopesOfChoice(): readonly GoogleScope[] {
  return [
    ...(picks.value.some((pick) => pick.backups || pick.places.includes('drive-file')) ? (['drive.file'] as const) : []),
    ...(things.value.includes('google-keys') ? (['drive.appdata'] as const) : []),
  ]
}

async function remove(): Promise<void> {
  const heldBefore = new Map(appsHolding.value.map((app) => [app.id, app.data.held()]))
  deleting.value = true
  failure.value = null
  try {
    const report = await withGoogleAccess(scopesOfChoice(), () => deleteAllOfKuna(PORTS, picks.value, things.value))
    if (!report.complete) {
      failure.value = {
        lines: linesOf(report, heldBefore),
        canRetry: report.shared.some(({ failure: reason }) => reason !== null) || report.apps.some(({ report: removal }) => removalCanRetry(removal)),
      }
      chosen.value = picksStillHeld(
        chosen.value,
        appsHolding.value.map((app) => app.data),
      )
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
    failure.value = { lines: [{ kind: 'failed', text: refused instanceof Error ? refused.message : String(refused) }], canRetry: true }
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <AppDialog v-model:open="open" :title="text.title" :description="description" :dismissible="!deleting">
    <div class="flex flex-col gap-5" data-testid="delete-kuna-dialog">
      <DeleteFailure
        v-if="failure"
        :title="text.failed"
        :note="failure.canRetry ? `${text.failedNote} ${storageWords.deleteData.tryAgain}` : text.failedNote"
        :lines="failure.lines"
        data-testid="delete-kuna-failed"
      />
      <DataPlaceChoices
        v-for="app in appsHolding"
        :key="app.id"
        :chosen="chosen[app.id] ?? []"
        :backups="backups[app.id] === true"
        :data="app.data"
        named
        :disabled="deleting"
        @update:chosen="chosen = { ...chosen, [app.id]: $event }"
        @update:backups="backups = { ...backups, [app.id]: $event }"
      />
      <section class="flex flex-col gap-3">
        <h3 class="type-label">{{ text.shared }}</h3>
        <DeleteRow
          v-for="row in sharedRows"
          :key="row.thing"
          :model-value="things.includes(row.thing)"
          :label="row.label"
          :goes="row.goes"
          :stays="row.stays"
          :for-good="'forGood' in row ? row.forGood : undefined"
          :disabled="deleting"
          :data-testid="`delete-kuna-${row.thing}`"
          @update:model-value="tickThing(row.thing, $event)"
        />
      </section>
      <p class="type-caption" data-testid="delete-kuna-stays">{{ text.stays }}</p>
      <UFormField :label="text.typeName(KUNA_NAME)">
        <UInput v-model="typed" class="w-full" autocomplete="off" :disabled="deleting" data-testid="delete-kuna-name" />
      </UFormField>
    </div>
    <template #end>
      <UButton :label="text.cancel" color="neutral" variant="ghost" :disabled="deleting" data-testid="delete-kuna-cancel" @click="open = false" />
      <UButton :label="text.confirm" icon="i-lucide-trash-2" color="error" :loading="deleting" :disabled="!confirmed || !somethingChosen" data-testid="delete-kuna-confirm" @click="remove" />
    </template>
  </AppDialog>
</template>
