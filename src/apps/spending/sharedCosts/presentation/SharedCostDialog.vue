<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import USelectMenu from '@nuxt/ui/components/SelectMenu.vue'
import USwitch from '@nuxt/ui/components/Switch.vue'

import { sharedCostHomes } from './sharedCostNames'
import { words } from './words'
import { eurosOfNewSharedCost } from '../domain/sharedCostEntries'
import { addSharedCost, changeSharedCost, deleteSharedCost, joinSharedCost, leaveSharedCost, newSharedCost } from '../application/sharedCostWrites'
import type { SharedCostDraft } from '../application/sharedCostWrites'
import AccountMoneyText from '../../accounts/presentation/AccountMoneyText.vue'
import { sharedCostCounts } from '../../analytics/domain/countedRow'
import { entryCategoryChoices } from '../../entries/presentation/categoryChoices'
import LabelsAndEventFields from '../../entries/presentation/LabelsAndEventFields.vue'
import { useLabelsAndEvents } from '../../entries/presentation/useLabelsAndEvents'
import CountsUnderField from '../../payees/presentation/CountsUnderField.vue'
import { words as payeeWords } from '../../payees/presentation/words'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import { BY_DAYS } from '../../workbook/domain/event'
import type { EventChoice } from '../../workbook/domain/event'
import { rowItemsOf } from '../../workbook/domain/rowItems'
import type { SharedCost } from '../../workbook/domain/sharedCost'
import type { Transaction } from '../../workbook/domain/transaction'
import { words as spendingWords } from '../../words'
import { mainCategoryOf } from '../../../../shared/categorising/domain/mainCategory'
import { civilDate, parseCivilDate } from '../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { sumAccountMoney } from '../../../../shared/money/accountMoney'
import { EURO } from '../../../../shared/money/currencyCode'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import { useRates } from '../../../../shared/rates/application/pageRates'
import { everydayRates } from '../../../../shared/rates/domain/ratesState'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import { language } from '../../../../shared/text/language'
import { plural } from '../../../../shared/text/translation'
import AppDialog from '../../../../shared/ui/AppDialog.vue'
import DayField from '../../../../shared/ui/DayField.vue'
import NoteLine from '../../../../shared/ui/NoteLine.vue'
import FormGrid from '../../../../shared/ui/FormGrid.vue'
import { useTried } from '../../../../shared/ui/useTried'

/**
 * A shared cost made from the entries picked on Entries, or one to change: its day, who it counts under, its category, labels,
 * event, note and Settled, its entries and what it counts. Who it counts under names it, so that field is always open, people
 * first. A new one lists the picked entries, each marked when it moves out of another shared cost. One to change gives each entry
 * a button that takes it out, and Delete, which sends its entries back to To review. Every field the chat can set is here.
 */
const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  /** The shared cost to change, or null to make one from `rows`. */
  sharedCost: SharedCost | null
  /** The entries a new shared cost holds. */
  rows: readonly Transaction[]
}>()

const emit = defineEmits<{ made: [] }>()

const store = useSpendingBooks()
const writes = useRecordWrites(store)
const rates = useRates()

const book = computed(() => store.state.workbook)
const categories = computed(() => book.value?.categories ?? [])
const itemsOf = computed(() => rowItemsOf({ items: book.value?.items ?? [] }))

const date = ref('')
const payee = ref('')
const category = ref('')
const note = ref('')
const settled = ref(false)
const labels = ref<readonly RecordId[]>([])
const event = ref<EventChoice>(BY_DAYS)
const { tried, markTried } = useTried(open)
const day = computed(() => parseCivilDate(date.value))
const kit = useLabelsAndEvents(() => day.value)

/** What the shared cost counts in euros, or would count once made, null while the rates do not reach one of its days. */
const euros = computed(() => {
  const held = props.sharedCost
  const current = book.value
  if (current === null) return null
  if (held === null) return eurosOfNewSharedCost(current, props.rows, everydayRates(rates.value))
  return sharedCostCounts(current, everydayRates(rates.value)).get(held.id)?.parts[0]?.euros ?? null
})

