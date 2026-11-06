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

import ReceiptReview from './ReceiptReview.vue'
import { canKeepPhotoNow, receiptPhotos } from './receiptPhotosPort'
import { useReceiptPhoto } from './useReceiptPhoto'
import { useReceiptSave } from './useReceiptSave'
import { words } from './words'
import { writeReceiptSplit } from '../application/receiptWrites'
import { readReceipt } from '../assist/application/readReceipt'
import { READ_RECEIPT_SUMMARY } from '../assist/presentation/receiptAssist'
import { NEW_ENTRY, heldReceiptOf, placeOf, receiptAccounts, receiptMatches } from '../domain/receiptMatch'
import type { ReceiptCandidate } from '../domain/receiptMatch'
import { NEW_CHOICE_PREFIX as NEW_PREFIX, choicesAfterR1, firstChoices, fiscalFactsOf } from '../domain/receiptDraft'
import type { R1Answer, ReceiptRead } from '../domain/receiptDraft'
import { receiptSplit, wholeReceipt } from '../domain/receiptSplit'
import type { ReceiptPart, ReceiptPlace } from '../domain/receiptSplit'
import { newCategory } from '../../categories/application/categoryWrites'
import { entryCategoryChoices } from '../../entries/presentation/categoryChoices'
import { rememberLastAccount, startingAccount } from '../../entries/presentation/lastAccount'
import { words as entryWords } from '../../entries/presentation/words'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import type { Category } from '../../workbook/domain/category'
import { words as spendingWords } from '../../words'
import AssistButton from '../../../../shared/ai/presentation/AssistButton.vue'
import { imagePartOf } from '../../../../shared/ai/presentation/imagePartOf'
import { resultLine, usageLine, useAiTask } from '../../../../shared/ai/presentation/useAiTask'
import { civilDate, parseCivilDate, today } from '../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import { ZERO, negateMoney, subtractMoney, sumMoney } from '../../../../shared/money/money'
import { amountForTyping, typedAmount } from '../../../../shared/money/typedAmount'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import AppDialog from '../../../../shared/ui/AppDialog.vue'
import ChoiceButtons from '../../../../shared/ui/ChoiceButtons.vue'
import FileDrop from '../../../../shared/ui/FileDrop.vue'
import FormGrid from '../../../../shared/ui/FormGrid.vue'
import MoneyInput from '../../../../shared/ui/MoneyInput.vue'

/** A receipt photo to the payment it splits: the QR code's date and total, or typed ones, with one category for the whole receipt or the lines the assistant read. The model only drafts: nothing is written until Save, and closing the dialog drops the photo and aborts a read under way. */
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

const assist = useAiTask(readReceipt)
const preparing = ref(false)
const photoFailure = ref<string | null>(null)
const lineChoices = ref<readonly string[]>([])
const acceptedNames = ref<Readonly<Record<string, string>>>({})

const r1Answer = ref<R1Answer | ''>('')

const assistResult = computed(() => (assist.state.value.kind === 'done' ? assist.state.value.result : null))
const readDraft = computed((): ReceiptRead | null => (assistResult.value?.kind === 'draft' ? assistResult.value.draft.read : null))
const readNotes = computed((): readonly string[] => (assistResult.value?.kind === 'draft' ? assistResult.value.problems : []))
const readModel = computed(() => (assistResult.value?.kind === 'draft' ? (assistResult.value.usage?.model ?? '') : ''))
const assistLine = computed(() => photoFailure.value ?? (assistResult.value === null ? null : resultLine(assistResult.value)))
const assistUsage = computed(() => (assistResult.value === null ? null : usageLine(assistResult.value)))
const reviewing = computed(() => (readDraft.value?.lines.length ?? 0) > 0)
const assistBusy = computed(() => preparing.value || assist.state.value.kind === 'running')

// A new photo drops the read of the last one, and `useAiTask` drops a result that comes after the reset.
watch(photo, () => {
  assist.reset()
  photoFailure.value = null
})

// The read fills a blank merchant and total and the date, and the QR code's date and total stay as they are.
watch(readDraft, (read) => {
  lineChoices.value = read === null ? [] : firstChoices(read)
  r1Answer.value = ''
  acceptedNames.value = {}
  if (read === null) return
  if (merchant.value.trim() === '') merchant.value = read.merchant
  if (qr.value !== null) return
  if (read.total !== null && typedTotal.value.trim() === '') typedTotal.value = amountForTyping(read.total)
  if (read.issuedOn !== null) typedDate.value = read.issuedOn
})

watch(picked, (file) => {
  if (file !== null) void read(file)
})

