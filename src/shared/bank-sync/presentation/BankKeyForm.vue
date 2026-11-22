<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import UTextarea from '@nuxt/ui/components/Textarea.vue'

import type { BankSyncHost } from './bankSyncHost'
import { useBankKey } from './useBankKey'
import { applicationIdOfFileName } from '../domain/bankAnswer'
import { words } from './words'
import FileDrop from '../../ui/FileDrop.vue'
import FormGrid from '../../ui/FormGrid.vue'
import NoteLine from '../../ui/NoteLine.vue'

/**
 * Brings the person's Enable Banking key: the .pem dropped or pasted, its application id from the file's name, and Check,
 * which keeps the key only once Enable Banking answers a call it signed. The key stays in this form until then and goes in
 * no draft. On Settings' card and in the set-up's walk-through alike.
 */
const props = defineProps<{
  host: BankSyncHost
  /** The application the book keeps, or blank before bank sync is set up. */
  current: string
  /** Shows Cancel, for a key that replaces the kept one. */
  cancellable?: boolean
}>()

/** `checking` comes before the key is kept, as the book's write may land before Check returns. */
const emit = defineEmits<{ checking: []; kept: []; cancel: [] }>()

const key = useBankKey(props.host)
const file = ref<File | null>(null)
const pem = ref('')
const applicationId = ref('')

watch(file, async (picked) => {
  if (picked === null) return
  applicationId.value = applicationIdOfFileName(picked.name)
  pem.value = await picked.text()
})

const ready = computed(() => applicationId.value.trim() !== '' && pem.value.trim() !== '')
const otherApplication = computed(() => props.current !== '' && applicationId.value.trim() !== '' && applicationId.value.trim() !== props.current)
const failure = computed(() => (key.lastCheck.value?.kind === 'failed' ? key.lastCheck.value.line : null))

async function check(): Promise<void> {
  emit('checking')
  if (await key.bring(applicationId.value, pem.value)) {
    pem.value = ''
    emit('kept')
  }
}
</script>

<template>
  <div class="flex flex-col gap-4" data-testid="spending-bank-key">
    <FileDrop v-model="file" :label="words.key.drop" :description="words.key.dropHelp" accept=".pem" icon="i-lucide-key-round" data-testid="spending-bank-key-file" />
    <FormGrid>
      <UFormField :label="words.key.paste" :help="words.key.pasteHelp" class="sm:col-span-2" data-testid="spending-bank-key-pem">
        <UTextarea v-model="pem" :rows="3" autocomplete="off" autocapitalize="off" :spellcheck="false" class="w-full font-mono" />
      </UFormField>
      <UFormField :label="host.applicationLabel" :help="words.key.applicationHelp" class="sm:col-span-2" data-testid="spending-bank-key-application">
        <UInput v-model="applicationId" autocomplete="off" :spellcheck="false" class="w-full" />
      </UFormField>
    </FormGrid>
    <NoteLine v-if="otherApplication" tone="warning" size="body" data-testid="spending-bank-key-other">{{ words.key.otherApplication }}</NoteLine>
    <NoteLine v-if="failure !== null" tone="error" size="body" data-testid="spending-bank-key-failed">{{ failure }}</NoteLine>
    <p class="type-caption max-w-prose">{{ words.key.kept }}</p>
    <div class="flex flex-wrap items-center gap-2">
      <UButton :label="words.key.check" icon="i-lucide-plug-zap" :disabled="!ready" :loading="key.busy.value" data-testid="spending-bank-key-check" @click="check" />
      <UButton v-if="cancellable" :label="words.key.cancel" color="neutral" variant="ghost" data-testid="spending-bank-key-cancel" @click="emit('cancel')" />
    </div>
  </div>
</template>
