<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import UInputMenu from '@nuxt/ui/components/InputMenu.vue'
import USelect from '@nuxt/ui/components/Select.vue'

import { PAGE_SECRET_STORE, useSecretsChanged } from '../../secrets/presentation/pageSecrets'
import { useKeyRemoval } from '../../secrets/presentation/useKeyRemoval'
import { useSecretRows } from '../../secrets/presentation/useSecretRows'
import { words as secretWords } from '../../secrets/presentation/words'
import AppCard from '../../ui/AppCard.vue'
import { assistOn, modelOf, pickModel } from '../infrastructure/assistSettings'
import { testProviderKey } from '../infrastructure/modelAccess'
import { PROVIDER_PRESETS, presetOf, turnsOnWebSearch } from '../infrastructure/providerPresets'
import type { KeyTest, ProviderId, ProviderPreset } from '../infrastructure/providerPresets'
import { assistKeyKept, pinProviderInUse, providerInUse, switchProvider } from './useAiTask'
import { words } from './words'

/**
 * Kuna settings' assistant: one company at a time, its key and its model, and a line per app with a link to that app's
 * own switches. A company with a key takes over at once. One with no key changes nothing until a key is saved, so a
 * person who is only looking keeps the assistant they had.
 */
const props = defineProps<{
  apps: readonly { readonly id: string; readonly name: string; readonly to: RouteLocationRaw }[]
  /** Whether some app's file is on Drive, so a sync carries the keys. */
  onDrive: boolean
  /** Asks Google for the keys another browser saved, and says why they could not be read, or null. */
  fetchKeys: () => Promise<string | null>
}>()

const keys = useSecretRows(
  PROVIDER_PRESETS.map((preset) => ({ ...preset, needsKey: true })),
  PAGE_SECRET_STORE,
  (preset, key): Promise<KeyTest> => testProviderKey(preset, key ?? ''),
)
const announceRemoval = useKeyRemoval()

const shownId = ref<ProviderId>(providerInUse()?.id ?? PROVIDER_PRESETS[0]!.id)
const shown = computed(() => presetOf(shownId.value))
const row = computed(() => keys.rows[shownId.value]!)
const tested = computed(() => (row.value.test === null || row.value.test === 'testing' ? null : row.value.test))

/** What is typed in the key field, which goes nowhere until Save. */
const typed = ref('')
const replacing = ref(false)
/** What the model field holds while it has focus, which may be empty while the stored model falls back to the default. */
const modelDraft = ref<string | null>(null)
/** The last move of the assistant on this card, for the lines that say what it did. */
const moved = ref<{ readonly to: ProviderId; readonly from: ProviderId | null; readonly employeesReset: boolean } | null>(null)
const fetching = ref(false)
const fetchLine = ref<string | null>(null)

const refused = computed(() => tested.value?.kind === 'refused')
const fieldOpen = computed(() => !row.value.kept || replacing.value || refused.value)
const inUse = computed(() => providerInUse())

const keyLine = computed(() => (row.value.ending === null ? secretWords.keyRow.kept : secretWords.keyRow.keptEnding(row.value.ending)))
const companies = computed(() =>
  PROVIDER_PRESETS.map((preset) => ({
    label: preset.name,
    value: preset.id,
    description: keys.rows[preset.id]!.kept ? `${words.card.about[preset.id]}. ${words.card.keySaved}` : words.card.about[preset.id],
  })),
)
const keepsUsing = computed(() => {
  const current = inUse.value
  return !row.value.kept && current !== null && current.id !== shownId.value && keys.rows[current.id]!.kept ? words.card.keepsUsing(current.name, shown.value.name) : null
})
const movedHere = computed(() => (moved.value?.to === shownId.value && row.value.kept ? moved.value : null))
const otherKept = computed(() => {
  const from = movedHere.value?.from ?? null
  return from !== null && keys.rows[from]!.kept ? presetOf(from) : null
})

const model = computed(() => modelOf(shownId.value))
const modelText = computed(() => modelDraft.value ?? model.value.id)
const modelIds = computed(() => shown.value.models.map((listed) => listed.id))
// A whole listed id shows every suggestion, so another can be picked without clearing the field first.
const showsAllModels = computed(() => modelIds.value.includes(modelText.value))
const modelNote = computed(() => {
  if (model.value.price === null) return words.card.typedModel[shownId.value]
  return model.value.id === shown.value.defaultModel ? words.card.defaultModel(model.value.name) : model.value.name
})

const testLine = computed(() => {
  const test = tested.value
  if (test === null) return null
  if (test.kind === 'works') return words.card.accepted(shown.value.name)
  return test.kind === 'refused' ? words.card.refused(shown.value.name) : words.card.testFailed(test.reason)
})

watch(shownId, () => {
  typed.value = ''
  replacing.value = false
  modelDraft.value = null
  fetchLine.value = null
})

