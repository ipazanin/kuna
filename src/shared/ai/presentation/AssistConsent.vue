<script setup lang="ts">
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'

import type { AssistTaskSummary } from '../../app/appContribution'
import AppDialog from '../../ui/AppDialog.vue'
import type { ProviderPreset } from '../infrastructure/providerPresets'
import { words } from './words'

/** Asks before a task first sends anything: what leaves the device, what the provider keeps, and the switch it turns on. */
const open = defineModel<boolean>('open', { required: true })

defineProps<{
  task: AssistTaskSummary
  appName: string
  provider: ProviderPreset
  /** Which switch the run waits for: the app's, or the task's own for employee data. */
  asks: 'app' | 'employees'
}>()

const emit = defineEmits<{ confirm: [] }>()
</script>

<template>
  <AppDialog v-model:open="open" :title="task.title" :description="words.consent.sends(task.sends)">
    <div class="flex flex-col gap-3" data-testid="assist-consent">
      <p class="type-body">{{ words.retention[provider.id] }}</p>
      <UAlert v-if="asks === 'employees' && task.employees" color="warning" variant="subtle" icon="i-lucide-users" :title="task.employees.warning(provider.name)" />
    </div>
    <template #end>
      <UButton :label="words.consent.cancel" color="neutral" variant="outline" @click="open = false" />
      <UButton
        :label="asks === 'employees' && task.employees ? task.employees.label : words.consent.switchOn(appName)"
        icon="i-lucide-sparkles"
        data-testid="assist-consent-confirm"
        @click="emit('confirm')"
      />
    </template>
  </AppDialog>
</template>
