<script setup lang="ts">
import { computed, ref } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import URadioGroup from '@nuxt/ui/components/RadioGroup.vue'

import { useLoansBooks } from '../../workbook/application/loansStore'
import { newLoansFileContents } from '../../workbook/presentation/loansFile'
import StepCard from './StepCard.vue'
import { useLoansStart } from './useLoansStart'

type LoansHome = 'drive' | 'browser' | 'open'

/** Where the Loans file lives. A file kept in this browser is made here, since it needs nothing from Google. */
const start = useLoansStart()
const store = useLoansBooks()

const CHOICES: { label: string; description: string; value: LoansHome }[] = [
  { label: 'A new file on Google Drive', description: 'One file you open on your phone and computer. Backed up daily.', value: 'drive' },
  { label: 'A new file in this browser', description: 'No Google. One device. Export to keep a copy.', value: 'browser' },
  { label: 'My file on Google Drive', description: 'Another device already keeps it.', value: 'open' },
]

const chosen = ref<LoansHome>('drive')
const starting = ref(false)
const failure = ref<string | null>(null)

/** Opening another file lets go of the one kept in this browser, which a new file would carry along. */
const dropsBrowserFile = computed(() => chosen.value === 'open' && store.state.choice?.source === 'browser')

async function proceed(): Promise<void> {
  if (chosen.value === 'drive') {
    await start.go('folder')
    return
  }
  if (chosen.value === 'open') {
    await start.go('find')
    return
  }
  starting.value = true
  failure.value = null
  await store.replaceLocalWorkbook(newLoansFileContents(store), 'Loans file')
  starting.value = false
  if (store.state.status === 'error') {
    failure.value = store.state.error
    return
  }
  await start.finish()
}
</script>

<template>
  <StepCard title="Where the Loans file lives">
    <URadioGroup v-model="chosen" :items="CHOICES" legend="Where the Loans file lives" variant="card" :ui="{ legend: 'sr-only', fieldset: 'gap-2' }" data-testid="loans-start-home" />
    <UAlert
      v-if="dropsBrowserFile"
      icon="i-lucide-triangle-alert"
      color="warning"
      variant="subtle"
      title="The Loans file in this browser is deleted when the one on Drive opens"
      description="It exists only here and in the files you exported. Export it first if you want to keep it."
    />
    <UAlert v-if="failure" icon="i-lucide-triangle-alert" color="error" variant="subtle" title="The Loans file was not made" :description="failure" />
    <template #actions>
      <UButton label="Continue" trailing-icon="i-lucide-arrow-right" :loading="starting" data-testid="loans-start-continue" @click="proceed" />
    </template>
  </StepCard>
</template>
