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
import { openingLineChoices, receiptSplit, repickedLineChoices, rowPlace, typedReceiptLines } from '../domain/receiptSplit'
import type { ReceiptPlace } from '../domain/receiptSplit'
import type { PartChoices } from '../../entries/domain/entrySplit'
import { entryCategoryChoices } from '../../entries/presentation/categoryChoices'
import LabelsAndEventFields from '../../entries/presentation/LabelsAndEventFields.vue'
import { useLabelsAndEvents } from '../../entries/presentation/useLabelsAndEvents'
import { usePartFiling } from '../../entries/presentation/usePartFiling'
import { words as sharedCostWords } from '../../sharedCosts/presentation/words'
import type { PartKey } from '../../entries/presentation/useLabelsAndEvents'
import { lastUsedAccount, rememberLastAccount } from '../../entries/infrastructure/lastAccount'
import { words as entryWords } from '../../entries/presentation/words'
import AccountMoneyText from '../../accounts/presentation/AccountMoneyText.vue'
import CountsUnderField from '../../payees/presentation/CountsUnderField.vue'
import { partPayeeOf } from '../../payees/domain/payeeKey'
import { payeeOfAll } from '../../workbook/domain/carriedChoices'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import { isSplit, rowItemsOf } from '../../workbook/domain/rowItems'
import { mainCategoryOf } from '../../../../shared/categorising/domain/mainCategory'
import { beforeStartDay, takesRowsByHand } from '../../workbook/domain/account'
import { words as spendingWords } from '../../words'
import { civilDate, parseCivilDate, today } from '../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { formatAccountMoney, formatMoney } from '../../../../shared/money/moneyFormat'
import { typedAmount } from '../../../../shared/money/typedAmount'
import { accountMoneyOfEuros, typedAccountAmount } from '../../../../shared/money/accountMoney'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import AppDialog from '../../../../shared/ui/AppDialog.vue'
import DayField from '../../../../shared/ui/DayField.vue'
import FileDrop from '../../../../shared/ui/FileDrop.vue'
import FormGrid from '../../../../shared/ui/FormGrid.vue'
import MoneyInput from '../../../../shared/ui/MoneyInput.vue'
import SplitEditor from '../../../../shared/ui/SplitEditor.vue'
import { givenParts, splitField } from '../../../../shared/ui/splitFields'
import type { SplitField } from '../../../../shared/ui/splitFields'
import { EURO } from '../../../../shared/money/currencyCode'
import { useTried } from '../../../../shared/ui/useTried'

/** A receipt photo to the payment it splits: the QR code's date and total, or typed ones, with one category for the whole receipt or lines typed by hand, each with its category. Closing the dialog drops the photo. Reading its lines is asked of the chat from Entries. */
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
/** The lines typed by hand, one of them the rest of the total, or null while one category takes the whole receipt. */
const lines = ref<SplitField[] | null>(null)
/** The key of the labels and event of a receipt under one category, which lines key by their own id. */
const WHOLE = 'whole'
const account = ref('')
const keepPhoto = ref(false)
const { tried, markTried } = useTried(open)
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
  lines.value = null
  partPayees.value = {}
  start([])
  keepPhoto.value = false
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
  if (current === null || total.value === null || issuedOn.value === null) return null
  const place = photoPlace.value ?? { latitude: '', longitude: '' }
  return receiptMatches({ merchant: merchant.value, merchantOib: '', issuedOn: issuedOn.value, total: total.value, ...place }, current, null)
})

const candidates = computed((): readonly ReceiptCandidate[] => (matches.value === null || matches.value.kind === 'none' ? [] : matches.value.candidates))

const place = computed(() => placeOf(matches.value, pickedPlace.value))
const chosenRow = computed(() => candidates.value.find((candidate) => candidate.row.id === place.value)?.row ?? null)

/** A part's event joins by the day of the payment picked, or of the receipt on a new entry. */
const kit = useLabelsAndEvents(() => chosenRow.value?.date ?? issuedOn.value)
const { labelling, partLabels, partEvents, labelPart, start, addParts, addCarried } = kit

