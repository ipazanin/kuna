<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import USelectMenu from '@nuxt/ui/components/SelectMenu.vue'

import { entryCategoryChoices } from './categoryChoices'
import { words } from './words'
import { writeEntrySplit } from '../application/entryWrites'
import { entrySplit } from '../domain/entrySplit'
import type { PartDraft } from '../domain/entrySplit'
import AccountMoneyText from '../../accounts/presentation/AccountMoneyText.vue'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import type { Transaction } from '../../workbook/domain/transaction'
import { words as spendingWords } from '../../words'
import { ZERO_ACCOUNT_MONEY, absAccountMoney, negateAccountMoney, typedAccountAmount } from '../../../../shared/money/accountMoney'
import type { AccountMoney } from '../../../../shared/money/accountMoney'
import type { CurrencyCode } from '../../../../shared/money/currencyCode'
import { restOfWhole } from '../../../../shared/money/partsOfWhole'
import { amountForTyping } from '../../../../shared/money/typedAmount'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import AppDialog from '../../../../shared/ui/AppDialog.vue'
import MoneyInput from '../../../../shared/ui/MoneyInput.vue'

/** The parts you split an entry into, each with an amount, a category and an optional note, and one part that takes the rest. */
const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  entry: Transaction
  currency: CurrencyCode
}>()

const emit = defineEmits<{ saved: [] }>()

const store = useSpendingBooks()
const writes = useRecordWrites(store)

interface PartField {
  /** Unique within the dialog, so a removed part takes its fields with it. */
  readonly id: number
  amount: string
  category: string
  text: string
  rest: boolean
}

const parts = ref<PartField[]>([])
const tried = ref(false)
let nextId = 0

function field(amount: AccountMoney | null, category: string, text: string, rest: boolean): PartField {
  nextId += 1
  return { id: nextId, amount: amount === null ? '' : amountForTyping(absAccountMoney(amount)), category, text, rest }
}

const heldParts = computed(() => (store.state.workbook?.lines ?? []).filter((part) => part.transaction === props.entry.id))

watch(open, (opened) => {
  if (!opened) return
  tried.value = false
  const held = heldParts.value
  parts.value =
    held.length === 0
      ? [field(null, props.entry.category ?? '', '', false), field(null, '', '', true)]
      : held.map((part, place) => field(place === held.length - 1 ? null : part.amount, part.category, part.text, place === held.length - 1))
})

const categories = computed(() => store.state.workbook?.categories ?? [])
const side = computed(() => (props.entry.amount < 0 ? 'out' : 'in'))
/** The category a part names, or null while it names none. */
function categoryOf(part: PartField): RecordId | null {
  return categories.value.find((category) => category.id === part.category)?.id ?? null
}

const choicesOf = (part: PartField) => entryCategoryChoices(categories.value, side.value, categoryOf(part))

/** A typed amount above zero signed as the entry is, or null for one that does not read. */
function signedOf(part: PartField): AccountMoney | null {
  const typed = typedAccountAmount(part.amount)
  return typed === null ? null : props.entry.amount < 0 ? negateAccountMoney(typed) : typed
}

/** What the parts with amounts leave of the entry, read above zero while it is on the entry's side. */
const rest = computed(() => {
  const signed = restOfWhole(
    props.entry.amount,
    parts.value.filter((part) => !part.rest).map((part) => signedOf(part) ?? ZERO_ACCOUNT_MONEY),
  )
  return props.entry.amount < 0 ? negateAccountMoney(signed) : signed
})

function amountError(part: PartField): string | null {
  return !part.rest && signedOf(part) === null ? words.split.anAmount : null
}

function categoryError(part: PartField): string | null {
  return categoryOf(part) === null ? words.split.refusals['unknown-category'] : null
}

const outcome = computed(() => {
  const book = store.state.workbook
  if (book === null || parts.value.some((part) => amountError(part) !== null || categoryError(part) !== null)) return null
  const drafts = parts.value.map((part): PartDraft => ({ amount: part.rest ? 'rest' : signedOf(part)!, category: categoryOf(part)!, text: part.text }))
  return entrySplit(book, props.entry, drafts)
})

/** Why the parts cannot go: over at once while typing, since the rest shows it in red, and any other reason once Split was pressed. */
const refusal = computed(() => {
  if (rest.value <= 0) return words.split.refusals.over
  return tried.value && outcome.value !== null && 'refused' in outcome.value ? words.split.refusals[outcome.value.refused] : null
})
const changing = computed(() => heldParts.value.length > 0)

