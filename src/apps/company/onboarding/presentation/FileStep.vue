<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFileUpload from '@nuxt/ui/components/FileUpload.vue'

import StepCard from '../../../../shared/ui/StepCard.vue'
import ImportSummary from '../../workbook-files/presentation/ImportSummary.vue'
import { useImportPreview } from '../../workbook-files/presentation/useImportPreview'
import { useWorkbook } from '../../workbook/application/workbookStore'
import { WORKBOOK_FILE_TYPES } from '../../workbook/presentation/workbookFiles'
import { useOnboarding } from './useOnboarding'
import { words } from './words'

/**
 * The file brought along as books: what it holds and what the app could not use, as Open a file shows
 * it. Kept in this browser it becomes the books here. For Drive it is held for the folder step.
 */
const onboarding = useOnboarding()
const store = useWorkbook()

const picked = ref<File | null>(null)
const { preview, failure, failureDetail } = useImportPreview(picked)
watch(preview, (read) => {
  if (read !== null) onboarding.hold(read)
})

const held = computed(() => onboarding.heldFile.value)
const keepable = computed(() => held.value !== null && held.value.summary.refusal === null)
const inBrowser = computed(() => onboarding.place.value.home === 'browser')
const keeping = ref(false)
const keepFailure = ref<string | null>(null)

function another(): void {
  picked.value = null
  onboarding.hold(null)
}

async function proceed(): Promise<void> {
  const file = held.value
  if (file === null || file.summary.refusal !== null) return
  if (!inBrowser.value) {
    await onboarding.next()
    return
  }
  keeping.value = true
  keepFailure.value = null
  await store.replaceLocalWorkbook(file.document, file.title)
  keeping.value = false
  if (store.state.status === 'error') {
    keepFailure.value = store.state.error
    return
  }
  await onboarding.made()
}
</script>

<template>
  <StepCard :title="words.file.title" :subtitle="words.file.subtitle">
    <template v-if="held || picked">
      <ImportSummary :preview="held" :failure="failure" :failure-detail="failureDetail" />
      <UAlert v-if="keepFailure" icon="i-lucide-triangle-alert" color="error" variant="subtle" :title="words.file.notKept" :description="keepFailure" />
    </template>
    <UFileUpload
      v-else
      v-model="picked"
      :accept="WORKBOOK_FILE_TYPES"
      :preview="false"
      icon="i-lucide-file-up"
      :label="words.file.drop"
      :description="words.file.dropNote"
      color="neutral"
      class="w-full"
      :ui="{ base: 'min-h-32 border-dashed bg-elevated/40' }"
      data-testid="onboarding-file"
    />

    <template #actions>
      <UButton v-if="held || failure" :label="words.file.another" color="neutral" variant="outline" data-testid="onboarding-another-file" @click="another" />
      <UButton
        :label="inBrowser ? words.file.keepHere : words.continue"
        :trailing-icon="inBrowser ? undefined : 'i-lucide-arrow-right'"
        :icon="inBrowser ? 'i-lucide-monitor-smartphone' : undefined"
        :disabled="!keepable"
        :loading="keeping"
        data-testid="onboarding-continue"
        @click="proceed"
      />
    </template>
  </StepCard>
</template>