const opening = computed(() => openingLineChoices(chosenRow.value === null ? [] : rowItemsOf({ items: book.value?.items ?? [] })(chosenRow.value)))
const choicesOfPart = (part: PartKey): PartChoices => ({ labels: partLabels.value[part] ?? opening.value.labels, event: partEvents.value[part] ?? opening.value.event })
const partKeys = computed<readonly PartKey[]>(() => lines.value?.map((field) => field.id) ?? [WHOLE])

watch([open, partKeys], ([, keys]) => addParts(keys.map((part) => ({ part, ...opening.value }))), { immediate: true })
watch(opening, (after, before) => {
  for (const part of partKeys.value) {
    const moved = repickedLineChoices(choicesOfPart(part), before, after)
    labelPart(part, moved.labels)
    partEvents.value[part] = moved.event
  }
})
/** Who each part counts under once you picked it, by the part's key. A part not picked counts under who the payment's parts all counted under. */
const partPayees = ref<Record<PartKey, string>>({})
const entryPayee = computed(() => chosenRow.value?.payee || merchant.value.trim())
const openingPayee = computed(() => partPayeeOf(payeeOfAll(chosenRow.value === null ? [] : rowItemsOf({ items: book.value?.items ?? [] })(chosenRow.value)), entryPayee.value))
const payeeOfPart = (part: PartKey): string => partPayees.value[part] ?? openingPayee.value
const payeeChosen = (part: PartKey): { readonly payee?: string } => (part in partPayees.value ? { payee: partPayees.value[part]! } : {})

/** What a part saves with: the labels and event it shows, or nothing on a file from before parts, which keeps none. */
const choicesOf = (part: PartKey): { readonly choices?: PartChoices } => (labelling.value ? { choices: choicesOfPart(part) } : {})

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
      isSplit(rowPlace(row, book.value?.items ?? []).held) ? words.replacesSplit : '',
    ]
      .filter((part) => part !== '')
      .join(' · '),
  })),
  { value: NEW_ENTRY, label: waits.value ? words.waitForBank : words.newEntry },
])

const chosenItems = computed(() => (chosenRow.value === null ? [] : rowItemsOf({ items: book.value?.items ?? [] })(chosenRow.value)))
/** The shared costs a line can join, none for a receipt that waits for the bank's row, since only a row's part joins one. */
const partFiling = usePartFiling(() => chosenItems.value.map((item) => item.sharedCost))
const sharedCosts = computed(() => (newEntryPlaced.value && waits.value ? [] : partFiling.offers.value))
/** The category of the row picked is the first offer, or the shared cost a row of one part is in. */
const chosenCategory = computed(() => {
  const items = chosenItems.value
  if (items.length === 1 && items[0]!.sharedCost !== null) return items[0]!.sharedCost
  return items.length === 0 ? null : mainCategoryOf(items)
})
const categoryItems = computed(() => entryCategoryChoices(categories.value, 'out', chosenCategory.value, { sharedCosts: sharedCosts.value }))
const pickable = computed(() => new Set(categoryItems.value.flat().flatMap((choice) => (choice.value === undefined ? [] : [choice.value]))))
const category = computed<string>({
  get: () => (pickedCategory.value !== '' ? pickedCategory.value : (chosenCategory.value ?? '')),
  set: (id) => {
    pickedCategory.value = id
  },
})

/** Starts the lines with the category picked so far on the first, the second taking the rest of the total, and both with the whole receipt's labels and event. */
function typeLines(): void {
  const typed = [splitField('', category.value, '', false), splitField('', '', '', true)]
  addParts(typed.map((field) => ({ part: field.id, ...choicesOfPart(WHOLE) })))
  lines.value = typed
}

const lineItems = computed(() => entryCategoryChoices(categories.value, 'out', null, { sharedCosts: sharedCosts.value }))
const linePickable = computed(() => new Set(lineItems.value.flat().flatMap((choice) => (choice.value === undefined ? [] : [choice.value]))))
const lineCategoryError = (field: SplitField): string | null => (linePickable.value.has(field.category) ? null : words.pickCategory)
const totalInAccount = computed(() => (total.value === null ? null : accountMoneyOfEuros(total.value)))

