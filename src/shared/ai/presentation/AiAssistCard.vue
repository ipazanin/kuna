<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import UBadge from '@nuxt/ui/components/Badge.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import UInputMenu from '@nuxt/ui/components/InputMenu.vue'
import USwitch from '@nuxt/ui/components/Switch.vue'

import type { AppAssist } from '../../app/appContribution'
import { PAGE_SECRET_STORE, useSecretsChanged } from '../../secrets/presentation/pageSecrets'
import { useSecretRows } from '../../secrets/presentation/useSecretRows'
import { words as secretWords } from '../../secrets/presentation/words'
import AppCard from '../../ui/AppCard.vue'
import FormGrid from '../../ui/FormGrid.vue'
import { assistOn, employeesOn, modelOf, pickModel, pickProvider, switchAssist, switchEmployees } from '../infrastructure/assistSettings'
import { testProviderKey } from '../infrastructure/modelAccess'
import { PROVIDER_PRESETS, turnsOnWebSearch } from '../infrastructure/providerPresets'
import type { KeyTest, ModelChoice, ProviderId, ProviderPreset } from '../infrastructure/providerPresets'
import { providerInUse } from './useAiTask'
import { words } from './words'

/**
 * Kuna settings' Assistant: one row per provider with its key in this browser, its model and whether it is the one in
 * use, then one switch per app that has an assistant, each with what its tasks send and a switch for each task that can
 * send employee data. The keys sync through the Google account while some app's file is on Drive, and the switches and
 * models stay on this device.
 */
const props = defineProps<{
  apps: readonly { readonly id: string; readonly name: string; readonly assist: AppAssist }[]
  /** Whether some app's file is on Drive, so a sync carries the keys. */
  onDrive: boolean
}>()

const keys = useSecretRows(
  PROVIDER_PRESETS.map((preset) => ({ ...preset, needsKey: true })),
  PAGE_SECRET_STORE,
  (preset, key): Promise<KeyTest> => testProviderKey(preset, key ?? ''),
)
watch(useSecretsChanged(), () => keys.reread())
/** What is typed in each key field, which goes nowhere until Save. */
const typed = reactive<Record<string, string>>(Object.fromEntries(PROVIDER_PRESETS.map((preset) => [preset.id, ''])))

function save(preset: ProviderPreset): void {
  if (keys.save(preset.id, typed[preset.id] ?? '')) typed[preset.id] = ''
}

/** What each model field holds while it has focus, which may be empty while the stored model falls back to the default. */
const modelDrafts = reactive<Partial<Record<ProviderId, string>>>({})

function typeModel(id: ProviderId, text: string): void {
  modelDrafts[id] = text
  pickModel(id, text)
}

function settleModel(id: ProviderId): void {
  delete modelDrafts[id]
}

function modelNote(preset: ProviderPreset, model: ModelChoice): string {
  if (model.price === null) return words.card.typedModel[preset.id]
  return model.id === preset.defaultModel ? words.card.defaultModel(model.name) : model.name
}

const inUse = computed(() => providerInUse()?.id ?? null)

const providerRows = computed(() =>
  PROVIDER_PRESETS.map((preset) => {
    const { kept, ending, test } = keys.rows[preset.id]!
    const tested = test === null || test === 'testing' ? null : test
    const model = modelOf(preset.id)
    const modelText = modelDrafts[preset.id] ?? model.id
    return {
      preset,
      kept,
      inUse: inUse.value === preset.id,
      keyLine: !kept ? secretWords.keyRow.noKey : ending === null ? secretWords.keyRow.kept : secretWords.keyRow.keptEnding(ending),
      modelText,
      modelIds: preset.models.map((listed) => listed.id),
      // A whole listed id shows every suggestion, so another can be picked without clearing the field first.
      showsAllModels: preset.models.some((listed) => listed.id === modelText),
      modelNote: modelNote(preset, model),
      modelRefusal: turnsOnWebSearch(modelText) ? words.card.searchesWeb : false,
      testing: test === 'testing',
      testWorks: tested?.kind === 'works',
      testLine: tested === null ? null : tested.kind === 'works' ? secretWords.keyRow.works : tested.kind === 'refused' ? words.card.refused(preset.name) : words.card.testFailed(tested.reason),
    }
  }),
)

const providerName = computed(() => providerInUse()?.name ?? PROVIDER_PRESETS[0]!.name)
</script>

