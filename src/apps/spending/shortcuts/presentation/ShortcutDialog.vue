<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import USelect from '@nuxt/ui/components/Select.vue'
import USelectMenu from '@nuxt/ui/components/SelectMenu.vue'

import { addShortcut, changeShortcut, deleteShortcut, newShortcut } from '../application/shortcutWrites'
import { shortcutAmount, shortcutPartProblem } from '../domain/shortcuts'
import type { ShortcutDraft, ShortcutPartProblem, ShortcutWithParts } from '../domain/shortcuts'
import { words } from './words'
import { entryCategoryChoices } from '../../entries/presentation/categoryChoices'
import { words as entryWords } from '../../entries/presentation/words'
import { addLabel } from '../../labels/application/labelWrites'
import { labelCalled, labelNameProblem, newLabel } from '../../labels/domain/labels'
import LabelsSelect from '../../labels/presentation/LabelsSelect.vue'
import PayeeField from '../../payees/presentation/PayeeField.vue'
import AccountMoneyText from '../../accounts/presentation/AccountMoneyText.vue'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import { takesNewRowsByHand } from '../../workbook/domain/account'
import type { Label } from '../../workbook/domain/label'
import { words as spendingWords } from '../../words'
import { absAccountMoney, negateAccountMoney, typedAccountAmount } from '../../../../shared/money/accountMoney'
import type { AccountMoney } from '../../../../shared/money/accountMoney'
import { amountForTyping } from '../../../../shared/money/typedAmount'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import AppDialog from '../../../../shared/ui/AppDialog.vue'
import ChoiceButtons from '../../../../shared/ui/ChoiceButtons.vue'
import FormGrid from '../../../../shared/ui/FormGrid.vue'
import MoneyInput from '../../../../shared/ui/MoneyInput.vue'
import { words as uiWords } from '../../../../shared/ui/words'

/** Makes a quick add, or changes or deletes one: its button's name, its account and payee, which way the money goes, and its parts. */
const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  /** The quick add to change, or null to make one. */
  held: ShortcutWithParts | null
}>()

const store = useSpendingBooks()
const writes = useRecordWrites(store)

/** One part as typed: its amount above zero, category, note and labels, with a key of its own for the list. */
interface PartField {
  readonly key: number
  amount: string
  category: string
  note: string
  labels: readonly RecordId[]
}

let keys = 0
const partField = (fields: Omit<PartField, 'key'>): PartField => ({ ...fields, key: (keys += 1) })

const name = ref('')
const account = ref('')
const payee = ref('')
const kind = ref<'out' | 'in'>('out')
const parts = ref<PartField[]>([])
const created = ref<readonly Label[]>([])
const tried = ref(false)

const book = computed(() => store.state.workbook)
const categories = computed(() => book.value?.categories ?? [])
const labelChoices = computed(() => [...(book.value?.labels ?? []), ...created.value])
const accountItems = computed(() =>
  (book.value?.accounts ?? [])
    .filter((candidate) => takesNewRowsByHand(candidate) || candidate.id === props.held?.shortcut.account)
    .map((candidate) => ({ label: candidate.name, value: candidate.id as string, description: candidate.currency })),
)
const currency = computed(() => book.value?.accounts.find((candidate) => candidate.id === account.value)?.currency ?? '')
const kindOptions = [
  { value: 'out' as const, label: entryWords.dialog.kinds.out },
  { value: 'in' as const, label: entryWords.dialog.kinds.in },
]
const categoryItems = computed(() => entryCategoryChoices(categories.value, kind.value, null))

watch(open, (opened) => {
  if (!opened) return
  const held = props.held
  name.value = held?.shortcut.name ?? ''
  account.value = held?.shortcut.account ?? accountItems.value[0]?.value ?? ''
  payee.value = held?.shortcut.payee ?? ''
  kind.value = (held?.parts[0]?.amount ?? -1) < 0 ? 'out' : 'in'
  parts.value =
    held === null
      ? [partField({ amount: '', category: '', note: '', labels: [] })]
      : held.parts.map((part) => partField({ amount: amountForTyping(absAccountMoney(part.amount)), category: part.category, note: part.note, labels: part.labels }))
  created.value = []
  tried.value = false
})

/** The labels with the one a typed name names: a label already there, or a new one Save adds. A blank name adds none. */
function withTyped(field: PartField, typed: string): void {
  const named = labelCalled(typed, labelChoices.value)
  const label = named ?? (labelNameProblem(typed, labelChoices.value, null) === null ? newLabel(typed) : null)
  if (label === null || field.labels.includes(label.id)) return
  if (named === null) created.value = [...created.value, label]
  field.labels = [...field.labels, label.id]
}