watch(open, (opened) => {
  if (opened) {
    typedDate.value = today()
    account.value = startingAccount(euroAccounts.value)?.id ?? ''
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
  return current === null || total.value === null || issuedOn.value === null ? null : receiptMatches({ merchant: merchant.value, issuedOn: issuedOn.value, total: total.value }, current)
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
    label: `${row.payee === '' ? (accountOfRow(row.account)?.name ?? '') : row.payee} · ${formatMoney(row.amount)}`,
    description: [dayLabel(row.date), accountOfRow(row.account)?.name ?? '', difference === 0 ? '' : words.differs(formatMoney(difference, 'always'))].filter((part) => part !== '').join(' · '),
  })),
  { value: NEW_ENTRY, label: words.newEntry },
])

async function readLines(): Promise<void> {
  const file = photo.value
  const current = book.value
  if (file === null || current === null) return
  photoFailure.value = null
  preparing.value = true
  try {
    const part = await imagePartOf(file)
    if (photo.value !== file) return
    await assist.run({ photo: part, book: current, qr: qr.value, merchant: merchant.value.trim() || (chosenRow.value?.payee ?? ''), companyOib: current.settings.companyOib })
  } catch {
    photoFailure.value = words.photoNotSent
  } finally {
    preparing.value = false
  }
}

/** The category of the row picked is the first offer. */
const categoryItems = computed(() => entryCategoryChoices(categories.value, 'out', chosenRow.value?.category ?? null))
const pickable = computed(() => new Set(categoryItems.value.flat().flatMap((choice) => (choice.value === undefined ? [] : [choice.value]))))
const category = computed<string>({
  get: () => (pickedCategory.value !== '' ? pickedCategory.value : (chosenRow.value?.category ?? '')),
  set: (id) => {
    pickedCategory.value = id
  },
})

const companyCategory = computed(() => categories.value.find((candidate) => candidate.kind === 'company') ?? null)
const r1Options = computed(() => [
  { value: 'company' as const, label: companyCategory.value?.name ?? '' },
  { value: 'personal' as const, label: words.r1Personal },
])

function answerR1(answer: R1Answer | ''): void {
  r1Answer.value = answer
  const read = readDraft.value
  const company = companyCategory.value
  if (answer !== '' && read !== null && company !== null) lineChoices.value = choicesAfterR1(read, answer, company.id)
}

const onDrive = computed(() => store.state.choice?.source === 'drive')
const keepReason = computed(() => (!onDrive.value ? words.keepOnlyDrive : keepAllowed.value ? null : words.keepNeedsAccess))

/** The entry that holds this fiscal receipt already, as its JIR or ZKI names it. */
const fiscalFacts = computed(() => fiscalFactsOf(readDraft.value, qr.value))
const heldRow = computed(() => {
  const held = heldReceiptOf(fiscalFacts.value, book.value?.receipts ?? [])
  return held === null ? null : (book.value?.transactions.find((row) => row.id === held.transaction) ?? null)
})

const newAccount = computed(() => euroAccounts.value.find((candidate) => candidate.id === account.value) ?? null)
const newEntryPlaced = computed(() => place.value === NEW_ENTRY)

const errors = computed(() => ({
  held: heldRow.value === null ? null : words.alreadyHeld(heldRow.value.date, formatMoney(heldRow.value.amount)),
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
  category: !reviewing.value && !pickable.value.has(category.value) ? words.pickCategory : null,
  lines: reviewing.value && lineChoices.value.some(waitsForChoice) ? words.linesWait : null,
  r1: readDraft.value?.r1Asked === true && r1Answer.value === '' ? words.r1Wait : null,
}))

function waitsForChoice(choice: string): boolean {
  if (choice === '') return true
  return choice.startsWith(NEW_PREFIX) && (acceptedNames.value[choice.slice(NEW_PREFIX.length)] ?? '').trim() === ''
}

/** What the confirmed lines leave of the row, which one Difference line then shows. */
const linesDifference = computed(() => {
  const read = readDraft.value
  if (read === null || total.value === null) return ZERO
  return subtractMoney(chosenRow.value?.amount ?? negateMoney(total.value), sumMoney(read.lines.map((line) => line.amount)))
})

/** Each new category you accepted that a line still names, by the name suggested. */
function acceptedCategories(): ReadonlyMap<string, Category> {
  const order = Math.max(0, ...categories.value.filter((candidate) => candidate.parent === null).map((candidate) => candidate.order))
  const named = [...new Set(lineChoices.value.filter((choice) => choice.startsWith(NEW_PREFIX)).map((choice) => choice.slice(NEW_PREFIX.length)))]
  return new Map(named.map((name, place) => [name, newCategory({ name: acceptedNames.value[name] ?? name, kind: 'spending', parent: null, order: order + place + 1, colour: '', hidden: false })]))
}

