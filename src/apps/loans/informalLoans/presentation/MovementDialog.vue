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
import { civilDate, parseCivilDate } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { plainAmount } from '../../../../shared/money/money'
import { typedAmount } from '../../../../shared/money/typedAmount'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import AppDialog from '../../../../shared/ui/AppDialog.vue'
import FormGrid from '../../../../shared/ui/FormGrid.vue'
import MoneyInput from '../../../../shared/ui/MoneyInput.vue'
import { words as loansWords } from '../../words'
import { words } from './words'

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

const KIND_HELP: Readonly<Record<MovementKind, string>> = words.movementDialog.help
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
  amount.value = movement === null ? '' : plainAmount(movement.amount)
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
    date: day === null ? loansWords.form.aDate(civilDate(2026, 10, 12)) : day < props.book.loan.start ? words.movementDialog.afterStart : null,
    amount: parsedAmount.value === null ? loansWords.form.anAmount : null,
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
      ? await writes.write(words.movementDialog.added, (unit) => unit.of(MOVEMENT_WRITES).add(typed), { failedTitle: loansWords.form.notAdded })
      : await writes.write(words.movementDialog.saved, (unit) => unit.of(MOVEMENT_WRITES).change(before, { ...typed, id: before.id }), { failedTitle: loansWords.form.notSaved })
  if (written) open.value = false
}

async function remove(): Promise<void> {
  const before = props.editing
  if (before === null) return
  if (await writes.write(words.movementDialog.deleted, (unit) => unit.of(MOVEMENT_WRITES).remove(before), { failedTitle: loansWords.form.notDeleted })) open.value = false
}
</script>

<template>
  <AppDialog v-model:open="open" :title="editing === null ? words.movementDialog.addTitle : words.movementDialog.changeTitle" :description="words.movementDialog.description(book.loan.name)">
    <FormGrid id="movement" as="form" data-testid="movement-form" @submit.prevent="save">
      <UFormField :label="words.movementDialog.date" :error="(tried && errors.date) || false">
        <UInput v-model="date" type="date" class="w-full" data-testid="movement-date" />
      </UFormField>
      <UFormField :label="words.movementDialog.amount" :error="(tried && errors.amount) || false">
        <MoneyInput v-model="amount" :placeholder="loansWords.form.amountPlaceholder" class="w-full" data-testid="movement-amount" />
      </UFormField>
      <UFormField :label="words.movementDialog.kind" :help="KIND_HELP[kind]" class="sm:col-span-2">
        <USelect v-model="kind" :items="KIND_ITEMS" class="w-full" data-testid="movement-kind" />
      </UFormField>
      <UFormField :label="loansWords.form.note" :help="words.movementDialog.noteHelp" class="sm:col-span-2">
        <UInput v-model="note" class="w-full" data-testid="movement-note" />
      </UFormField>
    </FormGrid>
    <template #start>
      <UButton
        v-if="editing !== null"
        :label="words.movementDialog.delete"
        icon="i-lucide-trash-2"
        color="error"
        variant="ghost"
        :disabled="writes.busy.value"
        data-testid="movement-delete"
        @click="remove"
      />
    </template>
    <template #end>
      <UButton :label="loansWords.form.cancel" color="neutral" variant="ghost" :disabled="writes.busy.value" @click="open = false" />
      <UButton
        type="submit"
        form="movement"
        :label="editing === null ? words.movementDialog.add : words.movementDialog.save"
        :icon="editing === null ? 'i-lucide-plus' : 'i-lucide-save'"
        :loading="writes.busy.value"
        :disabled="writes.busy.value"
        data-testid="movement-save"
      />
    </template>
  </AppDialog>
</template>