/** Its entries, each with the parts of it the shared cost holds, and for a new one every part and the other shared costs they leave. */
const members = computed(() => {
  const held = props.sharedCost
  const current = book.value
  if (current === null) return []
  const homes = sharedCostHomes(current)
  return (held === null ? props.rows : current.transactions).flatMap((row) => {
    const parts = itemsOf.value(row).filter((item) => held === null || item.sharedCost === held.id)
    const account = current.accounts.find((candidate) => candidate.id === row.account)
    if (parts.length === 0) return []
    const leaves = held === null ? [...new Set(parts.flatMap((part) => (part.sharedCost === null ? [] : [homes.get(part.sharedCost) ?? words.dialog.title])))].join(', ') : ''
    return [{ row, parts, leaves, currency: account?.currency ?? EURO, line: [dayLabel(row.date), row.payee, account?.name ?? ''].filter((part) => part !== '').join(' · ') }]
  })
})

/** Money out takes a spending category, and money that came back on the whole an income one or a spending one it lowers. */
const side = computed((): 'out' | 'in' => {
  if (props.sharedCost !== null) return (euros.value ?? 0) > 0 ? 'in' : 'out'
  return sumAccountMoney(props.rows.map((row) => row.amount)) > 0 ? 'in' : 'out'
})
const categoryItems = computed(() => entryCategoryChoices(categories.value, side.value, props.sharedCost?.category ?? null, { withFixed: false }))
const pickable = computed(() => new Set(categoryItems.value.flat().flatMap((choice) => (choice.value === undefined ? [] : [choice.value]))))
const categoryName = computed(() => categories.value.find((candidate) => candidate.id === category.value)?.name ?? '')

watch(open, (opened) => {
  if (!opened) return
  const held = props.sharedCost
  const out = props.rows.filter((row) => row.amount < 0)
  const first = [...(out.length > 0 ? out : props.rows)].sort((left, right) => (left.date < right.date ? -1 : 1))[0]
  const outItems = out.flatMap((row) => itemsOf.value(row))
  const usual = outItems.length === 0 ? null : mainCategoryOf(outItems)
  date.value = held?.day ?? first?.date ?? ''
  payee.value = held?.payee ?? ''
  category.value = held?.category ?? (usual !== null && pickable.value.has(usual) ? usual : '')
  note.value = held?.note ?? ''
  settled.value = held?.settled ?? false
  labels.value = held?.labels ?? []
  event.value = held?.event ?? BY_DAYS
  kit.start([])
})

const errors = computed(() => ({
  date: day.value === null ? spendingWords.form.aDate(civilDate(2026, 3, 15)) : null,
  category: pickable.value.has(category.value) ? null : words.dialog.pickCategory,
}))

/** Why the picked entries cannot make a shared cost: one is linked to a record in another app, or is a move between your accounts. */
const refusal = computed(() => {
  if (props.sharedCost !== null) return null
  if (props.rows.some((row) => row.pair !== null)) return words.dialog.transfer
  return props.rows.some((row) => itemsOf.value(row).some((item) => item.link !== null)) ? words.dialog.linked : null
})

async function save(): Promise<void> {
  markTried()
  const records = store.state.records
  const on = day.value
  const held = props.sharedCost
  const filed = categories.value.find((candidate) => candidate.id === category.value)
  if (records === null || on === null || filed === undefined || Object.values(errors.value).some((error) => error !== null) || refusal.value !== null) return
  const draft: SharedCostDraft = { day: on, payee: payee.value, category: filed.id, labels: labels.value, event: event.value, note: note.value, settled: settled.value }
  const rows = props.rows
  const work = (unit: UnitOfWork): void => {
    kit.addCarried(unit, new Set(labels.value))
    if (held !== null) {
      changeSharedCost(unit, records, held, draft)
      return
    }
    const made = newSharedCost(draft)
    addSharedCost(unit, records, made)
    joinSharedCost(unit, records, categories.value, rows, made, language)
  }
  if (!(await writes.write(held === null ? words.dialog.made : words.dialog.saved, work, { failedTitle: spendingWords.form.notSaved }))) return
  open.value = false
  if (held === null) emit('made')
}

async function takeOut(row: Transaction, parts: readonly { readonly id: RecordId }[]): Promise<void> {
  const records = store.state.records
  const current = book.value
  if (records === null || current === null) return
  await writes.write(words.dialog.takenOut, (unit) => leaveSharedCost(unit, records, current.sharedCosts, [row], new Set(parts.map((part) => part.id))), {
    key: `take-out-${row.id}`,
    description: row.payee,
    failedTitle: spendingWords.form.notSaved,
  })
}

async function remove(): Promise<void> {
  const records = store.state.records
  const held = props.sharedCost
  if (records === null || held === null) return
  const count = members.value.length
  if (await writes.write(plural(words.dialog.deleted(count), count), (unit) => deleteSharedCost(unit, records, held), { key: 'delete', failedTitle: spendingWords.form.notDeleted })) open.value = false
}
</script>