/** The receipt's lines as Save writes them: the whole total under one category, or the typed lines. Null while an amount or a category is missing. */
const typedLines = computed(() => {
  const sum = total.value
  const fields = lines.value
  const given = fields === null ? ['rest' as const] : givenParts(fields, typedAccountAmount)
  const picked = (fields === null ? [category.value] : fields.map((field) => field.category)).map((value) => partFiling.fieldsOf(value))
  if (sum === null || given === null || picked.some((found) => found === null)) return null
  return typedReceiptLines(
    partFiling.filing.value.categories,
    sum,
    given.map((amount, place) => ({
      amount,
      ...picked[place]!,
      note: fields?.[place]?.note ?? '',
      ...choicesOf(fields?.[place]?.id ?? WHOLE),
      ...payeeChosen(fields?.[place]?.id ?? WHOLE),
    })),
  )
})
const linesRefusal = computed(() => (typedLines.value !== null && 'refused' in typedLines.value ? entryWords.split.refusals[typedLines.value.refused] : null))

const onDrive = computed(() => store.state.choice?.source === 'drive')
const keepReason = computed(() => (!onDrive.value ? words.keepOnlyDrive : keepAllowed.value ? null : words.keepNeedsAccess))

/** This fiscal receipt as the file holds it already, as its QR code's JIR or ZKI names it. */
const heldReceipt = computed(() => (qr.value === null ? null : heldReceiptOf(qr.value, book.value?.receipts ?? [])))
const heldRow = computed(() => book.value?.transactions.find((row) => row.id === heldReceipt.value?.transaction) ?? null)

const newAccount = computed(() => euroAccounts.value.find((candidate) => candidate.id === account.value) ?? null)
const newEntryPlaced = computed(() => place.value === NEW_ENTRY)
/** On a day the bank or its statement file fills, a receipt with no payment yet waits for that row instead of making one. */
const waits = computed(() => newAccount.value !== null && !takesRowsByHand(newAccount.value, issuedOn.value ?? today()))

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
  category:
    lines.value === null
      ? !pickable.value.has(category.value)
        ? words.pickCategory
        : null
      : lines.value.some((field) => lineCategoryError(field) !== null)
        ? words.pickCategory
        : chosenItems.value.some((item) => item.link !== null) && lines.value.some((field) => partFiling.joins(field.category))
          ? sharedCostWords.unlinkFirst
          : null,
}))

