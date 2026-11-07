<script setup lang="ts">
import { computed } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import USwitch from '@nuxt/ui/components/Switch.vue'

import type { AssistTaskSummary } from '../../app/appContribution'
import { KUNA_SETTINGS_ROUTE } from '../../secrets/presentation/pageSecrets'
import { listInWords } from '../../text/listInWords'
import AppCard from '../../ui/AppCard.vue'
import { assistOn, employeesOn, switchAssist, switchEmployees } from '../application/assistSettings'
import { assistKeyKept, providerInUse } from './useAiTask'
import { words } from './words'

/**
 * An app's Assistant tab: whether it sends without asking, what each task sends, and each task's employee switch, which
 * shows while the app sends without asking and always while its yes is on, so a yes can be seen and taken back. It
 * reads and writes the choices in `assistSettings` and holds none. With no key it only says what the assistant could do here.
 */
const props = defineProps<{
  app: string
  tasks: readonly AssistTaskSummary[]
}>()

const provider = computed(() => (assistKeyKept.value ? providerInUse() : null))
const taskTitles = computed(() => listInWords(props.tasks.map((task) => task.title)))
const sendsFreely = computed(() => assistOn(props.app))
</script>

<template>
  <AppCard :title="words.card.title" :subtitle="provider === null ? words.appCard.canHelp(taskTitles) : words.appCard.uses(provider.name)" data-testid="app-assist-card" :data-app="app">
    <div v-if="provider === null" class="px-4 pt-3 pb-4 sm:px-5 sm:pb-5">
      <UButton :to="KUNA_SETTINGS_ROUTE" :label="words.appCard.addKey" trailing-icon="i-lucide-arrow-right" color="neutral" variant="outline" size="sm" data-testid="assist-add-key" />
    </div>
    <div v-else class="flex flex-col gap-3 px-4 pt-3 pb-4 sm:px-5 sm:pb-5">
      <USwitch :model-value="sendsFreely" :label="words.appCard.switch" :description="words.appCard.switchNote" :data-testid="`assist-switch-${app}`" @update:model-value="switchAssist(app, $event)" />
      <ul class="flex flex-col gap-3">
        <li v-for="task in tasks" :key="task.id" class="flex flex-col gap-1.5 border-t border-default pt-3" data-testid="assist-task">
          <p class="type-body text-highlighted">{{ task.title }}</p>
          <p class="type-caption">{{ words.consent.sends(task.sends) }}</p>
          <USwitch
            v-if="task.employees && (sendsFreely || employeesOn(task.id))"
            :model-value="employeesOn(task.id)"
            :label="task.employees.label"
            :description="task.employees.note(provider.name)"
            :data-testid="`assist-employees-${task.id}`"
            @update:model-value="switchEmployees(task.id, $event)"
          />
        </li>
      </ul>
    </div>
  </AppCard>
</template>
