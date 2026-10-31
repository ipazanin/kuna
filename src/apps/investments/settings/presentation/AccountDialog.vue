<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'

import { INVESTMENT_ACCOUNT_WRITES } from '../../holdings/application/holdingWrites'
import { useInvestmentsBooks } from '../../workbook/application/investmentsStore'
import type { InvestmentAccount } from '../../workbook/domain/investmentAccount'
import { INVESTMENT_ACCOUNT_RECORDS } from '../../workbook/domain/investmentKinds'
import { words } from './words'
import { newRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import AppDialog from '../../../../shared/ui/AppDialog.vue'
import FormGrid from '../../../../shared/ui/FormGrid.vue'

/** An account at a broker, added or changed. Saving says which account it wrote. */
const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  /** The account to change, or null to add one. */
  account: InvestmentAccount | null
}>()

const emit = defineEmits<{
  saved: [account: InvestmentAccount]
}>()

const writes = useRecordWrites(useInvestmentsBooks())
const text = words.accountDialog

const name = ref('')
const note = ref('')
const tried = ref(false)

watch(open, (opened) => {
  if (!opened) return
  name.value = props.account?.name ?? ''
  note.value = props.account?.note ?? ''
  tried.value = false
})

const nameError = computed(() => (name.value.trim() === '' ? text.nameError : null))

async function save(): Promise<void> {
  tried.value = true
  if (nameError.value !== null) return
  const before = props.account
  const record: InvestmentAccount = { id: before?.id ?? recordIdOf(INVESTMENT_ACCOUNT_RECORDS, newRecordId()), name: name.value.trim(), note: note.value.trim() }
  const written =
    before === null
      ? await writes.write(text.added, (unit) => unit.of(INVESTMENT_ACCOUNT_WRITES).add(record), { failedTitle: text.notAdded })
      : await writes.write(text.saved, (unit) => unit.of(INVESTMENT_ACCOUNT_WRITES).change(before, record), { failedTitle: text.notSaved })
  if (!written) return
  emit('saved', record)
  open.value = false
}

async function remove(): Promise<void> {
  const before = props.account
  if (before === null) return
  if (await writes.write(text.deleted, (unit) => unit.of(INVESTMENT_ACCOUNT_WRITES).remove(before), { failedTitle: text.notDeleted })) open.value = false
}
</script>

<template>
  <AppDialog v-model:open="open" :title="account === null ? text.addTitle : text.changeTitle" :description="text.description">
    <FormGrid id="investment-account" as="form" data-testid="account-form" @submit.prevent="save">
      <UFormField :label="text.name" :help="text.nameHelp" :error="(tried && nameError) || false" class="sm:col-span-2">
        <UInput v-model="name" class="w-full" data-testid="account-name" />
      </UFormField>
      <UFormField :label="text.note" class="sm:col-span-2">
        <UInput v-model="note" class="w-full" data-testid="account-note" />
      </UFormField>
    </FormGrid>
    <template #start>
      <UButton v-if="account !== null" :label="text.delete" icon="i-lucide-trash-2" color="error" variant="ghost" :disabled="writes.busy.value" data-testid="account-delete" @click="remove" />
    </template>
    <template #end>
      <UButton :label="text.cancel" color="neutral" variant="ghost" :disabled="writes.busy.value" @click="open = false" />
      <UButton
        type="submit"
        form="investment-account"
        :label="account === null ? text.add : text.save"
        :icon="account === null ? 'i-lucide-plus' : 'i-lucide-save'"
        :loading="writes.busy.value"
        :disabled="writes.busy.value"
        data-testid="account-save"
      />
    </template>
  </AppDialog>
</template>
