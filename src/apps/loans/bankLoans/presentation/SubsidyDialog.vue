<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UModal from '@nuxt/ui/components/Modal.vue'

import { BANK_LOAN_WRITES } from '../application/bankLoanWrites'
import { useLoansBooks } from '../../workbook/application/loansStore'
import type { LoanSubsidy } from '../../workbook/domain/bankLoan'
import type { BankLoanBook } from '../../workbook/domain/readLoanBook'
import { usePhoneLayout } from '../../../../shared/layout/viewport'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import SubsidyFields, { subsidyTexts, typedSubsidy } from './SubsidyFields.vue'
import type { SubsidyTexts } from './SubsidyFields.vue'

/** The loan's subsidy, which the loan record holds, so adding, changing and deleting it each change the loan. */
const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  book: BankLoanBook
}>()

const writes = useRecordWrites(useLoansBooks())
const phone = usePhoneLayout()

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
  await write(props.book.loan.subsidy === null ? 'Subsidy added' : 'Subsidy saved', typed.value, 'Not saved')
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="book.loan.subsidy === null ? 'Add a subsidy' : 'Change the subsidy'"
    description="A fixed amount a third party, such as APN, pays of each instalment it covers. It pays interest first and leaves the balance alone."
    :fullscreen="phone"
    :ui="{ header: 'pe-16 sm:pe-6' }"
  >
    <template #body>
      <form id="loan-subsidy" class="grid gap-4 sm:grid-cols-2" data-testid="subsidy-form" @submit.prevent="save">
        <SubsidyFields v-model="texts" :tried="tried" :loan-instalments="book.loan.instalments" />
      </form>
    </template>
    <template #footer>
      <div class="flex w-full flex-wrap items-center gap-2">
        <UButton
          v-if="book.loan.subsidy !== null"
          label="Delete subsidy"
          icon="i-lucide-trash-2"
          color="error"
          variant="ghost"
          :disabled="writes.busy.value"
          data-testid="subsidy-delete"
          @click="write('Subsidy deleted', null, 'Not deleted')"
        />
        <div class="ms-auto flex flex-wrap gap-2">
          <UButton label="Cancel" color="neutral" variant="ghost" :disabled="writes.busy.value" @click="open = false" />
          <UButton
            type="submit"
            form="loan-subsidy"
            :label="book.loan.subsidy === null ? 'Add subsidy' : 'Save subsidy'"
            :icon="book.loan.subsidy === null ? 'i-lucide-plus' : 'i-lucide-save'"
            :loading="writes.busy.value"
            :disabled="writes.busy.value"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
