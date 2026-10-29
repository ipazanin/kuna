<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import USelect from '@nuxt/ui/components/Select.vue'

import { MOVEMENT_WRITES, newMovement } from '../application/informalLoanWrites'
import { MOVEMENT_KIND_NAMES } from './informalLoanView'
import { useLoansBooks } from '../../workbook/application/loansStore'
import { MOVEMENT_KINDS } from '../../workbook/domain/movement'
import type { Movement, MovementKind } from '../../workbook/domain/movement'
import type { InformalLoanBook } from '../../workbook/domain/readLoanBook'
import { parseCivilDate } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { amountOf } from '../../../../shared/money/money'
import { typedAmount } from '../../../../shared/money/typedAmount'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import AppDialog from '../../../../shared/ui/AppDialog.vue'
import FormGrid from '../../../../shared/ui/FormGrid.vue'

/** One dated change to what the loan owes: more borrowed, in money or in kind, or some repaid or forgiven. */
const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  book: InformalLoanBook
  /** The movement to change, or null to add one. */
  editing: Movement | null
  /** Where a new movement's date starts. */
  today: CivilDate
}>()

const writes = useRecordWrites(useLoansBooks())

const KIND_HELP: Readonly<Record<MovementKind, string>> = {
  borrowed: 'Money lent on top. It raises what is owed.',
  'borrowed-in-kind': 'The lender paid for something of the borrower’s. It raises what is owed.',
  repaid: 'Money paid back. It lowers what is owed.',
  'repaid-in-kind': 'The borrower paid for something of the lender’s. It lowers what is owed.',
  forgiven: 'Let go by the lender. It lowers what is owed.',
}
const KIND_ITEMS = MOVEMENT_KINDS.map((kind) => ({ label: MOVEMENT_KIND_NAMES[kind], value: kind }))

const date = ref('')
const kind = ref<MovementKind>('repaid')
const amount = ref('')
const note = ref('')
const tried = ref(false)

watch(open, (opened) => {
  if (!opened) return
  const movement = props.editing
  date.value = movement?.date ?? props.today
  kind.value = movement?.kind ?? 'repaid'
  amount.value = movement === null ? '' : amountOf(movement.amount).toFixed(2)
  note.value = movement?.note ?? ''
  tried.value = false
})

const parsedAmount = computed(() => {
  const cents = typedAmount(amount.value)
  return cents !== null && cents > 0 ? cents : null
})

const errors = computed(() => {
  const day = parseCivilDate(date.value)
  return {
    date: day === null ? 'A date, such as 2026-10-12' : day < props.book.loan.start ? 'On or after the loan starts' : null,
    amount: parsedAmount.value === null ? 'An amount above zero with at most two decimals' : null,
  }
})

async function save(): Promise<void> {
  tried.value = true
  const day = parseCivilDate(date.value)
  if (Object.values(errors.value).some((error) => error !== null) || day === null || parsedAmount.value === null) return
  const typed = newMovement({ loan: props.book.loan.id, date: day, kind: kind.value, amount: parsedAmount.value, note: note.value })
  const before = props.editing
  const written =
    before === null
      ? await writes.write('Movement added', (unit) => unit.of(MOVEMENT_WRITES).add(typed), { failedTitle: 'Not added' })
      : await writes.write('Movement saved', (unit) => unit.of(MOVEMENT_WRITES).change(before, { ...typed, id: before.id }), { failedTitle: 'Not saved' })
  if (written) open.value = false
}

async function remove(): Promise<void> {
  const before = props.editing
  if (before === null) return
  if (await writes.write('Movement deleted', (unit) => unit.of(MOVEMENT_WRITES).remove(before), { failedTitle: 'Not deleted' })) open.value = false
}
</script>

<template>
  <AppDialog v-model:open="open" :title="editing === null ? 'Add a movement' : 'Change the movement'" :description="`A dated change to what is owed on ${book.loan.name}.`">
    <FormGrid id="movement" as="form" data-testid="movement-form" @submit.prevent="save">
      <UFormField label="Date" :error="(tried && errors.date) || false">
        <UInput v-model="date" type="date" class="w-full" data-testid="movement-date" />
      </UFormField>
      <UFormField label="Amount" :error="(tried && errors.amount) || false">
        <UInput v-model="amount" inputmode="decimal" placeholder="0.00" class="w-full" data-testid="movement-amount" />
      </UFormField>
      <UFormField label="What happened" :help="KIND_HELP[kind]" class="sm:col-span-2">
        <USelect v-model="kind" :items="KIND_ITEMS" class="w-full" data-testid="movement-kind" />
      </UFormField>
      <UFormField label="Note" help="What it was for, such as boat parts." class="sm:col-span-2">
        <UInput v-model="note" class="w-full" data-testid="movement-note" />
      </UFormField>
    </FormGrid>
    <template #start>
      <UButton v-if="editing !== null" label="Delete movement" icon="i-lucide-trash-2" color="error" variant="ghost" :disabled="writes.busy.value" data-testid="movement-delete" @click="remove" />
    </template>
    <template #end>
      <UButton label="Cancel" color="neutral" variant="ghost" :disabled="writes.busy.value" @click="open = false" />
      <UButton
        type="submit"
        form="movement"
        :label="editing === null ? 'Add movement' : 'Save movement'"
        :icon="editing === null ? 'i-lucide-plus' : 'i-lucide-save'"
        :loading="writes.busy.value"
        :disabled="writes.busy.value"
        data-testid="movement-save"
      />
    </template>
  </AppDialog>
</template>