async function save(): Promise<void> {
  markTried()
  failure.value = null
  const file = photo.value
  const day = issuedOn.value
  const sum = total.value
  const row = chosenRow.value
  const chosenAccount = newAccount.value
  const typed = typedLines.value
  const where: ReceiptPlace | null = row !== null ? rowPlace(row, book.value?.items ?? []) : chosenAccount === null ? null : { account: chosenAccount }
  const records = store.state.records
  if (Object.values(errors.value).some((error) => error !== null) || file === null || day === null || sum === null || where === null || typed === null || 'refused' in typed || records === null) return
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
  const carried = new Set(typed.parts.flatMap((part) => part.choices?.labels ?? []))
  const filing = partFiling.filing.value
  const outcome = await saves.save(keepPhoto.value && keepReason.value === null ? { file, issuedOn: day } : null, (photoId) =>
    writes.write(
      words.saved,
      (unit) => {
        addCarried(unit, carried)
        const split = receiptSplit({ ...draft, photo: photoId }, where, typed.parts)
        filing.addFor(unit, split.lines)
        writeReceiptSplit(unit, records, split)
      },
      { failedTitle: words.notSaved },
    ),
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
  <AppDialog changes v-bind="lines === null ? {} : { width: 'xl' as const }" :open="open" :title="words.add" :description="words.description" @update:open="closeAsked">
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
        <div class="flex min-w-0 flex-col gap-1 type-body" data-testid="spending-receipt-reading" :data-reading="reading">
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
      <UFormField :label="words.merchant" :help="words.merchantHelp" :class="{ 'sm:col-span-2': lines !== null }">
        <UInput v-model="merchant" class="w-full" data-testid="spending-receipt-merchant" />
      </UFormField>
      <UFormField v-if="lines === null" :label="words.category" :error="(tried && errors.category) || false" :ui="{ container: 'flex flex-col' }">
        <USelectMenu v-model="category" :items="categoryItems" value-key="value" :placeholder="words.pickCategory" class="w-full" data-testid="spending-receipt-category" />
        <CountsUnderField :model-value="payeeOfPart(WHOLE)" :entry-payee="entryPayee" :name="entryWords.dialog.countsUnder" class="order-last mt-1" @update:model-value="partPayees[WHOLE] = $event" />
      </UFormField>
      <LabelsAndEventFields
        v-if="lines === null && labelling"
        v-bind="choicesOfPart(WHOLE)"
        :kit="kit"
        :part="WHOLE"
        :filed-under="category"
        testid="spending-receipt"
        @update:labels="labelPart(WHOLE, $event)"
        @update:event="partEvents[WHOLE] = $event"
      />
      <div v-if="lines === null" class="sm:col-span-2">
        <UButton :label="words.typeLines" icon="i-lucide-list-plus" color="neutral" variant="outline" data-testid="spending-receipt-type-lines" @click="typeLines" />
      </div>
      <div v-else class="flex flex-col items-start gap-3 sm:col-span-2" data-testid="spending-receipt-typed-lines">
        <SplitEditor
          v-if="totalInAccount !== null"
          v-model="lines"
          :whole-label="words.total"
          :whole="totalInAccount"
          :typed="typedAccountAmount"
          :tried="tried"
          :category-error="lineCategoryError"
          :refusal="linesRefusal"
          class="w-full"
        >
          <template #whole>
            <AccountMoneyText :cents="totalInAccount" :currency="EURO" />
          </template>
          <template #category="{ field }">
            <USelectMenu v-model="field.category" :items="lineItems" value-key="value" :placeholder="words.pickCategory" class="w-full" data-testid="spending-receipt-line-category" />
          </template>
          <template #rest="{ cents }">
            <AccountMoneyText :cents="cents" :currency="EURO" />
          </template>
          <template #beside="{ field, place: partPlace }">
            <CountsUnderField :model-value="payeeOfPart(field.id)" :entry-payee="entryPayee" :name="entryWords.split.partCountsUnder(partPlace)" @update:model-value="partPayees[field.id] = $event" />
          </template>
          <template v-if="labelling" #part="{ field, place: partPlace }">
            <LabelsAndEventFields
              v-bind="choicesOfPart(field.id)"
              :kit="kit"
              :part="field.id"
              :filed-under="field.category"
              :labels-name="entryWords.split.partLabels(partPlace)"
              :event-name="entryWords.split.partEvent(partPlace)"
              testid="spending-receipt-line"
              @update:labels="labelPart(field.id, $event)"
              @update:event="partEvents[field.id] = $event"
            />
          </template>
        </SplitEditor>
        <p v-else class="type-caption" data-testid="spending-receipt-total-first">{{ words.linesNeedTotal }}</p>
        <UButton :label="words.oneCategory" icon="i-lucide-tag" color="neutral" variant="ghost" data-testid="spending-receipt-one-category" @click="lines = null" />
      </div>
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
      <p v-if="tried && errors.place !== null" class="type-body text-error" data-testid="spending-receipt-place-error">{{ errors.place }}</p>
      <p v-if="matches?.kind === 'none'" class="type-aside" data-testid="spending-receipt-no-match">{{ waits ? words.noMatchWaits : words.noMatch }}</p>
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
        :disabled="reading === 'reading' || saves.saving.value || writes.refused.value"
        data-testid="spending-receipt-save"
      />
    </template>
  </AppDialog>
</template>