const pickedAccount = computed(() => book.value?.accounts.find((candidate) => candidate.id === account.value) ?? null)
const pickable = computed(() => new Set(categoryItems.value.flat().flatMap((choice) => (choice.value === undefined ? [] : [choice.value]))))

function amountOf(field: PartField): AccountMoney | null {
  const typed = typedAccountAmount(field.amount)
  return typed === null || typed <= 0 ? null : kind.value === 'out' ? negateAccountMoney(typed) : typed
}

/** Each part as it would be written, or null while its amount or category is missing. */
const typedParts = computed(() =>
  parts.value.map((field) => {
    const amount = amountOf(field)
    const category = categories.value.find((candidate) => candidate.id === field.category)
    return amount === null || category === undefined ? null : { amount, category: category.id, note: field.note.trim(), labels: field.labels }
  }),
)
const readyParts = computed(() => typedParts.value.flatMap((part) => (part === null ? [] : [part])))
/** What a tap writes, once every part has an amount. */
const total = computed(() => {
  const amounts = parts.value.flatMap((field) => {
    const amount = amountOf(field)
    return amount === null ? [] : [{ amount }]
  })
  return amounts.length === parts.value.length ? shortcutAmount(amounts) : null
})
/** Why each part cannot be written as the reader reads it, by its place. */
const problems = computed((): readonly (ShortcutPartProblem | null)[] =>
  typedParts.value.map((part) => (part === null ? null : shortcutPartProblem(part, readyParts.value, { categories: categories.value, labels: labelChoices.value }))),
)

function amountError(field: PartField, index: number): string | null {
  const problem = problems.value[index]
  return amountOf(field) === null ? entryWords.dialog.anAmount : problem === 'zero' || problem === 'mixed-ways' ? words.dialog.refusals[problem] : null
}

function categoryError(field: PartField, index: number): string | null {
  const problem = problems.value[index]
  return !pickable.value.has(field.category) ? entryWords.dialog.pickCategory : problem === 'unknown-category' || problem === 'between-accounts' ? words.dialog.refusals[problem] : null
}

function labelsError(index: number): string | null {
  return problems.value[index] === 'unknown-label' ? words.dialog.refusals['unknown-label'] : null
}

/** The quick add as typed, or null while a field is missing or a part cannot be written as the reader reads it. */
const draft = computed((): ShortcutDraft | null => {
  const onAccount = pickedAccount.value
  if (onAccount === null || readyParts.value.length !== parts.value.length || readyParts.value.length === 0 || problems.value.some((problem) => problem !== null)) return null
  return { name: name.value, account: onAccount.id, payee: payee.value, parts: readyParts.value }
})

function addPart(): void {
  parts.value = [...parts.value, partField({ amount: '', category: '', note: '', labels: [] })]
}

function removePart(key: number): void {
  parts.value = parts.value.filter((field) => field.key !== key)
}

async function save(): Promise<void> {
  tried.value = true
  const typed = draft.value
  const held = props.held
  const records = store.state.records
  if (typed === null || records === null) return
  const carried = new Set(typed.parts.flatMap((part) => part.labels))
  const added = created.value.filter((label) => carried.has(label.id))
  const written = await writes.write(
    held === null ? words.made : words.dialog.saved,
    (unit) => {
      added.forEach((label) => addLabel(unit, label))
      if (held === null) addShortcut(unit, newShortcut(records, typed))
      else changeShortcut(unit, held, typed)
    },
    { failedTitle: held === null ? spendingWords.form.notAdded : spendingWords.form.notSaved },
  )
  if (written) open.value = false
}

async function remove(): Promise<void> {
  const held = props.held
  if (held !== null && (await writes.write(words.dialog.deleted, (unit) => deleteShortcut(unit, held), { key: 'delete', failedTitle: spendingWords.form.notDeleted }))) open.value = false
}
</script>

