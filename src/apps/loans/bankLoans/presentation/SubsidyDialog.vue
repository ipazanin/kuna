<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import { BANK_LOAN_WRITES } from '../application/bankLoanWrites'
import { useLoansBooks } from '../../workbook/application/loansStore'
import type { LoanSubsidy } from '../../workbook/domain/bankLoan'
import type { BankLoanBook } from '../../workbook/domain/readLoanBook'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import AppDialog from '../../../../shared/ui/AppDialog.vue'
import FormGrid from '../../../../shared/ui/FormGrid.vue'
import SubsidyFields, { subsidyTexts, typedSubsidy } from './SubsidyFields.vue'
import type { SubsidyTexts } from './SubsidyFields.vue'
import { words as loansWords } from '../../words'
import { words } from './words'

/** The loan's subsidy, which the loan record holds, so adding, changing and deleting it each change the loan. */
const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  book: BankLoanBook
}>()

const writes = useRecordWrites(useLoansBooks())

const texts = ref<SubsidyTexts>(subsidyTexts(null))
const tried = ref(false)

watch(open, (opened) => {
  if (!opened) return
  texts.value = subsidyTexts(props.book.loan.subsidy)
  tried.value = false
})

const typed = computed(() => typedSubsidy(texts.value, props.book.loan.instalments).subsidy)

async function write(title: string, subsidy: LoanSubsidy | null, failedTitle: string): Promise<void> {
  const { loan } = props.book
  if (await writes.write(title, (unit) => unit.of(BANK_LOAN_WRITES).change(loan, { ...loan, subsidy }), { failedTitle })) open.value = false
}

async function save(): Promise<void> {
  tried.value = true
  if (typed.value === null) return
  await write(props.book.loan.subsidy === null ? words.subsidyDialog.added : words.subsidyDialog.saved, typed.value, loansWords.form.notSaved)
}
</script>

<template>
  <AppDialog v-model:open="open" :title="book.loan.subsidy === null ? words.subsidyDialog.add : words.subsidyDialog.change" :description="words.subsidyDialog.description">
    <FormGrid id="loan-subsidy" as="form" data-testid="subsidy-form" @submit.prevent="save">
      <SubsidyFields v-model="texts" :tried="tried" :loan-instalments="book.loan.instalments" />
    </FormGrid>
    <template #start>
      <UButton
        v-if="book.loan.subsidy !== null"
        :label="words.subsidyDialog.delete"
        icon="i-lucide-trash-2"
        color="error"
        variant="ghost"
        :disabled="writes.busy.value"
        data-testid="subsidy-delete"
        @click="write(words.subsidyDialog.deleted, null, loansWords.form.notDeleted)"
      />
    </template>
    <template #end>
      <UButton :label="loansWords.form.cancel" color="neutral" variant="ghost" :disabled="writes.busy.value" @click="open = false" />
      <UButton
        type="submit"
        form="loan-subsidy"
        :label="book.loan.subsidy === null ? words.subsidyDialog.addButton : words.subsidyDialog.saveButton"
        :icon="book.loan.subsidy === null ? 'i-lucide-plus' : 'i-lucide-save'"
        :loading="writes.busy.value"
        :disabled="writes.busy.value"
        data-testid="subsidy-save"
      />
    </template>
  </AppDialog>
</template>
