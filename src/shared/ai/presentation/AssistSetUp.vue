<script setup lang="ts">
import { computed, ref } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import USwitch from '@nuxt/ui/components/Switch.vue'

import { useKeyUndo } from '../../secrets/presentation/useKeyUndo'
import { words as secretWords } from '../../secrets/presentation/words'
import { listInWords } from '../../text/listInWords'
import { switchAssist } from '../application/assistSettings'
import { presetOf } from '../domain/providerPresets'
import AssistKeyForm from './AssistKeyForm.vue'
import AssistKeyTestLine from './AssistKeyTestLine.vue'
import { useAssistantCard } from './useAssistantCard'
import { words } from './words'

/**
 * The welcome's walk-through to one working key, by the same rules as Kuna settings' card. Once the company accepts the key it
 * says what that opens and asks the one consent, which sends without asking in the apps named here, only if the person turns it on.
 */
const props = defineProps<{
  /** The apps the person picked whose assistant can send something. */
  apps: readonly { readonly id: string; readonly name: string }[]
}>()

const emit = defineEmits<{ back: []; done: [] }>()

const assistant = useAssistantCard(useKeyUndo())
const { shownId, shown, row, trying, testWorks, testLine, companies, testKey } = assistant

// A company that cannot read documents stays out unless it is already the one picked, which the select must still be able to show.
const offered = computed(() => companies.value.filter((company) => presetOf(company.value).readsPdf || company.value === shownId.value))
const accepted = computed(() => row.value.kept && testWorks.value)

const sendsFreely = ref(false)
const consentNote = computed(() => `${words.setUp.forApps(listInWords(props.apps.map((app) => app.name)))} ${words.appCard.switchNote}`)

function finish(): void {
  if (sendsFreely.value) props.apps.forEach((app) => switchAssist(app.id, true))
  emit('done')
}
</script>

<template>
  <div class="flex flex-col gap-4 px-4 pt-3 pb-5 sm:px-5" data-testid="assist-set-up" :data-provider="shownId">
    <template v-if="accepted">
      <AssistKeyTestLine :line="testLine ?? ''" works />
      <p class="type-body" data-testid="assist-set-up-chat">{{ words.setUp.chat }}</p>
      <div class="flex flex-col gap-3 border-t border-default pt-4" data-testid="assist-set-up-consent">
        <div class="flex flex-col gap-1 type-caption">
          <p>{{ words.setUp.sends }}</p>
          <p>{{ words.retention[shownId] }}</p>
        </div>
        <USwitch v-if="apps.length > 0" v-model="sendsFreely" :label="words.appCard.switch" :description="consentNote" data-testid="assist-set-up-switch" />
      </div>
    </template>
    <AssistKeyForm v-else :assistant="assistant" :companies="offered">
      <template #actions>
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
      </template>
    </AssistKeyForm>

    <div class="flex flex-wrap items-center justify-between gap-2 border-t border-default pt-4">
      <UButton
        v-if="!row.kept"
        :label="words.setUp.back"
        icon="i-lucide-arrow-left"
        color="neutral"
        variant="ghost"
        size="sm"
        :disabled="trying"
        data-testid="assist-set-up-back"
        @click="emit('back')"
      />
      <UButton v-if="!row.kept" :label="words.setUp.later" color="neutral" variant="ghost" size="sm" :disabled="trying" class="ms-auto" data-testid="assist-set-up-later" @click="emit('done')" />
      <UButton v-else :label="words.setUp.continue" trailing-icon="i-lucide-arrow-right" class="ms-auto" data-testid="assist-set-up-continue" @click="finish" />
    </div>
  </div>
</template>