<template>
  <AppDialog v-model:open="open" changes :title="held === null ? words.dialog.addTitle : words.dialog.changeTitle" :description="words.dialog.description">
    <FormGrid id="spending-shortcut" as="form" data-testid="spending-shortcut-dialog" @submit.prevent="save">
      <UFormField :label="words.dialog.name" :help="words.dialog.nameHelp">
        <UInput v-model="name" class="w-full" data-testid="spending-shortcut-name" />
      </UFormField>
      <UFormField :label="entryWords.dialog.payee">
        <PayeeField v-model="payee" data-testid="spending-shortcut-payee" />
      </UFormField>
      <UFormField :label="entryWords.dialog.account" :error="(tried && pickedAccount === null && entryWords.dialog.pickAccount) || false">
        <USelect v-model="account" :items="accountItems" class="w-full" data-testid="spending-shortcut-account" />
      </UFormField>
      <UFormField :label="entryWords.dialog.kind">
        <ChoiceButtons v-model="kind" :options="kindOptions" :label="entryWords.dialog.kind" data-testid="spending-shortcut-kind" />
      </UFormField>
      <div class="flex flex-col gap-3 sm:col-span-2">
        <p v-if="total !== null && pickedAccount !== null" class="type-caption" data-testid="spending-shortcut-total">
          {{ words.dialog.total }} <AccountMoneyText :cents="total" :currency="pickedAccount.currency" tone="flow" />
        </p>
        <ol class="flex flex-col gap-3" :aria-label="uiWords.split.parts">
          <li
            v-for="(field, index) in parts"
            :key="field.key"
            class="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-x-3 gap-y-2 border-b border-default pb-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
            data-testid="spending-shortcut-part"
          >
            <UFormField
              :label="parts.length === 1 ? entryWords.dialog.amountIn(currency) : uiWords.split.part(index + 1)"
              :error="(tried && amountError(field, index)) || false"
              :class="{ 'col-span-2 sm:col-span-1': parts.length === 1 }"
            >
              <MoneyInput
                v-model="field.amount"
                :placeholder="spendingWords.form.amountPlaceholder"
                :aria-label="uiWords.split.amountOf(index + 1)"
                class="w-full"
                data-testid="spending-shortcut-amount"
              />
            </UFormField>
            <UButton
              v-if="parts.length > 1"
              icon="i-lucide-x"
              color="neutral"
              variant="ghost"
              class="sm:col-start-3 sm:row-start-1"
              :aria-label="uiWords.split.removePart(index + 1)"
              data-testid="spending-shortcut-remove-part"
              @click="removePart(field.key)"
            />
            <UFormField
              :label="entryWords.dialog.category"
              :error="(tried && categoryError(field, index)) || false"
              class="col-span-2 sm:col-start-2 sm:row-start-1"
              :class="parts.length === 1 ? 'sm:col-span-2' : 'sm:col-span-1'"
            >
              <USelectMenu v-model="field.category" :items="categoryItems" value-key="value" :placeholder="entryWords.dialog.pickCategory" class="w-full" data-testid="spending-shortcut-category" />
            </UFormField>
            <UFormField :label="spendingWords.form.note" class="col-span-2 sm:col-span-1">
              <UInput v-model="field.note" class="w-full" data-testid="spending-shortcut-note" />
            </UFormField>
            <UFormField v-if="labelChoices.length > 0 || created.length > 0" :label="entryWords.dialog.labels" :error="(tried && labelsError(index)) || false" class="col-span-2">
              <LabelsSelect v-model="field.labels" :labels="labelChoices" :name="entryWords.dialog.partLabels(uiWords.split.part(index + 1))" class="w-full" @create="withTyped(field, $event)" />
            </UFormField>
          </li>
        </ol>
      </div>
      <UButton
        :label="uiWords.split.addPart"
        icon="i-lucide-plus"
        color="neutral"
        variant="outline"
        class="justify-self-start sm:col-span-2"
        data-testid="spending-shortcut-add-part"
        @click="addPart"
      />
    </FormGrid>
    <template #start>
      <UButton
        v-if="held !== null"
        :label="entryWords.dialog.delete"
        icon="i-lucide-trash-2"
        color="error"
        variant="ghost"
        :loading="writes.saving('delete')"
        :disabled="writes.busy.value || writes.refused.value"
        data-testid="spending-shortcut-delete"
        @click="remove"
      />
    </template>
    <template #end>
      <UButton :label="spendingWords.form.cancel" color="neutral" variant="ghost" @click="open = false" />
      <UButton
        type="submit"
        form="spending-shortcut"
        :label="held === null ? entryWords.dialog.add : entryWords.dialog.save"
        :icon="held === null ? 'i-lucide-plus' : 'i-lucide-save'"
        :loading="writes.saving('save')"
        :disabled="writes.busy.value || writes.refused.value"
        data-testid="spending-shortcut-save"
      />
    </template>
  </AppDialog>
</template>
