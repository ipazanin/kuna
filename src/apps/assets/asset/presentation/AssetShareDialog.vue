<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'

import { ASSET_SHARE_WRITES, newAssetShare } from '../application/assetWrites'
import { useAssetsBooks } from '../../workbook/application/assetsStore'
import type { AssetShare } from '../../workbook/domain/assetShare'
import type { AssetWithValuations } from '../../workbook/domain/readAssetBook'
import { words as assetsWords } from '../../words'
import { shareChangeErrors, words } from './words'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { partShown, typedPartChange } from '../../../../shared/money/yourPart'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import AppDialog from '../../../../shared/ui/AppDialog.vue'
import DayField from '../../../../shared/ui/DayField.vue'
import FormGrid from '../../../../shared/ui/FormGrid.vue'

/** Your part of the asset from a day on, such as all of it once you buy out the other owner. */
const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  entry: AssetWithValuations
  /** The change to edit, or null to add one. */
  editing: AssetShare | null
  /** Where a new change's day starts. */
  today: CivilDate
}>()

const writes = useRecordWrites(useAssetsBooks())

const from = ref('')
const share = ref('')
const note = ref('')
const tried = ref(false)

watch(open, (opened) => {
  if (!opened) return
  const change = props.editing
  from.value = change?.from ?? props.today
  share.value = partShown(change?.share)
  note.value = change?.note ?? ''
  tried.value = false
})

const typed = computed(() => typedPartChange({ from: from.value, share: share.value }, props.entry.asset.bought, props.entry.shares, props.editing?.id ?? null))
const errors = computed(() => shareChangeErrors(typed.value.faults))

async function save(): Promise<void> {
  tried.value = true
  const typedChange = typed.value.change
  if (typedChange === null) return
  const change = newAssetShare({ asset: props.entry.asset.id, ...typedChange, note: note.value })
  const before = props.editing
  const written =
    before === null
      ? await writes.write(words.shareDialog.added, (unit) => unit.of(ASSET_SHARE_WRITES).add(change), { failedTitle: assetsWords.form.notAdded })
      : await writes.write(words.shareDialog.saved, (unit) => unit.of(ASSET_SHARE_WRITES).change(before, { ...change, id: before.id }), { failedTitle: assetsWords.form.notSaved })
  if (written) open.value = false
}

async function remove(): Promise<void> {
  const before = props.editing
  if (before === null) return
  if (await writes.write(words.shareDialog.deleted, (unit) => unit.of(ASSET_SHARE_WRITES).remove(before), { key: 'delete', failedTitle: assetsWords.form.notDeleted })) open.value = false
}
</script>

<template>
  <AppDialog v-model:open="open" changes :title="editing === null ? words.shareDialog.addTitle : words.shareDialog.changeTitle" :description="words.shareDialog.description(entry.asset.name)">
    <FormGrid id="asset-share" as="form" data-testid="asset-share-form" @submit.prevent="save">
      <UFormField :label="words.shareDialog.from" :error="(tried && errors.from) || false">
        <DayField v-model="from" class="w-full" data-testid="asset-share-from" />
      </UFormField>
      <UFormField :label="words.shareDialog.share" :help="words.shareDialog.shareHelp" :error="(tried && errors.share) || false">
        <UInput v-model="share" inputmode="decimal" placeholder="50" class="w-full" data-testid="asset-share-part" />
      </UFormField>
      <UFormField :label="assetsWords.form.note" :help="words.shareDialog.noteHelp" class="sm:col-span-2">
        <UInput v-model="note" class="w-full" data-testid="asset-share-note" />
      </UFormField>
    </FormGrid>
    <template #start>
      <UButton
        v-if="editing !== null"
        :label="words.shareDialog.delete"
        icon="i-lucide-trash-2"
        color="error"
        variant="ghost"
        :loading="writes.saving('delete')"
        :disabled="writes.busy.value || writes.refused.value"
        data-testid="asset-share-delete"
        @click="remove"
      />
    </template>
    <template #end>
      <UButton :label="assetsWords.form.cancel" color="neutral" variant="ghost" @click="open = false" />
      <UButton
        type="submit"
        form="asset-share"
        :label="editing === null ? words.shareDialog.add : words.shareDialog.save"
        :icon="editing === null ? 'i-lucide-plus' : 'i-lucide-save'"
        :loading="writes.saving('save')"
        :disabled="writes.busy.value || writes.refused.value"
        data-testid="asset-share-save"
      />
    </template>
  </AppDialog>
</template>
