<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import URadioGroup from '@nuxt/ui/components/RadioGroup.vue'
import USelect from '@nuxt/ui/components/Select.vue'
import USelectMenu from '@nuxt/ui/components/SelectMenu.vue'
import USwitch from '@nuxt/ui/components/Switch.vue'

import { receiptPhotos } from './receiptPhotosPort'
import { useReceiptPhoto } from './useReceiptPhoto'
import { words } from './words'
import { writeReceiptSplit } from '../application/receiptWrites'
import { receiptMatches } from '../domain/receiptMatch'
import type { ReceiptCandidate } from '../domain/receiptMatch'
import { receiptSplit } from '../domain/receiptSplit'
import type { ReceiptPlace } from '../domain/receiptSplit'
import { entryCategoryChoices } from '../../entries/presentation/categoryChoices'
import { rememberLastAccount, startingAccount } from '../../entries/presentation/lastAccount'
import { words as entryWords } from '../../entries/presentation/words'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import { words as spendingWords } from '../../words'
import { civilDate, parseCivilDate, today } from '../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { EURO } from '../../../../shared/money/currencyCode'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import { typedAmount } from '../../../../shared/money/typedAmount'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import AppDialog from '../../../../shared/ui/AppDialog.vue'
import FileDrop from '../../../../shared/ui/FileDrop.vue'
import FormGrid from '../../../../shared/ui/FormGrid.vue'
import MoneyInput from '../../../../shared/ui/MoneyInput.vue'

/** A receipt photo to the payment it splits: the QR code's date and total, or typed ones, and one category for the whole receipt. Nothing is written until Save, and closing the dialog drops the photo. */
const open = defineModel<boolean>('open', { required: true })

const store = useSpendingBooks()
const writes = useRecordWrites(store)
const { photo, preview, reading, qr, read, forget } = useReceiptPhoto()

/** The radio value of a new entry, beside the candidates' row ids. */
const NEW_ENTRY = 'new'

const book = computed(() => store.state.workbook)
const categories = computed(() => book.value?.categories ?? [])

const picked = ref<File | null>(null)
const typedTotal = ref('')
const typedDate = ref('')
const merchant = ref('')
const pickedPlace = ref<string | null>(null)
const pickedCategory = ref('')
const account = ref('')
const keepPhoto = ref(false)
const tried = ref(false)
const failure = ref<string | null>(null)

watch(picked, (file) => {
  if (file !== null) void read(file)
})

watch(open, (opened) => {
  if (opened) {
    typedDate.value = today()
    account.value = startingAccount(euroAccounts.value)?.id ?? ''
    return
  }
  forget()
  picked.value = null
  typedTotal.value = ''
  merchant.value = ''
  pickedPlace.value = null
  pickedCategory.value = ''
  keepPhoto.value = false
  tried.value = false
  failure.value = null
})

const euroAccounts = computed(() => (book.value?.accounts ?? []).filter((candidate) => !candidate.closed && candidate.currency === EURO))
const accountItems = computed(() => euroAccounts.value.map((candidate) => ({ label: candidate.name, value: candidate.id as string })))

const total = computed(() => {
  if (qr.value !== null) return qr.value.total
  const typed = typedAmount(typedTotal.value)
  return typed === null || typed <= 0 ? null : typed
})
const issuedOn = computed(() => qr.value?.issuedOn ?? parseCivilDate(typedDate.value))

const matches = computed(() => {
  const current = book.value
  return current === null || total.value === null || issuedOn.value === null ? null : receiptMatches({ merchant: merchant.value, issuedOn: issuedOn.value, total: total.value }, current)
})
watch(matches, () => {
  pickedPlace.value = null
})

const candidates = computed((): readonly ReceiptCandidate[] => (matches.value === null || matches.value.kind === 'none' ? [] : matches.value.candidates))

/** A ready candidate is taken unless you say otherwise, and with none the receipt makes a new entry. */
const place = computed(() => {
  if (pickedPlace.value !== null) return pickedPlace.value
  if (matches.value?.kind === 'ready') return candidates.value[0]?.row.id ?? ''
  return matches.value?.kind === 'none' ? NEW_ENTRY : ''
})
const chosenRow = computed(() => candidates.value.find((candidate) => candidate.row.id === place.value)?.row ?? null)

