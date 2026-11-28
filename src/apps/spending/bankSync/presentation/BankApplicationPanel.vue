<script setup lang="ts">
import { computed, ref } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import BankKeyForm from '../../../../shared/bank-sync/presentation/BankKeyForm.vue'
import { bankKeyHere, bankRedirectUrl } from '../../../../shared/bank-sync/application/pageBankSync'
import { words as bankScriptWords } from '../../../../shared/bank-sync/application/words'
import { useBankKey } from '../../../../shared/bank-sync/presentation/useBankKey'
import { useSpendingBankHost } from './spendingBankHost'
import { words } from './words'
import { fetchKeysFromGoogle } from '../../../../shared/secrets/presentation/secretsStep'
import { useSecretsChanged } from '../../../../shared/secrets/presentation/pageSecrets'
import { words as bankWords } from '../../../../shared/bank-sync/presentation/words'
import { usePageSync } from '../../../../shared/sync/presentation/pageSync'
import AppDialog from '../../../../shared/ui/AppDialog.vue'
import NoteLine from '../../../../shared/ui/NoteLine.vue'

/** The application the book's bank sync uses: its name or id, whether this browser holds its key, what the last check found, and Replace key and Remove. Remove asks first, since the bank's links cannot come back. */
const props = defineProps<{ applicationId: string }>()

const host = useSpendingBankHost()
const key = useBankKey(host)
const page = usePageSync()
const secretsChanged = useSecretsChanged()
const replacing = ref(false)
const confirmingRemove = ref(false)
const fetchFailure = ref<string | null>(null)

const keyHere = computed(() => {
  void secretsChanged.value
  return bankKeyHere(props.applicationId)
})
const answered = computed(() => (key.lastCheck.value?.kind === 'answered' ? key.lastCheck.value : null))
const failure = computed(() => (key.lastCheck.value?.kind === 'failed' ? key.lastCheck.value.line : null))
const title = computed(() =>
  answered.value === null || answered.value.application.name === '' ? bankWords.application.id(props.applicationId) : bankWords.application.named(answered.value.application.name),
)
const problemLines = computed(() =>
  (answered.value?.problems ?? []).map((problem) => (problem === 'redirect-missing' ? bankWords.application.problems[problem](bankRedirectUrl()) : bankWords.application.problems[problem])),
)

async function remove(): Promise<void> {
  if (await key.remove()) confirmingRemove.value = false
}

async function getKey(): Promise<void> {
  fetchFailure.value = null
  try {
    const refused = await fetchKeysFromGoogle(page.settled)
    if (refused !== null) fetchFailure.value = words.keyFetchFailed(refused)
  } catch (reason) {
    fetchFailure.value = words.keyFetchFailed(reason instanceof Error ? reason.message : String(reason))
  }
}
</script>

<template>
  <div class="flex flex-col gap-3 rounded-control border border-default px-4 py-3 sm:px-5" data-testid="spending-bank-application">
    <div class="flex flex-col gap-1">
      <p class="type-row-title" data-testid="spending-bank-application-name">{{ title }}</p>
      <p v-if="answered !== null && answered.problems.length === 0" class="type-caption">{{ bankWords.application.active }}</p>
    </div>
    <NoteLine v-for="line in problemLines" :key="line" tone="warning" size="body" data-testid="spending-bank-application-problem">{{ line }}</NoteLine>
    <NoteLine v-if="failure !== null && !replacing" tone="error" size="body" data-testid="spending-bank-application-failed">{{ failure }}</NoteLine>
    <template v-if="!keyHere && !replacing">
      <NoteLine tone="warning" size="body" data-testid="spending-bank-key-missing">{{ bankScriptWords.noKeyHere }}</NoteLine>
      <NoteLine v-if="fetchFailure !== null" tone="error" size="body">{{ fetchFailure }}</NoteLine>
    </template>
    <BankKeyForm v-if="replacing" :host="host" :current="applicationId" cancellable @kept="replacing = false" @cancel="replacing = false" />
    <template v-else>
      <div class="flex flex-wrap items-center gap-2">
        <UButton v-if="!keyHere" :label="words.getKey" icon="i-lucide-cloud-download" size="sm" data-testid="spending-bank-key-get" @click="getKey" />
        <UButton
          v-else
          :label="bankWords.application.check"
          icon="i-lucide-plug-zap"
          color="neutral"
          variant="outline"
          size="sm"
          :loading="key.busy.value"
          data-testid="spending-bank-application-check"
          @click="key.recheck"
        />
        <UButton :label="bankWords.application.replace" icon="i-lucide-key-round" color="neutral" variant="outline" size="sm" data-testid="spending-bank-key-replace" @click="replacing = true" />
        <UButton :label="bankWords.application.remove" icon="i-lucide-unlink" color="error" variant="ghost" size="sm" data-testid="spending-bank-sync-remove" @click="confirmingRemove = true" />
      </div>
      <p class="type-caption max-w-prose">{{ bankWords.application.removeCaption }}</p>
    </template>
    <AppDialog v-model:open="confirmingRemove" :title="bankWords.application.removeTitle" :description="bankWords.application.removeDescription" :dismissible="!key.removing.value" changes>
      <template #end>
        <UButton :label="bankWords.key.cancel" color="neutral" variant="ghost" :disabled="key.removing.value" @click="confirmingRemove = false" />
        <UButton
          :label="bankWords.application.remove"
          icon="i-lucide-unlink"
          color="error"
          :loading="key.removing.value"
          :disabled="key.refused.value"
          data-testid="spending-bank-sync-remove-confirm"
          @click="remove"
        />
      </template>
    </AppDialog>
  </div>
</template>
