<script setup lang="ts">
import { ref, watch } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import { useToast } from '@nuxt/ui/composables/useToast'

import { deleteKeysFromGoogle } from '../../shared/secrets/presentation/secretsStep'
import { usePageSync } from '../../shared/sync/presentation/pageSync'
import AppCard from '../../shared/ui/AppCard.vue'
import AppDialog from '../../shared/ui/AppDialog.vue'
import DeleteKunaDialog from './DeleteKunaDialog.vue'
import { words } from './words'

/** Kuna settings: deletes all of Kuna, or only the files that hold keys in the Google account after asking first, also with no file on Drive, where no sync can reach them. */
const sync = usePageSync()
const toast = useToast()
const text = words.keys
const card = words.deleteData
const deletingAll = ref(false)
const open = ref(false)
const deleting = ref(false)
const failure = ref<string | null>(null)

watch(open, (opened) => {
  if (opened) failure.value = null
})

async function deleteKeys(): Promise<void> {
  deleting.value = true
  failure.value = null
  try {
    await sync.settled()
    await deleteKeysFromGoogle()
    open.value = false
    toast.add({ title: text.deleted, icon: 'i-lucide-trash-2', color: 'success' })
  } catch (refused) {
    failure.value = refused instanceof Error ? refused.message : String(refused)
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <AppCard :title="card.title" :subtitle="card.subtitle" data-testid="delete-data-card">
    <div class="flex flex-wrap gap-2 px-4 pt-3 pb-4 sm:px-5 sm:pb-5">
      <UButton icon="i-lucide-trash-2" :label="card.all.action" color="error" variant="ghost" size="sm" data-testid="delete-kuna" @click="deletingAll = true" />
      <UButton icon="i-lucide-trash-2" :label="text.action" color="error" variant="ghost" size="sm" data-testid="delete-keys" @click="open = true" />
    </div>
    <DeleteKunaDialog v-model:open="deletingAll" />
    <AppDialog v-model:open="open" :title="text.confirmTitle" :description="text.confirmDescription" :dismissible="!deleting">
      <div class="flex flex-col gap-4" data-testid="delete-keys-dialog">
        <ul class="list-disc space-y-1 ps-4 text-sm text-toned">
          <li>{{ text.stayHere }}</li>
          <li>{{ text.syncsAgain }}</li>
        </ul>
        <UAlert v-if="failure" icon="i-lucide-triangle-alert" color="error" variant="subtle" :title="text.failed" :description="failure" data-testid="delete-keys-failed" />
      </div>
      <template #end>
        <UButton :label="text.cancel" color="neutral" variant="ghost" :disabled="deleting" @click="open = false" />
        <UButton :label="text.confirm" icon="i-lucide-trash-2" color="error" :loading="deleting" data-testid="delete-keys-confirm" @click="deleteKeys" />
      </template>
    </AppDialog>
  </AppCard>
</template>