<template>
  <AppDialog v-model:open="open" changes :title="sharedCost === null ? words.dialog.makeTitle : words.dialog.title" :description="words.dialog.description">
    <FormGrid id="spending-shared-cost" as="form" data-testid="spending-shared-cost-dialog" @submit.prevent="save">
      <UFormField :label="words.dialog.day" :error="(tried && errors.date) || false">
        <DayField v-model="date" class="w-full" data-testid="spending-shared-cost-day" />
      </UFormField>
      <UFormField :label="words.dialog.category" :error="(tried && errors.category) || false">
        <USelectMenu v-model="category" :items="categoryItems" value-key="value" :placeholder="words.dialog.pickCategory" class="w-full" data-testid="spending-shared-cost-category" />
      </UFormField>
      <div class="sm:col-span-2">
        <CountsUnderField v-model="payee" open entry-payee="" :name="payeeWords.countsUnder.label" />
      </div>
      <UFormField :label="words.dialog.note" class="sm:col-span-2">
        <UInput v-model="note" class="w-full" data-testid="spending-shared-cost-note" />
      </UFormField>
      <LabelsAndEventFields
        v-if="kit.labelling.value"
        v-model:labels="labels"
        v-model:event="event"
        :kit="kit"
        :part="null"
        :filed-under="category"
        testid="spending-shared-cost"
        class="sm:col-span-2"
      />
      <UFormField v-if="sharedCost !== null" :help="words.dialog.settledHelp" class="sm:col-span-2">
        <USwitch v-model="settled" :label="words.dialog.settled" data-testid="spending-shared-cost-settled" />
      </UFormField>
      <div class="flex flex-col gap-2 sm:col-span-2" data-testid="spending-shared-cost-members">
        <p class="type-label">{{ words.dialog.entries }}</p>
        <p class="type-caption" data-testid="spending-shared-cost-counts">
          {{ euros === null ? words.dialog.notRated : categoryName === '' ? words.dialog.countsAmount(formatMoney(euros, 'always')) : words.dialog.counts(formatMoney(euros, 'always'), categoryName) }}
        </p>
        <ul class="flex flex-col divide-y divide-default">
          <li v-for="member in members" :key="member.row.id" class="flex items-center gap-3 py-1.5">
            <span class="flex min-w-0 flex-1 flex-col gap-0.5">
              <span class="break-words type-caption">{{ member.line }}</span>
              <NoteLine v-if="member.leaves !== ''" as="span" tone="warning" icon="i-lucide-arrow-right-left" data-testid="spending-shared-cost-moves">{{
                words.dialog.movesFrom(member.leaves)
              }}</NoteLine>
            </span>
            <AccountMoneyText :cents="sumAccountMoney(member.parts.map((part) => part.amount))" :currency="member.currency" tone="flow" class="shrink-0 type-caption" />
            <UButton
              v-if="sharedCost !== null"
              icon="i-lucide-x"
              color="neutral"
              variant="ghost"
              size="sm"
              :aria-label="words.dialog.takeOut(member.line)"
              :loading="writes.saving(`take-out-${member.row.id}`)"
              :disabled="writes.refused.value"
              data-testid="spending-shared-cost-take-out"
              @click="takeOut(member.row, member.parts)"
            />
          </li>
        </ul>
      </div>
      <UAlert v-if="refusal !== null" color="warning" variant="subtle" icon="i-lucide-triangle-alert" :title="refusal" class="sm:col-span-2" data-testid="spending-shared-cost-refused" />
    </FormGrid>
    <template #start>
      <UButton
        v-if="sharedCost !== null"
        :label="words.dialog.delete"
        icon="i-lucide-trash-2"
        color="error"
        variant="ghost"
        :loading="writes.saving('delete')"
        :disabled="writes.busy.value || writes.refused.value"
        data-testid="spending-shared-cost-delete"
        @click="remove"
      />
    </template>
    <template #end>
      <UButton :label="spendingWords.form.cancel" color="neutral" variant="ghost" @click="open = false" />
      <UButton
        type="submit"
        form="spending-shared-cost"
        :label="sharedCost === null ? words.dialog.make : words.dialog.save"
        :icon="sharedCost === null ? 'i-lucide-users' : 'i-lucide-save'"
        :loading="writes.saving('save')"
        :disabled="writes.busy.value || writes.refused.value"
        data-testid="spending-shared-cost-save"
      />
    </template>
  </AppDialog>
</template>