// The card follows the assistant when a sync moves it.
watch(
  () => inUse.value?.id,
  (id) => {
    if (id !== undefined) shownId.value = id
  },
)

watch(useSecretsChanged(), () => {
  keys.reread()
  // A key a sync brought for a company on screen is not a pick. A key saved here has a Test under way or a refusal, and stays on screen.
  if (row.value.kept && row.value.test === null && inUse.value !== null) shownId.value = inUse.value.id
})

function moveTo(id: ProviderId): void {
  const before = inUse.value
  const employeesReset = switchProvider(id)
  if (before?.id !== id) moved.value = { to: id, from: before !== null && keys.rows[before.id]!.kept ? before.id : null, employeesReset }
}

function pick(id: ProviderId): void {
  shownId.value = id
  if (keys.rows[id]!.kept) moveTo(id)
}

function testKey(preset: ProviderPreset): Promise<void> {
  return keys.test({ ...preset, needsKey: true })
}

/** Keeps the key whatever its Test says, since a Test can fail for being offline, and moves the assistant unless the company refused the key. */
async function save(): Promise<void> {
  const id = shownId.value
  if (!keys.save(id, typed.value)) return
  typed.value = ''
  replacing.value = false
  await testKey(presetOf(id))
  const test = keys.rows[id]!.test
  const refusedHere = test !== null && test !== 'testing' && test.kind === 'refused'
  if (!refusedHere && shownId.value === id) moveTo(id)
}

/** Removes a key at once with Undo. The assistant stays on the company it was on, and never moves to another saved key by itself. */
function remove(id: ProviderId): void {
  pinProviderInUse()
  announceRemoval(keys.forget(id))
}

async function fetchKey(): Promise<void> {
  fetching.value = true
  fetchLine.value = null
  try {
    const refusal = await props.fetchKeys()
    keys.reread()
    const kept = PROVIDER_PRESETS.find((preset) => keys.rows[preset.id]!.kept)
    if (refusal !== null) fetchLine.value = refusal
    else if (kept === undefined) fetchLine.value = words.card.fetchNone
    else if (!row.value.kept) pick(kept.id)
  } catch (failure) {
    fetchLine.value = words.card.fetchFailed(failure instanceof Error ? failure.message : String(failure))
  } finally {
    fetching.value = false
  }
}

function typeModel(text: string): void {
  modelDraft.value = text
  pickModel(shownId.value, text)
}
</script>

