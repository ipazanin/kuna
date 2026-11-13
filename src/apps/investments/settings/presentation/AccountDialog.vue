<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'

import { INVESTMENT_ACCOUNT_WRITES } from '../../holdings/application/holdingWrites'
import { intakeRefusalText } from '../../holdings/application/intakeRefusals'
import { accountIntakes, intakeRefusal, landingRecords, proposedMailStart } from '../../imports/domain/accountIntake'
import { writeAccountSources } from '../../mail/application/mailReaderWrites'
import { ibkrMailReader } from '../../mail/domain/ibkrFlexRecipe'
import { useInvestmentsBooks } from '../../workbook/application/investmentsStore'
import { BY_HAND, INVESTMENT_ROWS_FROM } from '../../workbook/domain/investmentAccount'
import type { AccountIntake, InvestmentAccount, InvestmentRowsFrom } from '../../workbook/domain/investmentAccount'
import { INVESTMENT_ACCOUNT_RECORDS } from '../../workbook/domain/investmentKinds'
import { words } from './words'
import { parseCivilDate, today } from '../../../../shared/calendar/civilDate'
import { newRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import AppDialog from '../../../../shared/ui/AppDialog.vue'
import ChoiceButtons from '../../../../shared/ui/ChoiceButtons.vue'
import DayField from '../../../../shared/ui/DayField.vue'
import FormGrid from '../../../../shared/ui/FormGrid.vue'
import NoteLine from '../../../../shared/ui/NoteLine.vue'

/** An account at a broker, added or changed, with how its rows come in and from which day. Saving says which account it wrote. */
const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  /** The account to change, or null to add one. */
  account: InvestmentAccount | null
}>()

const emit = defineEmits<{
  saved: [account: InvestmentAccount]
}>()

const store = useInvestmentsBooks()
const writes = useRecordWrites(store)
const text = words.accountDialog
const ROWS_FROM_OPTIONS = INVESTMENT_ROWS_FROM.map((rowsFrom) => ({ value: rowsFrom, label: text.rowsFromOptions[rowsFrom] }))

const book = computed(() => store.state.workbook?.book ?? null)
/** How the account's rows come in now, as the file says or, for one that does not say, as Kuna reads it. Null for a new one. */
const intakeBefore = computed(() => (props.account === null || book.value === null ? null : (accountIntakes(book.value).get(props.account.id) ?? null)))
/** The id the account is checked and written under: its own, or one made for a new account when the dialog opens. */
const accountId = ref(recordIdOf(INVESTMENT_ACCOUNT_RECORDS, newRecordId()))

const name = ref('')
const note = ref('')
const rowsFrom = ref<InvestmentRowsFrom>('by-hand')
const startsOn = ref('')
const tried = ref(false)

watch(open, (opened) => {
  if (!opened) return
  const intake = intakeBefore.value
  name.value = props.account?.name ?? ''
  note.value = props.account?.note ?? ''
  accountId.value = props.account?.id ?? recordIdOf(INVESTMENT_ACCOUNT_RECORDS, newRecordId())
  rowsFrom.value = intake?.rowsFrom ?? 'by-hand'
  startsOn.value = intake?.rowsFrom === 'mail' ? intake.startsOn : proposedMailStart(accountId.value, book.value === null ? [] : landingRecords(book.value), today())
  tried.value = false
})

const nameError = computed(() => (name.value.trim() === '' ? text.nameError : null))
const intake = computed((): AccountIntake | null => {
  if (rowsFrom.value === 'by-hand') return BY_HAND
  const day = parseCivilDate(startsOn.value)
  return day === null ? null : { rowsFrom: 'mail', startsOn: day }
})
/** A start day missing, or one the write would refuse, said under the field once Save is pressed. */
const startsOnError = computed(() => {
  if (intake.value === null) return text.startsOnError
  const refusal = book.value === null ? null : intakeRefusal(accountId.value, intakeBefore.value, intake.value, landingRecords(book.value), today())
  return refusal === null ? null : intakeRefusalText(refusal)
})
const readerOff = computed(() => rowsFrom.value === 'mail' && ibkrMailReader(book.value)?.on !== true)

async function save(): Promise<void> {
  tried.value = true
  if (nameError.value !== null || startsOnError.value !== null || intake.value === null) return
  const before = props.account
  const current = book.value
  const record: InvestmentAccount = {
    id: accountId.value,
    name: name.value.trim(),
    note: note.value.trim(),
    intake: intake.value,
  }
  const written = await writes.write(
    before === null ? text.added : text.saved,
    (unit) => {
      if (before === null) unit.of(INVESTMENT_ACCOUNT_WRITES).add(record)
      else unit.of(INVESTMENT_ACCOUNT_WRITES).change(before, record)
      if (current !== null) writeAccountSources(unit, current, { account: record.id })
    },
    { failedTitle: before === null ? text.notAdded : text.notSaved },
  )
  if (!written) return
  emit('saved', record)
  open.value = false
}

async function remove(): Promise<void> {
  const before = props.account
  if (before === null) return
  if (await writes.write(text.deleted, (unit) => unit.of(INVESTMENT_ACCOUNT_WRITES).remove(before), { key: 'delete', failedTitle: text.notDeleted })) open.value = false
}
</script>

<template>
  <AppDialog v-model:open="open" changes :title="account === null ? text.addTitle : text.changeTitle" :description="text.description">
    <FormGrid id="investment-account" as="form" data-testid="account-form" @submit.prevent="save">
      <UFormField :label="text.name" :help="text.nameHelp" :error="(tried && nameError) || false" class="sm:col-span-2">
        <UInput v-model="name" class="w-full" data-testid="account-name" />
      </UFormField>
      <UFormField :label="text.note" class="sm:col-span-2">
        <UInput v-model="note" class="w-full" data-testid="account-note" />
      </UFormField>
      <UFormField :label="text.rowsFrom" :help="rowsFrom === 'by-hand' ? text.byHandHelp : text.mailHelp(text.startsOn)" class="sm:col-span-2">
        <div class="flex flex-col gap-2">
          <ChoiceButtons v-model="rowsFrom" :options="ROWS_FROM_OPTIONS" :label="text.rowsFrom" data-testid="account-rows-from" />
          <NoteLine v-if="readerOff" tone="warning" data-testid="account-reader-off">{{ text.readerOff }}</NoteLine>
        </div>
      </UFormField>
      <UFormField v-if="rowsFrom === 'mail'" :label="text.startsOn" :error="(tried && startsOnError) || false">
        <DayField v-model="startsOn" class="w-full" data-testid="account-starts-on" />
      </UFormField>
    </FormGrid>
    <template #start>
      <UButton
        v-if="account !== null"
        :label="text.delete"
        icon="i-lucide-trash-2"
        color="error"
        variant="ghost"
        :loading="writes.saving('delete')"
        :disabled="writes.busy.value || writes.refused.value"
        data-testid="account-delete"
        @click="remove"
      />
    </template>
    <template #end>
      <UButton :label="text.cancel" color="neutral" variant="ghost" @click="open = false" />
      <UButton
        type="submit"
        form="investment-account"
        :label="account === null ? text.add : text.save"
        :icon="account === null ? 'i-lucide-plus' : 'i-lucide-save'"
        :loading="writes.saving('save')"
        :disabled="writes.busy.value || writes.refused.value"
        data-testid="account-save"
      />
    </template>
  </AppDialog>
</template>
