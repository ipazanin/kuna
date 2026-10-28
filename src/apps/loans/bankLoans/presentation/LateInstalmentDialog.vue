<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import UModal from '@nuxt/ui/components/Modal.vue'
import USelectMenu from '@nuxt/ui/components/SelectMenu.vue'

import { LATE_INSTALMENT_WRITES, newLateInstalment } from '../application/bankLoanWrites'
import { useLoansBooks } from '../../workbook/application/loansStore'
import type { LateInstalment } from '../../workbook/domain/lateInstalment'
import type { BankLoanBook } from '../../workbook/domain/readLoanBook'
import { parseCivilDate } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { usePhoneLayout } from '../../../../shared/layout/viewport'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'

/** An instalment that went out after its due date. Every other instalment counts as paid on its due date. */
const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  book: BankLoanBook
  /** The late instalment to change, or null to mark one. */
  editing: LateInstalment | null
  /** Instalments due by this day can be marked late. */
  today: CivilDate
}>()

const writes = useRecordWrites(useLoansBooks())
const phone = usePhoneLayout()

const due = ref('')
const paid = ref('')
const tried = ref(false)

/** The instalments due by today that no other late instalment names, newest first. */
const dueItems = computed(() => {
  const marked = new Set(props.book.lateInstalments.filter((late) => late.id !== props.editing?.id).map((late) => late.due))
  return (props.book.plan ?? [])
    .filter((row) => row.kind === 'instalment' && row.date <= props.today && !marked.has(row.date))
    .map((row): { label: string; value: string } => ({ label: `${dayLabel(row.date)}, ${formatMoney(row.payment)}`, value: row.date }))
    .reverse()
})

watch(open, (opened) => {
  if (!opened) return
  due.value = props.editing?.due ?? dueItems.value[0]?.value ?? ''
  paid.value = props.editing?.paid ?? ''
  tried.value = false
})

const errors = computed(() => {
  const day = parseCivilDate(paid.value)
  return {
    due: dueItems.value.some((item) => item.value === due.value) ? null : 'Choose the instalment that went out late',
    paid: day === null ? 'A date, such as 2026-12-08' : due.value !== '' && day <= due.value ? 'After the due date' : null,
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
      ? await writes.write('Late instalment added', (unit) => unit.of(LATE_INSTALMENT_WRITES).add(typed), { failedTitle: 'Not added' })
      : await writes.write('Late instalment saved', (unit) => unit.of(LATE_INSTALMENT_WRITES).change(before, { ...typed, id: before.id }), { failedTitle: 'Not saved' })
  if (written) open.value = false
}

async function remove(): Promise<void> {
  const before = props.editing
  if (before === null) return
  if (await writes.write('Late instalment deleted', (unit) => unit.of(LATE_INSTALMENT_WRITES).remove(before), { failedTitle: 'Not deleted' })) open.value = false
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="editing === null ? 'Mark an instalment late' : 'Change the late instalment'"
    description="The day an instalment actually went out. It changes when the row counts as paid, not the plan."
    :fullscreen="phone"
    :ui="{ header: 'pe-16 sm:pe-6' }"
  >
    <template #body>
      <form id="late-instalment" class="grid gap-4 sm:grid-cols-2" data-testid="late-instalment-form" @submit.prevent="save">
        <UFormField label="Instalment due" :error="(tried && errors.due) || false">
          <USelectMenu
            v-model="due"
            :items="dueItems"
            value-key="value"
            placeholder="Choose an instalment"
            :search-input="{ placeholder: 'Search due dates' }"
            class="w-full"
            data-testid="late-instalment-due"
          />
        </UFormField>
        <UFormField label="Paid on" :error="(tried && errors.paid) || false">
          <UInput v-model="paid" type="date" class="w-full" data-testid="late-instalment-paid" />
        </UFormField>
      </form>
    </template>
    <template #footer>
      <div class="flex w-full flex-wrap items-center gap-2">
        <UButton
          v-if="editing !== null"
          label="Delete"
          icon="i-lucide-trash-2"
          color="error"
          variant="ghost"
          :disabled="writes.busy.value"
          data-testid="late-instalment-delete"
          @click="remove"
        />
        <div class="ms-auto flex flex-wrap gap-2">
          <UButton label="Cancel" color="neutral" variant="ghost" :disabled="writes.busy.value" @click="open = false" />
          <UButton
            type="submit"
            form="late-instalment"
            :label="editing === null ? 'Mark late' : 'Save'"
            :icon="editing === null ? 'i-lucide-plus' : 'i-lucide-save'"
            :loading="writes.busy.value"
            :disabled="writes.busy.value"
            data-testid="late-instalment-save"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