<template>
  <AppCard :title="words.card.title" :subtitle="assistKeyKept ? words.card.subtitleKey : words.card.subtitleNoKey" data-testid="assist-card">
    <div class="flex flex-col gap-4 px-4 pt-3 pb-4 sm:px-5 sm:pb-5" data-testid="assist-provider" :data-provider="shownId" :data-kept="row.kept">
      <div class="flex flex-col gap-1.5">
        <UFormField :label="words.card.company" :help="words.retention[shownId]">
          <USelect :model-value="shownId" :items="companies" :ui="{ itemDescription: 'whitespace-normal' }" class="w-full" data-testid="assist-provider-select" @update:model-value="pick($event)" />
        </UFormField>
        <p v-if="keepsUsing !== null" class="type-caption" data-testid="assist-keeps-using">{{ keepsUsing }}</p>
        <div v-if="movedHere !== null" role="status" class="flex flex-col gap-0.5" data-testid="assist-moved">
          <p class="type-caption">{{ words.card.nowSends(shown.name) }}</p>
          <p v-if="movedHere.employeesReset" class="type-caption" data-testid="assist-employees-reset">{{ words.card.employeesReset }}</p>
          <p v-if="otherKept !== null" class="flex flex-wrap items-center gap-x-1 type-caption" data-testid="assist-other-kept">
            {{ words.card.otherKept(otherKept.name) }}
            <UButton :label="words.card.removeIt" color="neutral" variant="link" size="sm" class="inline-target quiet-link px-0" data-testid="assist-other-forget" @click="remove(otherKept.id)" />
          </p>
        </div>
      </div>

      <ol v-if="!row.kept" class="flex list-decimal flex-col gap-1.5 ps-5 type-body" data-testid="assist-key-steps">
        <li>{{ words.card.steps.account(shown.name) }}</li>
        <li>{{ words.card.steps.credit }}</li>
        <li>{{ words.card.steps.paste }}</li>
      </ol>

      <div v-if="row.kept" class="flex flex-col gap-0.5">
        <p class="type-body" data-testid="assist-key-kept">{{ keyLine }}</p>
        <p v-if="onDrive" class="type-caption">{{ words.card.synced }}</p>
      </div>

      <p v-if="testLine !== null" role="status" class="flex items-center gap-1.5 type-body" :class="tested?.kind === 'works' ? 'text-success' : 'text-error'" data-testid="assist-key-test-result">
        <UIcon :name="tested?.kind === 'works' ? 'i-lucide-circle-check' : 'i-lucide-circle-alert'" class="size-4 shrink-0" aria-hidden="true" />
        {{ testLine }}
      </p>

      <UFormField v-if="fieldOpen" :label="words.card.yourKey">
        <UInput
          v-model="typed"
          type="password"
          autocomplete="off"
          autocapitalize="off"
          :spellcheck="false"
          :placeholder="secretWords.keyRow.placeholder"
          class="w-full"
          data-testid="assist-key"
          @keydown.enter.prevent="save"
        />
      </UFormField>

      <div class="flex flex-wrap items-center gap-2">
        <UButton
          v-if="fieldOpen"
          icon="i-lucide-key-round"
          :label="secretWords.keyRow.save"
          color="neutral"
          variant="outline"
          size="sm"
          :disabled="typed.trim() === ''"
          data-testid="assist-key-save"
          @click="save"
        />
        <UButton
          v-if="row.kept"
          icon="i-lucide-plug-zap"
          :label="secretWords.keyRow.test"
          color="neutral"
          variant="outline"
          size="sm"
          :loading="row.test === 'testing'"
          :disabled="row.test === 'testing'"
          data-testid="assist-key-test"
          @click="testKey(shown)"
        />
        <UButton
          v-if="row.kept && !fieldOpen"
          :label="words.card.replace"
          icon="i-lucide-replace"
          color="neutral"
          variant="outline"
          size="sm"
          data-testid="assist-key-replace"
          @click="replacing = true"
        />
        <UButton v-if="replacing && !refused" :label="words.card.keepKey" color="neutral" variant="ghost" size="sm" data-testid="assist-key-keep" @click="replacing = false" />
        <UButton v-if="row.kept" icon="i-lucide-trash-2" :label="secretWords.keyRow.forget" color="neutral" variant="ghost" size="sm" data-testid="assist-key-forget" @click="remove(shownId)" />
        <UButton
          v-if="fieldOpen"
          :to="shown.keyAddress"
          target="_blank"
          rel="noopener noreferrer"
          trailing-icon="i-lucide-external-link"
          :label="words.card.getKey"
          color="neutral"
          variant="link"
          size="sm"
          data-testid="assist-get-key"
        />
      </div>

      <p v-if="!row.kept" class="type-caption">{{ words.card.pay(shown.name) }}</p>

      <div v-if="!row.kept && onDrive" class="flex flex-col gap-1" data-testid="assist-fetch">
        <p class="flex flex-wrap items-center gap-x-1 type-caption">
          {{ words.card.fetchAsk }}
          <UButton :label="words.card.fetch" color="neutral" variant="link" size="sm" class="inline-target quiet-link px-0" :loading="fetching" data-testid="assist-fetch-key" @click="fetchKey" />
        </p>
        <p v-if="fetchLine !== null" role="status" class="type-caption" data-testid="assist-fetch-line">{{ fetchLine }}</p>
      </div>

      <UFormField v-if="row.kept" :label="words.card.model" :help="modelNote" :error="turnsOnWebSearch(modelText) ? words.card.searchesWeb : false">
        <UInputMenu
          mode="autocomplete"
          :model-value="modelText"
          :items="modelIds"
          :ignore-filter="showsAllModels"
          :placeholder="shown.defaultModel"
          open-on-click
          autocomplete="off"
          autocapitalize="off"
          :spellcheck="false"
          class="w-full"
          data-testid="assist-model"
          @update:model-value="typeModel(String($event ?? ''))"
          @focusout="modelDraft = null"
        />
      </UFormField>

      <section v-if="row.kept && apps.length > 0" class="flex flex-col gap-2 border-t border-default pt-3" :aria-label="words.card.inApps">
        <h3 class="type-label">{{ words.card.inApps }}</h3>
        <ul class="flex flex-col gap-1">
          <li v-for="app in apps" :key="app.id" class="flex flex-wrap items-center justify-between gap-x-3" data-testid="assist-app" :data-app="app.id">
            <span class="type-body text-highlighted">{{ app.name }}</span>
            <span class="flex flex-wrap items-center gap-x-2">
              <span class="type-caption" data-testid="assist-app-state">{{ assistOn(app.id) ? words.card.sendsFreely : words.card.asksFirst }}</span>
              <UButton
                :to="app.to"
                :label="words.card.settings"
                :aria-label="`${app.name}: ${words.card.settings}`"
                trailing-icon="i-lucide-arrow-right"
                color="neutral"
                variant="link"
                size="sm"
                class="px-0"
                data-testid="assist-app-link"
              />
            </span>
          </li>
        </ul>
      </section>
    </div>
  </AppCard>
</template>