const accountOfRow = (accountId: string) => book.value?.accounts.find((candidate) => candidate.id === accountId) ?? null

const heading = computed(() => {
  const [first] = candidates.value
  if (first === undefined) return ''
  if (matches.value?.kind === 'pick') return words.pick
  return accountOfRow(first.row.account)?.kind === 'cash' ? words.matchesCash(first.row.date) : words.matchesCard(first.row.date)
})

const placeItems = computed(() => [
  ...candidates.value.map(({ row, difference }) => ({
    value: row.id as string,
    label: `${row.payee === '' ? (accountOfRow(row.account)?.name ?? '') : row.payee} · ${formatMoney(row.amount)}`,
    description: [dayLabel(row.date), accountOfRow(row.account)?.name ?? '', difference === 0 ? '' : words.differs(formatMoney(difference, 'always'))].filter((part) => part !== '').join(' · '),
  })),
  { value: NEW_ENTRY, label: words.newEntry },
])

/** The category of the row picked is the first offer. */
const categoryItems = computed(() => entryCategoryChoices(categories.value, 'out', chosenRow.value?.category ?? null))
const pickable = computed(() => new Set(categoryItems.value.flat().flatMap((choice) => (choice.value === undefined ? [] : [choice.value]))))
const category = computed<string>({
  get: () => (pickedCategory.value !== '' ? pickedCategory.value : (chosenRow.value?.category ?? '')),
  set: (id) => {
    pickedCategory.value = id
  },
})

const onDrive = computed(() => store.state.choice?.source === 'drive')

const newAccount = computed(() => euroAccounts.value.find((candidate) => candidate.id === account.value) ?? null)
const newEntryPlaced = computed(() => place.value === NEW_ENTRY)

const errors = computed(() => ({
  total: total.value === null ? words.aTotal : null,
  date: issuedOn.value === null ? spendingWords.form.aDate(civilDate(2026, 3, 15)) : null,
  place: place.value === '' ? words.pickError : null,
  account:
    !newEntryPlaced.value || issuedOn.value === null
      ? null
      : newAccount.value === null
        ? words.pickAccount
        : issuedOn.value < newAccount.value.openedOn
          ? entryWords.dialog.beforeOpened(newAccount.value.openedOn)
          : null,
  category: !pickable.value.has(category.value) ? words.pickCategory : null,
}))

async function save(): Promise<void> {
  tried.value = true
  failure.value = null
  const file = photo.value
  const day = issuedOn.value
  const sum = total.value
  const row = chosenRow.value
  const chosenAccount = newAccount.value
  const filed = categories.value.find((candidate) => candidate.id === category.value)
  const where: ReceiptPlace | null = row !== null ? { row } : chosenAccount === null ? null : { account: chosenAccount.id }
  const fileId = store.state.choice?.id
  if (Object.values(errors.value).some((error) => error !== null) || file === null || day === null || sum === null || filed === undefined || where === null) return
  let photoId = ''
  if (keepPhoto.value && fileId !== undefined) {
    try {
      // First in the click, since Firefox opens Google's popup only while the click is recent. Its id has to be in the one write.
      photoId = await (await receiptPhotos(fileId)).keep(file, day)
    } catch (reason) {
      failure.value = `${words.notKept}: ${reason instanceof Error ? reason.message : String(reason)}`
      return
    }
  }
  const split = receiptSplit(
    { merchant: merchant.value, issuedOn: day, issuedTime: qr.value?.issuedTime ?? '', total: sum, jir: qr.value?.jir ?? '', zki: qr.value?.zki ?? '', photo: photoId },
    where,
    filed.id,
  )
  if (!(await writes.write(words.saved, (unit) => writeReceiptSplit(unit, split), { failedTitle: words.notSaved }))) return
  if (chosenAccount !== null && row === null) rememberLastAccount(chosenAccount)
  open.value = false
}
</script>

