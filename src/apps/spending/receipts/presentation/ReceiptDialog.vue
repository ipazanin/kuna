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

import { canKeepPhotoNow, receiptPhotos } from './receiptPhotosPort'
import { useReceiptPhoto } from './useReceiptPhoto'
import { useReceiptSave } from './useReceiptSave'
import { words } from './words'
import { writeReceiptSplit } from '../application/receiptWrites'
import { NEW_ENTRY, heldReceiptOf, placeOf, receiptAccounts, receiptMatches } from '../domain/receiptMatch'
import type { ReceiptCandidate } from '../domain/receiptMatch'
import { receiptSplit, rowPlace, wholeReceipt } from '../domain/receiptSplit'
import type { ReceiptPlace } from '../domain/receiptSplit'
import { entryCategoryChoices } from '../../entries/presentation/categoryChoices'
import { lastUsedAccount, rememberLastAccount } from '../../entries/infrastructure/lastAccount'
import { words as entryWords } from '../../entries/presentation/words'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import { beforeStartDay, takesRowsByHand } from '../../workbook/domain/account'
import { words as spendingWords } from '../../words'
import { civilDate, parseCivilDate, today } from '../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { formatAccountMoney, formatMoney } from '../../../../shared/money/moneyFormat'
import { typedAmount } from '../../../../shared/money/typedAmount'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import AppDialog from '../../../../shared/ui/AppDialog.vue'
import DayField from '../../../../shared/ui/DayField.vue'
import FileDrop from '../../../../shared/ui/FileDrop.vue'
import FormGrid from '../../../../shared/ui/FormGrid.vue'
import MoneyInput from '../../../../shared/ui/MoneyInput.vue'
import { EURO } from '../../../../shared/money/currencyCode'

/** A receipt photo to the payment it splits: the QR code's date and total, or typed ones, with one category for the whole receipt. Closing the dialog drops the photo. Reading its lines is asked of the chat from Entries. */
const open = defineModel<boolean>('open', { required: true })

const store = useSpendingBooks()
const writes = useRecordWrites(store)
const { photo, preview, reading, qr, place: photoPlace, read, forget } = useReceiptPhoto()

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
const keepAllowed = ref(true)

const saves = useReceiptSave(() => receiptPhotos(store.state.choice?.id ?? ''))

watch(picked, (file) => {
  if (file !== null) void read(file)
})

watch(open, (opened) => {
  if (opened) {
    typedDate.value = today()
    account.value = lastUsedAccount(euroAccounts.value)?.id ?? ''
    keepAllowed.value = canKeepPhotoNow()
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

const euroAccounts = computed(() => receiptAccounts(book.value?.accounts ?? []))
const accountItems = computed(() => euroAccounts.value.map((candidate) => ({ label: candidate.name, value: candidate.id as string })))

const total = computed(() => {
  if (qr.value !== null) return qr.value.total
  const typed = typedAmount(typedTotal.value)
  return typed === null || typed <= 0 ? null : typed
})
const issuedOn = computed(() => qr.value?.issuedOn ?? parseCivilDate(typedDate.value))

const matches = computed(() => {
  const current = book.value
  return current === null || total.value === null || issuedOn.value === null ? null : receiptMatches({ merchant: merchant.value, issuedOn: issuedOn.value, total: total.value }, current, null)
})

const candidates = computed((): readonly ReceiptCandidate[] => (matches.value === null || matches.value.kind === 'none' ? [] : matches.value.candidates))

const place = computed(() => placeOf(matches.value, pickedPlace.value))
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
    label: `${row.payee === '' ? (accountOfRow(row.account)?.name ?? '') : row.payee} · ${formatAccountMoney(row.amount, EURO)}`,
    description: [
      dayLabel(row.date),
      accountOfRow(row.account)?.name ?? '',
      difference === 0 ? '' : words.differs(formatAccountMoney(difference, EURO, 'always')),
      rowPlace(row, book.value?.lines ?? []).handParts.length > 0 ? words.replacesSplit : '',
    ]
      .filter((part) => part !== '')
      .join(' · '),
  })),
  { value: NEW_ENTRY, label: waits.value ? words.waitForBank : words.newEntry },
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
const keepReason = computed(() => (!onDrive.value ? words.keepOnlyDrive : keepAllowed.value ? null : words.keepNeedsAccess))

/** This fiscal receipt as the file holds it already, as its QR code's JIR or ZKI names it. */
const heldReceipt = computed(() => (qr.value === null ? null : heldReceiptOf(qr.value, book.value?.receipts ?? [])))
const heldRow = computed(() => book.value?.transactions.find((row) => row.id === heldReceipt.value?.transaction) ?? null)

const newAccount = computed(() => euroAccounts.value.find((candidate) => candidate.id === account.value) ?? null)
const newEntryPlaced = computed(() => place.value === NEW_ENTRY)
/** On an account the bank fills, a receipt with no payment yet waits for the bank's row instead of making one. */
const waits = computed(() => newAccount.value !== null && !takesRowsByHand(newAccount.value))

