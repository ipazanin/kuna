<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import USelectMenu from '@nuxt/ui/components/SelectMenu.vue'

import { LATE_INSTALMENT_WRITES, newLateInstalment } from '../application/bankLoanWrites'
import { lateDues, paidLate } from '../domain/lateInstalments'
import { useLoansBooks } from '../../workbook/application/loansStore'
import type { LateInstalment } from '../../workbook/domain/lateInstalment'
import type { BankLoanBook } from '../../workbook/domain/readLoanBook'
import { civilDate, parseCivilDate } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import AppDialog from '../../../../shared/ui/AppDialog.vue'
import DayField from '../../../../shared/ui/DayField.vue'
import FormGrid from '../../../../shared/ui/FormGrid.vue'
import { words as loansWords } from '../../words'
import { useLoanWords } from './useLoanWords'

/** An instalment that went out after its due date. Every other instalment counts as paid on its due date. */
const open = defineModel<boolean>('open', { required: true })
const loanWords = useLoanWords()

const props = defineProps<{
  book: BankLoanBook
  /** The late instalment to change, or null to mark one. */
  editing: LateInstalment | null
  /** Instalments due by this day can be marked late. */
  today: CivilDate
}>()

const writes = useRecordWrites(useLoansBooks())

const due = ref('')
const paid = ref('')
const tried = ref(false)

const dueItems = computed(() =>
  lateDues(props.book, props.today, props.editing).map((row): { label: string; value: string } => ({ label: `${dayLabel(row.date)}, ${formatMoney(row.payment)}`, value: row.date })),
)

watch(open, (opened) => {
  if (!opened) return
  due.value = props.editing?.due ?? dueItems.value[0]?.value ?? ''
  paid.value = props.editing?.paid ?? ''
  tried.value = false
})

const errors = computed(() => {
  const day = parseCivilDate(paid.value)
  const dueDay = parseCivilDate(due.value)
  return {
    due: dueItems.value.some((item) => item.value === due.value) ? null : loanWords.value.lateDialog.dueError,
    paid: day === null ? loansWords.form.aDate(civilDate(2026, 12, 8)) : dueDay !== null && !paidLate(dueDay, day) ? loanWords.value.lateDialog.afterDue : null,
  }
})

async function save(): Promise<void> {
  tried.value = true
  const day = parseCivilDate(paid.value)
  const dueDay = parseCivilDate(due.value)
  if (Object.values(errors.value).some((error) => error !== null) || day === null || dueDay === null) return
  const typed = newLateInstalment({ loan: props.book.loan.id, due: dueDay, paid: day })
  const before = props.editing
  const written =
    before === null
      ? await writes.write(loanWords.value.lateDialog.added, (unit) => unit.of(LATE_INSTALMENT_WRITES).add(typed), { failedTitle: loansWords.form.notAdded })
      : await writes.write(loanWords.value.lateDialog.saved, (unit) => unit.of(LATE_INSTALMENT_WRITES).change(before, { ...typed, id: before.id }), { failedTitle: loansWords.form.notSaved })
  if (written) open.value = false
}

async function remove(): Promise<void> {
  const before = props.editing
  if (before === null) return
  if (await writes.write(loanWords.value.lateDialog.deleted, (unit) => unit.of(LATE_INSTALMENT_WRITES).remove(before), { key: 'delete', failedTitle: loansWords.form.notDeleted })) open.value = false
}
</script>

<template>
  <AppDialog v-model:open="open" changes :title="editing === null ? loanWords.lateDialog.addTitle : loanWords.lateDialog.changeTitle" :description="loanWords.lateDialog.description">
    <FormGrid id="late-instalment" as="form" data-testid="late-instalment-form" @submit.prevent="save">
      <UFormField :label="loanWords.lateDialog.due" :error="(tried && errors.due) || false">
        <USelectMenu
          v-model="due"
          :items="dueItems"
          value-key="value"
          :placeholder="loanWords.lateDialog.choose"
          :search-input="{ placeholder: loanWords.lateDialog.search }"
          class="w-full"
          data-testid="late-instalment-due"
        />
      </UFormField>
      <UFormField :label="loanWords.lateDialog.paidOn" :error="(tried && errors.paid) || false">
        <DayField v-model="paid" class="w-full" data-testid="late-instalment-paid" />
      </UFormField>
    </FormGrid>
    <template #start>
      <UButton
        v-if="editing !== null"
        :label="loanWords.lateDialog.delete"
        icon="i-lucide-trash-2"
        color="error"
        variant="ghost"
        :loading="writes.saving('delete')"
        :disabled="writes.busy.value || writes.refused.value"
        data-testid="late-instalment-delete"
        @click="remove"
      />
    </template>
    <template #end>
      <UButton :label="loansWords.form.cancel" color="neutral" variant="ghost" @click="open = false" />
      <UButton
        type="submit"
        form="late-instalment"
        :label="editing === null ? loanWords.lateDialog.add : loanWords.lateDialog.save"
        :icon="editing === null ? 'i-lucide-plus' : 'i-lucide-save'"
        :loading="writes.saving('save')"
        :disabled="writes.busy.value || writes.refused.value"
        data-testid="late-instalment-save"
      />
    </template>
  </AppDialog>
</template>
