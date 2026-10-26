<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UModal from '@nuxt/ui/components/Modal.vue'
import { useToast } from '@nuxt/ui/composables/useToast'

import { REDIRECT_SIGN_IN_QUERY } from '../../../shared/google/googleRedirect'
import { useMediaQuery, usePhoneLayout } from '../../../shared/layout/viewport'
import { onboardingStart, useOnboarding } from '../../onboarding/presentation/useOnboarding'
import { useWorkbook } from '../../workbook/application/workbookStore'
import ImportSummary from './ImportSummary.vue'
import { useImportPreview } from './useImportPreview'

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
// Full screen on a phone, so the choices sit at the bottom under the thumb.
const phone = usePhoneLayout()
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
  toast.add({ title: 'Kept in this browser', description: `${chosen.summary.transactionCount} transactions from ${chosen.fileName}`, icon: 'i-lucide-check', color: 'success' })
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
  <UModal
    v-model:open="open"
    :title="file ? `Open ${file.name}` : 'Open a file'"
    description="Check what the file holds, then choose where to keep it. Nothing changes until you choose."
    :fullscreen="phone"
    :dismissible="!importing"
    :ui="{ content: 'sm:max-w-xl', header: 'pe-16 sm:pe-6', footer: 'pb-[max(1rem,env(safe-area-inset-bottom))]' }"
  >
    <template #body>
      <ImportSummary :preview="preview" :failure="failure ?? keepFailure" :failure-detail="failure === null ? '' : failureDetail">
        <UAlert
          v-if="replacesLocal"
          icon="i-lucide-replace"
          color="warning"
          variant="subtle"
          title="This replaces the workbook kept in this browser"
          description="Changes you made here since your last export are lost. Export first if you want to keep them."
        />
        <p v-if="signInByRedirect" class="text-xs text-muted" data-testid="redirect-sign-in-note">
          Keep on Google Drive asks Google for access first. On this device that opens Google and comes back, and you open the file again then.
        </p>
      </ImportSummary>
    </template>

    <template #footer>
      <div class="flex w-full flex-wrap justify-end gap-2">
        <UButton label="Cancel" color="neutral" variant="ghost" @click="open = false" />
        <UButton
          icon="i-lucide-monitor-smartphone"
          label="Keep in this browser"
          color="neutral"
          variant="outline"
          :loading="importing"
          :disabled="!keepable"
          @click="keepInBrowser"
        />
        <UButton icon="i-lucide-hard-drive-upload" label="Keep on Google Drive" :disabled="!keepable" @click="keepOnGoogleDrive" />
      </div>
    </template>
  </UModal>
</template>