const errors = computed(() => ({
  held: heldReceipt.value === null ? null : heldRow.value === null ? words.alreadyWaiting : words.alreadyHeld(heldRow.value.date, formatAccountMoney(heldRow.value.amount, EURO)),
  total: total.value === null ? words.aTotal : null,
  date: issuedOn.value === null ? spendingWords.form.aDate(civilDate(2026, 3, 15)) : null,
  place: place.value === '' ? words.pickError : null,
  account:
    !newEntryPlaced.value || issuedOn.value === null
      ? null
      : newAccount.value === null
        ? words.pickAccount
        : beforeStartDay(newAccount.value, issuedOn.value)
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
  const where: ReceiptPlace | null = row !== null ? rowPlace(row, book.value?.lines ?? []) : chosenAccount === null ? null : { account: chosenAccount }
  if (Object.values(errors.value).some((error) => error !== null) || file === null || day === null || sum === null || where === null || filed === undefined) return
  const draft = {
    merchant: merchant.value,
    merchantOib: '',
    buyerOib: '',
    issuedOn: day,
    total: sum,
    readBy: '',
    issuedTime: qr.value?.issuedTime ?? '',
    jir: qr.value?.jir ?? '',
    zki: qr.value?.zki ?? '',
    latitude: photoPlace.value?.latitude ?? '',
    longitude: photoPlace.value?.longitude ?? '',
  }
  const outcome = await saves.save(keepPhoto.value && keepReason.value === null ? { file, issuedOn: day } : null, (photoId) =>
    writes.write(words.saved, (unit) => writeReceiptSplit(unit, receiptSplit({ ...draft, photo: photoId }, where, wholeReceipt(sum, filed.id))), { failedTitle: words.notSaved }),
  )
  if (outcome.kind === 'photo-failed') failure.value = `${words.notKept}: ${outcome.reason}`
  if (outcome.kind !== 'saved') return
  if (chosenAccount !== null && row === null) rememberLastAccount(chosenAccount)
  open.value = false
}

/** A save under way finishes before the dialog closes, so what it writes is what the dialog showed. */
function closeAsked(wanted: boolean): void {
  if (!saves.saving.value) open.value = wanted
}
</script>

<template>
  <AppDialog :open="open" :title="words.add" :description="words.description" @update:open="closeAsked">
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
          <p v-if="photoPlace !== null" class="type-caption" data-testid="spending-receipt-place-found">{{ words.placeFound(photoPlace.latitude, photoPlace.longitude) }}</p>
        </div>
      </div>
      <UAlert v-if="errors.held !== null" icon="i-lucide-copy-x" color="error" variant="subtle" :title="errors.held" data-testid="spending-receipt-held" />
      <template v-if="reading !== 'reading' && qr === null">
        <UFormField :label="words.total" :error="(tried && errors.total) || false">
          <MoneyInput v-model="typedTotal" :placeholder="spendingWords.form.amountPlaceholder" class="w-full" data-testid="spending-receipt-total" />
        </UFormField>
        <UFormField :label="words.date" :error="(tried && errors.date) || false">
          <DayField v-model="typedDate" class="w-full" data-testid="spending-receipt-date" />
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
      <p v-if="matches?.kind === 'none'" class="text-sm text-muted" data-testid="spending-receipt-no-match">{{ waits ? words.noMatchWaits : words.noMatch }}</p>
      <UFormField v-if="newEntryPlaced" :label="words.account" :help="words.accountHelp" :error="(tried && errors.account) || false" data-testid="spending-receipt-account-field">
        <USelect v-model="account" :items="accountItems" class="w-full" data-testid="spending-receipt-account" />
      </UFormField>
      <UAlert v-if="newEntryPlaced && waits" icon="i-lucide-clock" color="info" variant="subtle" :title="words.accountWaits" class="sm:col-span-2" data-testid="spending-receipt-waits" />
      <UFormField class="sm:col-span-2">
        <USwitch v-model="keepPhoto" :label="words.keep" :description="keepReason ?? words.keepHelp" :disabled="keepReason !== null" data-testid="spending-receipt-keep" />
      </UFormField>
      <UAlert v-if="failure !== null" icon="i-lucide-triangle-alert" color="error" variant="subtle" :title="failure" data-testid="spending-receipt-failure" />
    </FormGrid>
    <template #end>
      <UButton :label="spendingWords.form.cancel" color="neutral" variant="ghost" :disabled="saves.saving.value" @click="closeAsked(false)" />
      <UButton
        v-if="photo !== null"
        type="submit"
        form="spending-receipt"
        :label="words.save"
        icon="i-lucide-save"
        :loading="saves.saving.value"
        :disabled="reading === 'reading' || saves.saving.value"
        data-testid="spending-receipt-save"
      />
    </template>
  </AppDialog>
</template>
