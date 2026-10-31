<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import { useToast } from '@nuxt/ui/composables/useToast'

import { REDIRECT_SIGN_IN_QUERY } from '../../../../shared/google/googleRedirect'
import { useMediaQuery } from '../../../../shared/layout/viewport'
import AppDialog from '../../../../shared/ui/AppDialog.vue'
import { onboardingStart, useOnboarding } from '../../onboarding/presentation/useOnboarding'
import { useWorkbook } from '../../workbook/application/workbookStore'
import ImportSummary from './ImportSummary.vue'
import { useImportPreview } from './useImportPreview'
import { words } from './words'

/**
 * The file to open. Setting it opens the dialog, and the dialog sets it back to null when it closes.
 * Keep on Google Drive hands the file to onboarding's folder step, after its Google access step.
 */
const file = defineModel<File | null>('file', { required: true })

const emit = defineEmits<{
  imported: []
}>()

const store = useWorkbook()
const toast = useToast()
const router = useRouter()
const onboarding = useOnboarding()
const signInByRedirect = useMediaQuery(REDIRECT_SIGN_IN_QUERY)
const { preview, failure, failureDetail } = useImportPreview(file)
const keepFailure = ref<string | null>(null)
const importing = ref(false)

const open = computed({
  get: () => file.value !== null,
  set: (opened: boolean) => {
    if (!opened) file.value = null
  },
})

const replacesLocal = computed(() => store.state.choice?.source === 'browser')
const keepable = computed(() => preview.value !== null && preview.value.summary.refusal === null && !importing.value)

async function keepInBrowser(): Promise<void> {
  const chosen = preview.value
  if (chosen === null || chosen.summary.refusal !== null) return
  importing.value = true
  keepFailure.value = null
  await store.replaceLocalWorkbook(chosen.document, chosen.title)
  importing.value = false
  if (store.state.status === 'error') {
    keepFailure.value = store.state.error
    return
  }
  toast.add({ title: words.dialog.keptInBrowser, description: words.dialog.keptCount(chosen.summary.transactionCount, chosen.fileName), icon: 'i-lucide-check', color: 'success' })
  file.value = null
  emit('imported')
}

async function keepOnGoogleDrive(): Promise<void> {
  const chosen = preview.value
  if (chosen === null || chosen.summary.refusal !== null) return
  onboarding.hold(chosen)
  file.value = null
  emit('imported')
  await router.push(onboardingStart('bring', 'access'))
}
</script>

<template>
  <AppDialog v-model:open="open" width="xl" :title="file ? words.dialog.title(file.name) : words.dialog.titleWithoutFile" :description="words.dialog.description" :dismissible="!importing">
    <ImportSummary :preview="preview" :failure="failure ?? keepFailure" :failure-detail="failure === null ? '' : failureDetail">
      <UAlert v-if="replacesLocal" icon="i-lucide-replace" color="warning" variant="subtle" :title="words.dialog.replaces" :description="words.dialog.replacesDescription" />
      <p v-if="signInByRedirect" class="text-xs text-muted" data-testid="redirect-sign-in-note">
        {{ words.dialog.redirectNote }}
      </p>
    </ImportSummary>
    <template #end>
      <UButton :label="words.dialog.cancel" color="neutral" variant="ghost" @click="open = false" />
      <UButton icon="i-lucide-monitor-smartphone" :label="words.dialog.keepInBrowser" color="neutral" variant="outline" :loading="importing" :disabled="!keepable" @click="keepInBrowser" />
      <UButton icon="i-lucide-hard-drive-upload" :label="words.dialog.keepOnDrive" :disabled="!keepable" @click="keepOnGoogleDrive" />
    </template>
  </AppDialog>
</template>
