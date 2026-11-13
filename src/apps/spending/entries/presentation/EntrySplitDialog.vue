<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import USelectMenu from '@nuxt/ui/components/SelectMenu.vue'

import { entryCategoryChoices } from './categoryChoices'
import { words } from './words'
import { writeEntrySplit } from '../application/entryWrites'
import { entrySplit } from '../domain/entrySplit'
import type { ItemDraft } from '../domain/entrySplit'
import AccountMoneyText from '../../accounts/presentation/AccountMoneyText.vue'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import type { Transaction } from '../../workbook/domain/transaction'
import { words as spendingWords } from '../../words'
import { absAccountMoney, negateAccountMoney, typedAccountAmount } from '../../../../shared/money/accountMoney'
import type { AccountMoney } from '../../../../shared/money/accountMoney'
import type { CurrencyCode } from '../../../../shared/money/currencyCode'
import { amountForTyping } from '../../../../shared/money/typedAmount'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import AppDialog from '../../../../shared/ui/AppDialog.vue'
import SplitEditor from '../../../../shared/ui/SplitEditor.vue'
import { givenParts, splitField } from '../../../../shared/ui/splitFields'
import type { SplitField } from '../../../../shared/ui/splitFields'

/** The parts you split an entry into, each with an amount, a category and an optional note, and one part that takes the rest. */
const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  entry: Transaction
  currency: CurrencyCode
}>()

const emit = defineEmits<{ saved: [] }>()

const store = useSpendingBooks()
const writes = useRecordWrites(store)

/** Each part holds the id of the entry's part it opened, which it keeps. */
const parts = ref<SplitField<RecordId>[]>([])
const tried = ref(false)

const heldParts = computed(() => (store.state.workbook?.items ?? []).filter((part) => part.transaction === props.entry.id))

watch(open, (opened) => {
  if (!opened) return
  tried.value = false
  const held = heldParts.value
  parts.value =
    held.length === 0
      ? [splitField<RecordId>('', props.entry.category ?? '', '', false), splitField<RecordId>('', '', '', true)]
      : held.map((part, place) => {
          const rest = place === held.length - 1
          return splitField(rest ? '' : amountForTyping(absAccountMoney(part.amount)), part.category, part.text, rest, part.id)
        })
})

const categories = computed(() => store.state.workbook?.categories ?? [])
const side = computed(() => (props.entry.amount < 0 ? 'out' : 'in'))
/** The entry read above zero, as each part is typed. */
const whole = computed(() => absAccountMoney(props.entry.amount))

/** The category a part names, or null while it names none. */
function categoryOf(part: SplitField<RecordId>): RecordId | null {
  return categories.value.find((category) => category.id === part.category)?.id ?? null
}

const choicesOf = (part: SplitField<RecordId>) => entryCategoryChoices(categories.value, side.value, categoryOf(part))

function categoryError(part: SplitField<RecordId>): string | null {
  return categoryOf(part) === null ? words.split.refusals['unknown-category'] : null
}

const signed = (amount: AccountMoney): AccountMoney => (props.entry.amount < 0 ? negateAccountMoney(amount) : amount)

const outcome = computed(() => {
  const book = store.state.workbook
  const given = givenParts(parts.value, typedAccountAmount)
  if (book === null || given === null || parts.value.some((part) => categoryError(part) !== null)) return null
  const drafts = parts.value.map((part, place): ItemDraft => {
    const amount = given[place]!
    return { id: part.held, amount: amount === 'rest' ? 'rest' : signed(amount), category: categoryOf(part)!, text: part.note }
  })
  return entrySplit(book, props.entry, drafts)
})

const refusal = computed(() => (outcome.value !== null && 'refused' in outcome.value ? words.split.refusals[outcome.value.refused] : null))
const changing = computed(() => heldParts.value.length > 0)

async function save(): Promise<void> {
  tried.value = true
  const records = store.state.records
  const split = outcome.value
  if (records === null || split === null || 'refused' in split) return
  if (await writes.write(changing.value ? words.split.changed : words.split.saved, (unit) => writeEntrySplit(unit, records, split), { key: 'split', failedTitle: spendingWords.form.notSaved })) {
    open.value = false
    emit('saved')
  }
}
</script>

<template>
  <AppDialog v-model:open="open" changes width="xl" :title="changing ? words.split.changeTitle : words.split.title" :description="words.split.description(entry.payee, dayLabel(entry.date))">
    <form id="spending-split" class="flex flex-col gap-4" data-testid="spending-split-dialog" @submit.prevent="save">
      <SplitEditor v-model="parts" :whole-label="words.split.whole" :whole="whole" :typed="typedAccountAmount" :tried="tried" :category-error="categoryError" :refusal="refusal">
        <template #whole>
          <AccountMoneyText :cents="entry.amount" :currency="currency" tone="flow" />
        </template>
        <template #category="{ field }">
          <USelectMenu v-model="field.category" :items="choicesOf(field)" value-key="value" :placeholder="words.dialog.pickCategory" class="w-full" data-testid="split-part-category" />
        </template>
        <template #rest="{ cents }">
          <AccountMoneyText :cents="cents" :currency="currency" />
        </template>
      </SplitEditor>
      <p class="type-caption">{{ words.split.sign }}</p>
    </form>
    <template #end>
      <UButton :label="spendingWords.form.cancel" color="neutral" variant="ghost" @click="open = false" />
      <UButton
        type="submit"
        form="spending-split"
        :label="changing ? words.split.save : words.split.split"
        :icon="changing ? 'i-lucide-save' : 'i-lucide-split'"
        :loading="writes.saving('split')"
        :disabled="writes.busy.value || writes.refused.value"
        data-testid="spending-split-save"
      />
    </template>
  </AppDialog>
</template>
