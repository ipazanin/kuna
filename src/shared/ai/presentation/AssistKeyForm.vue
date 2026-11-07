<script setup lang="ts">
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import USelect from '@nuxt/ui/components/Select.vue'

import { words as secretWords } from '../../secrets/presentation/words'
import AssistKeyTestLine from './AssistKeyTestLine.vue'
import type { AssistantCard } from './useAssistantCard'
import { words } from './words'

/** One AI company and its key, for Kuna settings' card and the welcome's walk-through: the steps for someone with no key, the field, and what the test said. `useAssistantCard` holds the rules. */
const props = defineProps<{
  assistant: AssistantCard
  companies: AssistantCard['companies']['value']
}>()

const { shownId, shown, row, typed, trying, testWorks, fieldOpen, testLine, pick, save } = props.assistant
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <UFormField :label="words.card.company" :help="words.retention[shownId]">
      <USelect :model-value="shownId" :items="companies" :ui="{ itemDescription: 'whitespace-normal' }" class="w-full" data-testid="assist-provider-select" @update:model-value="pick($event)" />
    </UFormField>
    <slot name="company" />
  </div>

  <ol v-if="!row.kept" class="flex list-decimal flex-col gap-1.5 ps-5 type-body" data-testid="assist-key-steps">
    <li>{{ words.card.steps.account(shown.name) }}</li>
    <li>{{ words.card.steps.credit }}</li>
    <li>{{ words.card.steps.paste }}</li>
  </ol>

  <slot name="kept" />

  <AssistKeyTestLine v-if="testLine !== null" :line="testLine" :works="testWorks" />

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
    <slot name="actions" />
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
</template>