<template>
  <AppCard :title="words.card.title" :subtitle="onDrive ? words.card.subtitleOnDrive : words.card.subtitle" data-testid="assist-card">
    <div class="flex flex-col gap-3 px-4 pt-3 pb-4 sm:px-5 sm:pb-5">
      <div
        v-for="row in providerRows"
        :key="row.preset.id"
        class="flex flex-col gap-3 border-t border-default pt-3 first:border-t-0 first:pt-0"
        data-testid="assist-provider"
        :data-provider="row.preset.id"
        :data-kept="row.kept"
        :data-in-use="row.inUse"
      >
        <div class="flex flex-col gap-0.5">
          <p class="flex items-center gap-2 type-body text-highlighted">
            {{ row.preset.name }}
            <UBadge v-if="row.inUse && row.kept" :label="words.card.inUse" color="primary" variant="subtle" size="sm" data-testid="assist-in-use" />
          </p>
          <p class="type-caption">{{ words.retention[row.preset.id] }}</p>
          <p class="type-caption" data-testid="assist-key-kept">{{ row.keyLine }}</p>
        </div>
        <FormGrid>
          <UFormField :label="words.card.key(row.preset.name)">
            <UInput
              v-model="typed[row.preset.id]"
              type="password"
              autocomplete="off"
              autocapitalize="off"
              :spellcheck="false"
              :placeholder="secretWords.keyRow.placeholder"
              class="w-full"
              data-testid="assist-key"
              @keydown.enter.prevent="save(row.preset)"
            />
          </UFormField>
          <UFormField :label="words.card.model" :help="row.modelNote" :error="row.modelRefusal">
            <UInputMenu
              mode="autocomplete"
              :model-value="row.modelText"
              :items="row.modelIds"
              :ignore-filter="row.showsAllModels"
              :placeholder="row.preset.defaultModel"
              open-on-click
              autocomplete="off"
              autocapitalize="off"
              :spellcheck="false"
              class="w-full"
              data-testid="assist-model"
              @update:model-value="typeModel(row.preset.id, String($event ?? ''))"
              @focusout="settleModel(row.preset.id)"
            />
          </UFormField>
        </FormGrid>
        <div class="flex flex-wrap items-center gap-2">
          <UButton
            icon="i-lucide-key-round"
            :label="secretWords.keyRow.save"
            color="neutral"
            variant="outline"
            size="sm"
            :disabled="(typed[row.preset.id] ?? '').trim() === ''"
            data-testid="assist-key-save"
            @click="save(row.preset)"
          />
          <UButton
            icon="i-lucide-plug-zap"
            :label="secretWords.keyRow.test"
            color="neutral"
            variant="outline"
            size="sm"
            :loading="row.testing"
            :disabled="!row.kept || row.testing"
            data-testid="assist-key-test"
            @click="keys.test({ ...row.preset, needsKey: true })"
          />
          <UButton
            v-if="row.kept"
            icon="i-lucide-trash-2"
            :label="secretWords.keyRow.forget"
            color="neutral"
            variant="ghost"
            size="sm"
            data-testid="assist-key-forget"
            @click="keys.forget(row.preset.id)"
          />
          <UButton
            v-if="row.kept && !row.inUse"
            icon="i-lucide-circle-check"
            :label="words.card.use"
            color="neutral"
            variant="outline"
            size="sm"
            data-testid="assist-use"
            @click="pickProvider(row.preset.id)"
          />
          <UButton :to="row.preset.keyAddress" target="_blank" rel="noopener noreferrer" trailing-icon="i-lucide-external-link" :label="words.card.getKey" color="neutral" variant="link" size="sm" />
        </div>
        <p v-if="row.testLine !== null" role="status" class="flex items-center gap-1.5 type-body" :class="row.testWorks ? 'text-success' : 'text-error'" data-testid="assist-key-test-result">
          <UIcon :name="row.testWorks ? 'i-lucide-circle-check' : 'i-lucide-circle-alert'" class="size-4 shrink-0" aria-hidden="true" />
          {{ row.testLine }}
        </p>
      </div>

      <section v-if="props.apps.length > 0" class="flex flex-col gap-3 border-t border-default pt-3" :aria-label="words.card.apps">
        <h3 class="text-xs font-medium text-muted">{{ words.card.apps }}</h3>
        <div v-for="app in props.apps" :key="app.id" class="flex flex-col gap-2" data-testid="assist-app" :data-app="app.id">
          <USwitch :model-value="assistOn(app.id)" :label="app.name" :data-testid="`assist-switch-${app.id}`" @update:model-value="switchAssist(app.id, $event)" />
          <ul class="flex flex-col gap-2 ps-12">
            <li v-for="task in app.assist.tasks()" :key="task.id" class="flex flex-col gap-1.5">
              <p class="type-body text-highlighted">{{ task.title }}</p>
              <p class="type-caption">{{ words.consent.sends(task.sends) }}</p>
              <USwitch
                v-if="task.employees"
                :model-value="employeesOn(task.id)"
                :label="task.employees.label"
                :description="task.employees.warning(providerName)"
                :disabled="!assistOn(app.id)"
                :data-testid="`assist-employees-${task.id}`"
                @update:model-value="switchEmployees(task.id, $event)"
              />
            </li>
          </ul>
        </div>
      </section>
    </div>
  </AppCard>
</template>
