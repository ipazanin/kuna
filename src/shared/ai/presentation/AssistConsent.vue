<script setup lang="ts">
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'

import type { AssistTaskSummary } from '../../app/appContribution'
import AppDialog from '../../ui/AppDialog.vue'
import type { ProviderPreset } from '../infrastructure/providerPresets'
import { words } from './words'

/** Asks before a task sends with a switch off: what leaves the device, what the provider keeps, and employee names or pay whenever this run sends them. Buttons outside the chat need it until they route through the chat. */
const open = defineModel<boolean>('open', { required: true })

withDefaults(
  defineProps<{
    task: AssistTaskSummary
    provider: ProviderPreset
    sendsEmployees: boolean
    /** False where no switch shows that could take Don't ask again back. */
    offersAlways?: boolean
  }>(),
  { offersAlways: true },
)

const emit = defineEmits<{ once: []; always: [] }>()
</script>

<template>
  <AppDialog v-model:open="open" :title="words.consent.title(provider.name)" :description="words.consent.sends(task.sends)">
    <div class="flex flex-col gap-3" data-testid="assist-consent">
      <p class="type-label">{{ task.title }}</p>
      <p class="type-body">{{ words.retention[provider.id] }}</p>
      <UAlert v-if="sendsEmployees && task.employees" color="neutral" variant="subtle" icon="i-lucide-info" :title="task.employees.goes(provider.name)" data-testid="assist-consent-employees" />
    </div>
    <template #end>
      <UButton :label="words.consent.cancel" color="neutral" variant="outline" @click="open = false" />
      <UButton v-if="offersAlways" :label="words.consent.dontAsk" color="neutral" variant="outline" data-testid="assist-consent-always" @click="emit('always')" />
      <UButton :label="words.consent.sendOnce" icon="i-lucide-sparkles" data-testid="assist-consent-confirm" @click="emit('once')" />
    </template>
  </AppDialog>
</template>