function addPart(): void {
  parts.value = [...parts.value, field(null, '', '', false)]
}

function removePart(id: number): void {
  const kept = parts.value.filter((part) => part.id !== id)
  const last = kept[kept.length - 1]
  if (last !== undefined && !kept.some((part) => part.rest)) last.rest = true
  parts.value = kept
}

function takeRest(id: number): void {
  for (const part of parts.value) part.rest = part.id === id
  const taking = parts.value.find((part) => part.id === id)
  if (taking !== undefined) taking.amount = ''
}

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
  <AppDialog v-model:open="open" width="xl" :title="changing ? words.split.changeTitle : words.split.title" :description="words.split.description(entry.payee, dayLabel(entry.date))">
    <form id="spending-split" class="flex flex-col gap-4" data-testid="spending-split-dialog" @submit.prevent="save">
      <p class="flex items-baseline justify-between gap-3 type-body">
        <span class="text-toned">{{ words.split.whole }}</span>
        <AccountMoneyText :cents="entry.amount" :currency="currency" tone="flow" class="font-medium" />
      </p>
      <ol class="flex flex-col gap-3" :aria-label="words.split.parts">
        <li
          v-for="(part, index) in parts"
          :key="part.id"
          class="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-x-3 gap-y-2 border-b border-default pb-3 sm:grid-cols-[9rem_minmax(0,1fr)_auto]"
          data-testid="spending-split-part"
        >
          <UFormField :label="part.rest ? words.split.rest : words.split.part(index + 1)" :error="(tried && amountError(part)) || false" class="col-start-1 row-start-1">
            <p v-if="part.rest" class="flex min-h-8 items-center" data-testid="spending-split-rest">
              <AccountMoneyText :cents="rest" :currency="currency" :class="rest <= 0 ? 'text-error' : 'font-medium'" />
            </p>
            <div v-else class="flex gap-1">
              <MoneyInput v-model="part.amount" :placeholder="spendingWords.form.amountPlaceholder" :aria-label="words.split.amountOf(index + 1)" class="w-full" data-testid="spending-split-amount" />
              <UButton
                icon="i-lucide-arrow-down-to-line"
                color="neutral"
                variant="ghost"
                :aria-label="words.split.takeRest(index + 1)"
                data-testid="spending-split-take-rest"
                @click="takeRest(part.id)"
              />
            </div>
          </UFormField>
          <UFormField :label="words.split.category" :error="(tried && categoryError(part)) || false" class="col-span-2 sm:col-span-1 sm:col-start-2 sm:row-start-1">
            <USelectMenu v-model="part.category" :items="choicesOf(part)" value-key="value" :placeholder="words.dialog.pickCategory" class="w-full" data-testid="spending-split-category" />
          </UFormField>
          <UButton
            icon="i-lucide-x"
            color="neutral"
            variant="ghost"
            class="col-start-2 row-start-1 sm:col-start-3"
            :disabled="parts.length <= 2"
            :aria-label="words.split.removePart(index + 1)"
            data-testid="spending-split-remove-part"
            @click="removePart(part.id)"
          />
          <UFormField :label="words.split.text" class="col-span-2 sm:col-span-3">
            <UInput v-model="part.text" :placeholder="words.split.textPlaceholder" class="w-full" data-testid="spending-split-text" />
          </UFormField>
        </li>
      </ol>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <UButton :label="words.split.addPart" icon="i-lucide-plus" color="neutral" variant="outline" data-testid="spending-split-add-part" @click="addPart" />
      </div>
      <p class="type-caption">{{ words.split.sign }}</p>
      <UAlert v-if="refusal !== null" icon="i-lucide-triangle-alert" color="error" variant="subtle" :title="refusal" data-testid="spending-split-refusal" />
    </form>
    <template #end>
      <UButton :label="spendingWords.form.cancel" color="neutral" variant="ghost" @click="open = false" />
      <UButton
        type="submit"
        form="spending-split"
        :label="changing ? words.split.save : words.split.split"
        :icon="changing ? 'i-lucide-save' : 'i-lucide-split'"
        :loading="writes.saving('split')"
        :disabled="writes.busy.value"
        data-testid="spending-split-save"
      />
    </template>
  </AppDialog>
</template>
