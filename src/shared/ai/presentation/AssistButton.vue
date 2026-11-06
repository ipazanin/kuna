<script setup lang="ts">
import { computed, ref } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import type { AssistTaskSummary } from '../../app/appContribution'
import { assistOn, employeesOn, switchAssist, switchEmployees } from '../infrastructure/assistSettings'
import AssistConsent from './AssistConsent.vue'
import { allowOnce, assistKeyKept, forgetOnce, providerInUse } from './useAiTask'

/**
 * An app's button for one assist task, shown only while a key is kept for the provider in use. While a switch the run
 * needs is off, each tap asks. A yes sends once, and Don't ask again turns on what this run needed.
 */
const props = withDefaults(
  defineProps<{
    app: string
    task: AssistTaskSummary
    label: string
    icon?: string
    loading?: boolean
    /** True when this run would send employee names or pay, which the dialog then says, whatever the switches say. */
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
  if (!assistOn(props.app) || (props.sendsEmployees && !employeesOn(props.task.id))) asking.value = true
  else emit('run')
}

function sendOnce(): void {
  allowOnce(props.task.id)
  asking.value = false
  emit('run')
}

function dontAskAgain(): void {
  switchAssist(props.app, true)
  if (props.sendsEmployees) switchEmployees(props.task.id, true)
  asking.value = false
  emit('run')
}

defineExpose({ tap })
</script>

<template>
  <template v-if="assistKeyKept && provider">
    <UButton :label="label" :icon="icon" color="neutral" variant="outline" size="sm" :loading="loading" :disabled="loading" :data-testid="`assist-${task.id}`" @click="tap" />
    <AssistConsent v-if="asking" v-model:open="asking" :task="task" :provider="provider" :sends-employees="sendsEmployees" @once="sendOnce" @always="dontAskAgain" />
  </template>
</template>
