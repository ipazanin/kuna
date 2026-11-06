<script setup lang="ts">
import { computed, ref } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import type { AssistTaskSummary } from '../../app/appContribution'
import { assistOn, employeesOn, switchAssist, switchEmployees } from '../infrastructure/assistSettings'
import AssistConsent from './AssistConsent.vue'
import { assistKeyKept, pinProviderInUse, providerInUse } from './useAiTask'

/**
 * An app's button for one assist task, shown only while a key is kept for the provider in use. While a switch the run
 * needs is off, the tap asks first, and Run follows only once the person said yes.
 */
const props = withDefaults(
  defineProps<{
    app: string
    appName: string
    task: AssistTaskSummary
    label: string
    icon?: string
    loading?: boolean
    /** True when this run would send employee names or pay, which the task's own switch must allow. */
    sendsEmployees?: boolean
  }>(),
  { icon: 'i-lucide-sparkles', loading: false, sendsEmployees: false },
)

const emit = defineEmits<{ run: [] }>()

const provider = computed(() => providerInUse())
const asking = ref<'app' | 'employees' | null>(null)
const consentOpen = computed({
  get: () => asking.value !== null,
  set: (open) => {
    if (!open) asking.value = null
  },
})

function waitsFor(): 'app' | 'employees' | null {
  if (!assistOn(props.app)) return 'app'
  return props.sendsEmployees && !employeesOn(props.task.id) ? 'employees' : null
}

function tap(): void {
  pinProviderInUse()
  asking.value = waitsFor()
  if (asking.value === null) emit('run')
}

function confirm(): void {
  if (asking.value === 'app') switchAssist(props.app, true)
  if (asking.value === 'employees') switchEmployees(props.task.id, true)
  tap()
}
</script>

<template>
  <template v-if="assistKeyKept && provider">
    <UButton :label="label" :icon="icon" color="neutral" variant="outline" size="sm" :loading="loading" :disabled="loading" :data-testid="`assist-${task.id}`" @click="tap" />
    <AssistConsent v-if="asking" v-model:open="consentOpen" :task="task" :app-name="appName" :provider="provider" :asks="asking" @confirm="confirm" />
  </template>
</template>
