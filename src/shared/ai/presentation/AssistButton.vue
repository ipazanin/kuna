<script setup lang="ts">
import { computed, ref } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import type { AssistTaskSummary } from '../../app/appContribution'
import { assistOn, switchAssist } from '../application/assistSettings'
import AssistConsent from './AssistConsent.vue'
import { allowOnce, anonymisingNow, assistKeyKept, forgetOnce, providerInUse } from './useAiTask'

/**
 * An app's button for one assist task, shown only while a key is kept for the provider in use. While the app asks first,
 * each tap asks. A yes sends once, and Send, don't ask again turns on the app's switch.
 */
const props = withDefaults(
  defineProps<{
    app: string
    task: AssistTaskSummary
    label: string
    icon?: string
    loading?: boolean
    /** True when this run would send rows about employees or their pay, which the dialog says while Anonymise is off. */
    sendsEmployees?: boolean
  }>(),
  { icon: 'i-lucide-sparkles', loading: false, sendsEmployees: false },
)

const emit = defineEmits<{ run: [] }>()

const provider = computed(() => providerInUse())
const asking = ref(false)

/** A press of the button. A screen's Try again calls it too, so a retry asks as the first send did. */
function tap(): void {
  forgetOnce(props.task.id)
  if (!assistOn(props.app)) asking.value = true
  else emit('run')
}

function sendOnce(): void {
  allowOnce(props.task.id)
  asking.value = false
  emit('run')
}

function dontAskAgain(): void {
  switchAssist(props.app, true)
  asking.value = false
  emit('run')
}

defineExpose({ tap })
</script>

<template>
  <template v-if="assistKeyKept && provider">
    <UButton :label="label" :icon="icon" color="neutral" variant="outline" size="sm" :loading="loading" :disabled="loading" :data-testid="`assist-${task.id}`" @click="tap" />
    <AssistConsent v-if="asking" v-model:open="asking" :task="task" :provider="provider" :sends-employees="sendsEmployees && !anonymisingNow()" @once="sendOnce" @always="dontAskAgain" />
  </template>
</template>
