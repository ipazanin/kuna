<script setup lang="ts">
import { computed } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import UInputMenu from '@nuxt/ui/components/InputMenu.vue'
import USelect from '@nuxt/ui/components/Select.vue'

import { useKeyUndo } from '../../secrets/presentation/useKeyUndo'
import { words as secretWords } from '../../secrets/presentation/words'
import AppCard from '../../ui/AppCard.vue'
import { assistOn } from '../infrastructure/assistSettings'
import { turnsOnWebSearch } from '../infrastructure/providerPresets'
import { assistKeyKept } from './useAiTask'
import { useAssistantCard } from './useAssistantCard'
import { words } from './words'

/** Kuna settings' assistant: one company at a time, its key and its model, and a line per app with a link to that app's own switches. `useAssistantCard` holds its rules. */
const props = defineProps<{
  apps: readonly { readonly id: string; readonly name: string; readonly to: RouteLocationRaw }[]
  /** Whether some app's file on Drive has a sync that carries the keys. */
  keysSync: boolean
  /** Asks Google for the keys another browser saved, and says why they could not be read, or null. */
  fetchKeys: () => Promise<string | null>
}>()

const {
  shownId,
  shown,
  row,
  tested,
  typed,
  replacing,
  trying,
  typedRefused,
  fieldOpen,
  testLine,
  companies,
  keepsUsing,
  movedHere,
  otherKept,
  savedAsideLines,
  modelDraft,
  modelText,
  modelNote,
  fetching,
  fetchLine,
  pick,
  save,
  stopReplacing,
  remove,
  fetchKey,
  typeModel,
  testKey,
} = useAssistantCard({ fetchKeys: props.fetchKeys, announce: useKeyUndo() })

const keyLine = computed(() => (row.value.ending === null ? secretWords.keyRow.kept : secretWords.keyRow.keptEnding(row.value.ending)))
const modelIds = computed(() => shown.value.models.map((listed) => listed.id))
// A whole listed id shows every suggestion, so another can be picked without clearing the field first.
const showsAllModels = computed(() => modelIds.value.includes(modelText.value))
</script>

<template>
  <AppCard :title="words.card.title" :subtitle="assistKeyKept ? words.card.subtitleKey : words.card.subtitleNoKey" data-testid="assist-card">
    <div class="flex flex-col gap-4 px-4 pt-3 pb-4 sm:px-5 sm:pb-5" data-testid="assist-provider" :data-provider="shownId" :data-kept="row.kept">
      <div class="flex flex-col gap-1.5">
        <UFormField :label="words.card.company" :help="words.retention[shownId]">
          <USelect :model-value="shownId" :items="companies" :ui="{ itemDescription: 'whitespace-normal' }" class="w-full" data-testid="assist-provider-select" @update:model-value="pick($event)" />
        </UFormField>
        <p v-if="keepsUsing !== null" class="type-caption" data-testid="assist-keeps-using">{{ keepsUsing }}</p>
        <div v-if="savedAsideLines.length > 0" role="status" class="flex flex-col gap-0.5" data-testid="assist-saved-aside">
          <p v-for="line in savedAsideLines" :key="line" class="type-caption">{{ line }}</p>
        </div>
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
        <p v-if="keysSync" class="type-caption" data-testid="assist-key-synced">{{ words.card.synced }}</p>
      </div>

      <p
        v-if="testLine !== null"
        role="status"
        class="flex items-center gap-1.5 type-body"
        :class="tested?.kind === 'works' && !typedRefused ? 'text-success' : 'text-error'"
        data-testid="assist-key-test-result"
      >
        <UIcon :name="tested?.kind === 'works' && !typedRefused ? 'i-lucide-circle-check' : 'i-lucide-circle-alert'" class="size-4 shrink-0" aria-hidden="true" />
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
          :loading="trying"
          :disabled="trying || typed.trim() === ''"
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
        <UButton v-if="replacing" :label="words.card.keepKey" color="neutral" variant="ghost" size="sm" data-testid="assist-key-keep" @click="stopReplacing" />
        <UButton
          v-if="row.kept"
          icon="i-lucide-trash-2"
          :label="secretWords.keyRow.forget"
          color="neutral"
          variant="ghost"
          size="sm"
          :disabled="trying || row.test === 'testing'"
          data-testid="assist-key-forget"
          @click="remove(shownId)"
        />
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

      <div v-if="!row.kept && keysSync" class="flex flex-col gap-1" data-testid="assist-fetch">
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