async function save(): Promise<void> {
  tried.value = true
  failure.value = null
  const file = photo.value
  const day = issuedOn.value
  const sum = total.value
  const row = chosenRow.value
  const chosenAccount = newAccount.value
  const filed = categories.value.find((candidate) => candidate.id === category.value)
  const read = readDraft.value
  const where: ReceiptPlace | null = row !== null ? { row } : chosenAccount === null ? null : { account: chosenAccount.id }
  if (Object.values(errors.value).some((error) => error !== null) || file === null || day === null || sum === null || where === null || (read === null && filed === undefined)) return
  const made = acceptedCategories()
  const parts: readonly ReceiptPart[] = reviewing.value
    ? (read?.lines ?? []).map((line, place) => {
        const choice = lineChoices.value[place] ?? ''
        return { printed: line.printed, text: line.text, amount: line.amount, category: made.get(choice.slice(NEW_PREFIX.length))?.id ?? (choice as ReceiptPart['category']) }
      })
    : wholeReceipt(sum, (filed as Category).id)
  const draft = {
    merchant: merchant.value,
    merchantOib: read?.merchantOib ?? '',
    buyerOib: read?.buyerOib ?? '',
    issuedOn: day,
    total: sum,
    readBy: read === null ? '' : readModel.value,
    ...fiscalFacts.value,
    latitude: photoPlace.value?.latitude ?? '',
    longitude: photoPlace.value?.longitude ?? '',
  }
  const outcome = await saves.save(keepPhoto.value && keepReason.value === null ? { file, issuedOn: day } : null, (photoId) =>
    writes.write(words.saved, (unit) => writeReceiptSplit(unit, receiptSplit({ ...draft, photo: photoId }, where, parts), [...made.values()]), { failedTitle: words.notSaved }),
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
      <div v-if="reading !== 'reading' && reading !== 'unreadable' && readDraft === null" class="flex flex-col items-start gap-2" data-testid="spending-receipt-assist">
        <AssistButton :app="readReceipt.app" :task="READ_RECEIPT_SUMMARY" :label="words.read" :loading="assistBusy" @run="readLines" />
        <p v-if="assistBusy" class="text-sm text-muted" data-testid="spending-receipt-assist-running">{{ words.readRunning }}</p>
      </div>
      <p v-if="assistLine !== null" class="text-sm text-error" data-testid="spending-receipt-assist-line">{{ assistLine }}</p>
      <p v-if="assistUsage !== null" class="type-caption" data-testid="spending-receipt-usage">{{ assistUsage }}</p>
      <UAlert v-if="errors.held !== null" icon="i-lucide-copy-x" color="error" variant="subtle" :title="errors.held" data-testid="spending-receipt-held" />
      <div v-if="readDraft?.r1Asked" class="flex flex-col gap-2" data-testid="spending-receipt-r1-ask">
        <p class="text-sm text-highlighted">{{ words.r1Ask }}</p>
        <ChoiceButtons :model-value="r1Answer" :options="r1Options" :label="words.r1Ask" data-testid="spending-receipt-r1-choice" @update:model-value="answerR1" />
        <p v-if="tried && errors.r1 !== null" class="text-sm text-error" data-testid="spending-receipt-r1-error">{{ errors.r1 }}</p>
      </div>
      <UAlert v-if="readDraft?.r1" icon="i-lucide-building-2" color="warning" variant="subtle" :title="words.r1" data-testid="spending-receipt-r1" />
      <ul v-if="readNotes.length > 0" class="flex flex-col gap-1 text-sm text-warning" data-testid="spending-receipt-notes">
        <li v-for="note in readNotes" :key="note">{{ note }}</li>
      </ul>
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
      <UFormField v-if="!reviewing" :label="words.category" :error="(tried && errors.category) || false">
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
      <ReceiptReview
        v-if="reviewing && readDraft !== null"
        v-model:choices="lineChoices"
        v-model:accepted="acceptedNames"
        :lines="readDraft.lines"
        :categories="categories"
        :difference="linesDifference"
      />
      <p v-if="tried && errors.lines !== null" class="text-sm text-error" data-testid="spending-receipt-lines-error">{{ errors.lines }}</p>
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
        :disabled="reading === 'reading' || assistBusy || saves.saving.value"
        data-testid="spending-receipt-save"
      />
    </template>
  </AppDialog>
</template>