<template>
  <AppDialog v-model:open="open" :title="words.add" :description="words.description">
    <div v-if="photo === null" class="grid gap-3 sm:grid-cols-2" data-testid="spending-receipt-take">
      <div data-testid="spending-receipt-camera">
        <FileDrop v-model="picked" accept="image/*" capture="environment" icon="i-lucide-camera" :label="words.take" :description="words.takeHelp" />
      </div>
      <div data-testid="spending-receipt-upload">
        <FileDrop v-model="picked" accept="image/*" icon="i-lucide-upload" :label="words.upload" :description="words.uploadHelp" />
      </div>
    </div>
    <FormGrid v-else id="spending-receipt" as="form" data-testid="spending-receipt-form" @submit.prevent="save">
      <div class="flex items-start gap-3" data-testid="spending-receipt-photo">
        <img v-if="preview !== null" :src="preview" :alt="words.photo" class="h-24 w-18 shrink-0 rounded-sm border border-default object-cover" data-testid="spending-receipt-preview" />
        <div class="flex min-w-0 flex-col gap-1 text-sm" data-testid="spending-receipt-reading" :data-reading="reading">
          <p v-if="reading === 'reading'" class="flex items-center gap-2 text-muted">
            <UIcon name="i-lucide-loader-circle" class="size-4 animate-spin" aria-hidden="true" />
            {{ words.reading }}
          </p>
          <template v-else-if="qr !== null">
            <p class="text-highlighted" data-testid="spending-receipt-qr">{{ words.qrSays(formatMoney(qr.total)) }}</p>
            <p class="type-caption">{{ words.issued(qr.issuedOn, qr.issuedTime) }}</p>
          </template>
          <p v-else-if="reading === 'unreadable'" class="text-highlighted" data-testid="spending-receipt-unreadable">{{ words.unreadable }}</p>
          <p v-else class="text-muted" data-testid="spending-receipt-no-code">{{ words.noCode }}</p>
        </div>
      </div>
      <template v-if="reading !== 'reading' && qr === null">
        <UFormField :label="words.total" :error="(tried && errors.total) || false">
          <MoneyInput v-model="typedTotal" :placeholder="spendingWords.form.amountPlaceholder" class="w-full" data-testid="spending-receipt-total" />
        </UFormField>
        <UFormField :label="words.date" :error="(tried && errors.date) || false">
          <UInput v-model="typedDate" type="date" class="w-full" data-testid="spending-receipt-date" />
        </UFormField>
      </template>
      <UFormField :label="words.merchant" :help="words.merchantHelp">
        <UInput v-model="merchant" class="w-full" data-testid="spending-receipt-merchant" />
      </UFormField>
      <UFormField :label="words.category" :error="(tried && errors.category) || false">
        <USelectMenu v-model="category" :items="categoryItems" value-key="value" :placeholder="words.pickCategory" class="w-full" data-testid="spending-receipt-category" />
      </UFormField>
      <URadioGroup
        v-if="candidates.length > 0"
        :model-value="place"
        :items="placeItems"
        :legend="heading"
        variant="card"
        :ui="{ fieldset: 'gap-2' }"
        data-testid="spending-receipt-place"
        :data-match="matches?.kind"
        @update:model-value="pickedPlace = String($event)"
      />
      <p v-if="tried && errors.place !== null" class="text-sm text-error" data-testid="spending-receipt-place-error">{{ errors.place }}</p>
      <p v-if="matches?.kind === 'none'" class="text-sm text-muted" data-testid="spending-receipt-no-match">{{ words.noMatch }}</p>
      <UFormField v-if="newEntryPlaced" :label="words.account" :help="words.accountHelp" :error="(tried && errors.account) || false">
        <USelect v-model="account" :items="accountItems" class="w-full" data-testid="spending-receipt-account" />
      </UFormField>
      <UFormField class="sm:col-span-2">
        <USwitch v-model="keepPhoto" :label="words.keep" :description="onDrive ? words.keepHelp : words.keepOnlyDrive" :disabled="!onDrive" data-testid="spending-receipt-keep" />
      </UFormField>
      <UAlert v-if="failure !== null" icon="i-lucide-triangle-alert" color="error" variant="subtle" :title="failure" data-testid="spending-receipt-failure" />
    </FormGrid>
    <template #end>
      <UButton :label="spendingWords.form.cancel" color="neutral" variant="ghost" @click="open = false" />
      <UButton
        v-if="photo !== null"
        type="submit"
        form="spending-receipt"
        :label="words.save"
        icon="i-lucide-save"
        :loading="writes.saving('save')"
        :disabled="reading === 'reading' || writes.busy.value"
        data-testid="spending-receipt-save"
      />
    </template>
  </AppDialog>
</template>
