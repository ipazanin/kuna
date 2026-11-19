<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'

import { LOAN_SHARE_WRITES, newLoanShare } from '../application/bankLoanWrites'
import { useLoansBooks } from '../../workbook/application/loansStore'
import type { LoanShare } from '../../workbook/domain/loanShare'
import type { BankLoanBook } from '../../workbook/domain/readLoanBook'
import { words as loansWords } from '../../words'
import { useLoanWords } from './useLoanWords'
import { shareChangeErrors } from './words'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { partShown, typedPartChange } from '../../../../shared/money/yourPart'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import AppDialog from '../../../../shared/ui/AppDialog.vue'
import DayField from '../../../../shared/ui/DayField.vue'
import FormGrid from '../../../../shared/ui/FormGrid.vue'

/** Your part of what the loan owes from a day on, such as all of it once the other borrower leaves the loan. */
const open = defineModel<boolean>('open', { required: true })
const loanWords = useLoanWords()

const props = defineProps<{
  book: BankLoanBook
  /** The change to edit, or null to add one. */
  editing: LoanShare | null
  /** Where a new change's day starts. */
  today: CivilDate
}>()

const writes = useRecordWrites(useLoansBooks())

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

const typed = computed(() => typedPartChange({ from: from.value, share: share.value }, props.book.loan.drawdown, props.book.shares, props.editing?.id ?? null))
const errors = computed(() => shareChangeErrors(typed.value.faults))

async function save(): Promise<void> {
  tried.value = true
  const typedChange = typed.value.change
  if (typedChange === null) return
  const change = newLoanShare({ loan: props.book.loan.id, ...typedChange, note: note.value })
  const before = props.editing
  const written =
    before === null
      ? await writes.write(loanWords.value.shareDialog.added, (unit) => unit.of(LOAN_SHARE_WRITES).add(change), { failedTitle: loansWords.form.notAdded })
      : await writes.write(loanWords.value.shareDialog.saved, (unit) => unit.of(LOAN_SHARE_WRITES).change(before, { ...change, id: before.id }), { failedTitle: loansWords.form.notSaved })
  if (written) open.value = false
}

async function remove(): Promise<void> {
  const before = props.editing
  if (before === null) return
  if (await writes.write(loanWords.value.shareDialog.deleted, (unit) => unit.of(LOAN_SHARE_WRITES).remove(before), { key: 'delete', failedTitle: loansWords.form.notDeleted })) open.value = false
}
</script>

<template>
  <AppDialog v-model:open="open" changes :title="editing === null ? loanWords.shareDialog.addTitle : loanWords.shareDialog.changeTitle" :description="loanWords.shareDialog.description">
    <FormGrid id="loan-share" as="form" data-testid="loan-share-form" @submit.prevent="save">
      <UFormField :label="loanWords.shareDialog.from" :error="(tried && errors.from) || false">
        <DayField v-model="from" class="w-full" data-testid="loan-share-from" />
      </UFormField>
      <UFormField :label="loanWords.shareDialog.share" :help="loanWords.shareDialog.shareHelp" :error="(tried && errors.share) || false">
        <UInput v-model="share" inputmode="decimal" placeholder="50" class="w-full" data-testid="loan-share-part" />
      </UFormField>
      <UFormField :label="loansWords.form.note" :help="loanWords.shareDialog.noteHelp" class="sm:col-span-2">
        <UInput v-model="note" class="w-full" data-testid="loan-share-note" />
      </UFormField>
    </FormGrid>
    <template #start>
      <UButton
        v-if="editing !== null"
        :label="loanWords.shareDialog.delete"
        icon="i-lucide-trash-2"
        color="error"
        variant="ghost"
        :loading="writes.saving('delete')"
        :disabled="writes.busy.value || writes.refused.value"
        data-testid="loan-share-delete"
        @click="remove"
      />
    </template>
    <template #end>
      <UButton :label="loansWords.form.cancel" color="neutral" variant="ghost" @click="open = false" />
      <UButton
        type="submit"
        form="loan-share"
        :label="editing === null ? loanWords.shareDialog.add : loanWords.shareDialog.save"
        :icon="editing === null ? 'i-lucide-plus' : 'i-lucide-save'"
        :loading="writes.saving('save')"
        :disabled="writes.busy.value || writes.refused.value"
        data-testid="loan-share-save"
      />
    </template>
  </AppDialog>
</template>
