<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'

import { INVESTMENT_ACCOUNT_WRITES } from '../../holdings/application/holdingWrites'
import { accountHandover, writeInvestmentAccount } from '../../holdings/application/accountSourceWrites'
import { sourcesRefusalText } from '../../holdings/application/intakeRefusals'
import { accountSources, landingRecords, proposedMailStart, sourcesRefusal } from '../../imports/domain/accountIntake'
import { ibkrMailReader } from '../../mail/domain/ibkrFlexRecipe'
import { useInvestmentsBooks } from '../../workbook/application/investmentsStore'
import { BY_HAND_SOURCES, INVESTMENT_SOURCES } from '../../workbook/domain/investmentAccount'
import type { InvestmentAccount, InvestmentSource } from '../../workbook/domain/investmentAccount'
import { INVESTMENT_ACCOUNT_RECORDS } from '../../workbook/domain/investmentKinds'
import { firstUnfiledDay } from '../../tax/domain/taxDeadlines'
import { handoverWords } from './sourceHandoverWords'
import { words } from './words'
import { draftsOfPeriods, periodsOfDrafts } from '../../../../shared/app/periodDrafts'
import type { PeriodDraft } from '../../../../shared/app/periodDrafts'
import { today } from '../../../../shared/calendar/civilDate'
import { newRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import AppDialog from '../../../../shared/ui/AppDialog.vue'
import ChoiceButtons from '../../../../shared/ui/ChoiceButtons.vue'
import DayField from '../../../../shared/ui/DayField.vue'
import FormGrid from '../../../../shared/ui/FormGrid.vue'
import NoteLine from '../../../../shared/ui/NoteLine.vue'
import SourceHandoverAlert from '../../../../shared/ui/SourceHandoverAlert.vue'

/** An account at a broker, added or changed, with where its rows come from on which days. Saving says which account it wrote. */
const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  /** The account to change, or null to add one. */
  account: InvestmentAccount | null
}>()

const emit = defineEmits<{
  saved: [account: InvestmentAccount]
}>()

const store = useInvestmentsBooks()
const writes = useRecordWrites(store)
const text = words.accountDialog
const SOURCE_OPTIONS = INVESTMENT_SOURCES.map((source) => ({ value: source, label: text.rowsFromOptions[source] }))

const book = computed(() => store.state.workbook?.book ?? null)
/** Where the account's rows come from now, as the file says or, for one that does not say, as Kuna reads it. Null for a new one. */
const sourcesBefore = computed(() => (props.account === null || book.value === null ? null : (accountSources(book.value).get(props.account.id) ?? null)))
/** The id the account is checked and written under: its own, or one made for a new account when the dialog opens. */
const accountId = ref(recordIdOf(INVESTMENT_ACCOUNT_RECORDS, newRecordId()))

const name = ref('')
const note = ref('')
const periods = ref<readonly PeriodDraft<InvestmentSource>[]>(draftsOfPeriods(BY_HAND_SOURCES))
const tried = ref(false)

watch(open, (opened) => {
  if (!opened) return
  name.value = props.account?.name ?? ''
  note.value = props.account?.note ?? ''
  accountId.value = props.account?.id ?? recordIdOf(INVESTMENT_ACCOUNT_RECORDS, newRecordId())
  periods.value = draftsOfPeriods(sourcesBefore.value ?? BY_HAND_SOURCES)
  tried.value = false
})

const nameError = computed(() => (name.value.trim() === '' ? text.nameError : null))
const typed = computed(() => periodsOfDrafts(periods.value, ['mail']))
/** Why each period cannot be kept, said under it once Save is pressed. */
const periodErrors = computed(() => typed.value.problems.map((problem) => (tried.value && problem !== null ? text.period[problem] : null)))
/** The record as typed, or null while its periods cannot be kept. */
const record = computed((): InvestmentAccount | null => (typed.value.periods === null ? null : { id: accountId.value, name: name.value.trim(), note: note.value.trim(), sources: typed.value.periods }))
/** Why the write would refuse the periods, said under them. Rows the change gives another source go with the write, so only a filed tax year refuses. */
const sourcesError = computed(() => {
  const after = record.value
  const current = book.value
  if (after === null || after.sources === null || current === null) return null
  const going = new Set(accountHandover(current, props.account, after)?.records ?? [])
  const kept = landingRecords(current).filter((landing) => !going.has(landing.id))
  const refusal = sourcesRefusal(accountId.value, sourcesBefore.value ?? BY_HAND_SOURCES, after.sources, { kept, back: [] }, firstUnfiledDay(today()))
  return refusal === null ? null : sourcesRefusalText(refusal, false)
})
const readerOff = computed(() => periods.value.some((period) => period.source === 'mail') && ibkrMailReader(book.value)?.on !== true)

/** What saving takes out of the book, in words, or null when it takes nothing out or the save is refused. */
const handover = computed(() => {
  const after = record.value
  const current = book.value
  if (after === null || current === null || sourcesError.value !== null) return null
  const taken = accountHandover(current, props.account, after)
  return taken === null ? null : handoverWords(taken, after.id, current)
})

function changePeriod(place: number, change: Partial<PeriodDraft<InvestmentSource>>): void {
  const first = place === 0 && change.source === 'mail' && periods.value[0]?.from === ''
  // A first period of the mail starts on the day after the account's last row by hand, as the mail search starts there.
  const from = first ? proposedMailStart(accountId.value, book.value === null ? [] : landingRecords(book.value), today()) : undefined
  periods.value = periods.value.map((period, at) => (at === place ? { ...period, ...change, ...(from === undefined ? {} : { from }) } : period))
}

function addPeriod(): void {
  const last = periods.value[periods.value.length - 1]
  const source = INVESTMENT_SOURCES.find((option) => option !== last?.source) ?? 'by-hand'
  periods.value = [...periods.value, { source, from: '' }]
}

function removePeriod(place: number): void {
  periods.value = periods.value.filter((_period, at) => at !== place)
}

async function save(): Promise<void> {
  tried.value = true
  const after = record.value
  if (nameError.value !== null || sourcesError.value !== null || after === null) return
  const before = props.account
  const current = book.value
  if (current === null) return
  const written = await writes.write(before === null ? text.added : text.saved, (unit) => writeInvestmentAccount(unit, current, before, after), {
    failedTitle: before === null ? text.notAdded : text.notSaved,
  })
  if (!written) return
  emit('saved', after)
  open.value = false
}

async function remove(): Promise<void> {
  const before = props.account
  if (before === null) return
  if (await writes.write(text.deleted, (unit) => unit.of(INVESTMENT_ACCOUNT_WRITES).remove(before), { key: 'delete', failedTitle: text.notDeleted })) open.value = false
}
</script>

<template>
  <AppDialog v-model:open="open" changes :title="account === null ? text.addTitle : text.changeTitle" :description="text.description">
    <FormGrid id="investment-account" as="form" data-testid="account-form" @submit.prevent="save">
      <UFormField :label="text.name" :help="text.nameHelp" :error="(tried && nameError) || false" class="sm:col-span-2">
        <UInput v-model="name" class="w-full" data-testid="account-name" />
      </UFormField>
      <UFormField :label="text.note" class="sm:col-span-2">
        <UInput v-model="note" class="w-full" data-testid="account-note" />
      </UFormField>
      <UFormField :label="text.rowsFrom" :help="periods.length > 1 || periods[0]?.source !== 'by-hand' ? text.periodsHelp : text.byHandHelp" class="sm:col-span-2">
        <div class="flex flex-col gap-3" data-testid="account-sources">
          <div v-for="(period, place) in periods" :key="place" class="flex flex-col gap-2" role="group" :aria-label="text.sourceOf(place + 1)">
            <p v-if="place > 0" class="type-label" aria-hidden="true">{{ text.sourceOf(place + 1) }}</p>
            <ChoiceButtons
              :model-value="period.source"
              :options="SOURCE_OPTIONS"
              :label="text.sourceOf(place + 1)"
              :data-testid="place === 0 ? 'account-rows-from' : 'account-source'"
              @update:model-value="changePeriod(place, { source: $event })"
            />
            <UFormField :label="place === 0 ? text.firstFrom : text.startsOn" :error="periodErrors[place] ?? (place === periods.length - 1 && tried && sourcesError) ?? false">
              <div class="flex items-center gap-2">
                <DayField
                  :model-value="period.from"
                  class="min-w-0 flex-1"
                  :data-testid="place === 0 ? 'account-starts-on' : 'account-source-from'"
                  @update:model-value="changePeriod(place, { from: $event })"
                />
                <UButton
                  v-if="place > 0"
                  icon="i-lucide-x"
                  color="neutral"
                  variant="ghost"
                  class="min-h-11 min-w-11 shrink-0 justify-center"
                  :aria-label="text.removeSource"
                  data-testid="account-source-remove"
                  @click="removePeriod(place)"
                />
              </div>
            </UFormField>
          </div>
          <UButton :label="text.addSource" icon="i-lucide-plus" color="neutral" variant="outline" size="sm" class="self-start" data-testid="account-source-add" @click="addPeriod" />
          <NoteLine v-if="readerOff" tone="warning" data-testid="account-reader-off">{{ text.readerOff }}</NoteLine>
          <SourceHandoverAlert v-if="handover !== null" :handover="handover" data-testid="account-handover" />
        </div>
      </UFormField>
    </FormGrid>
    <template #start>
      <UButton
        v-if="account !== null"
        :label="text.delete"
        icon="i-lucide-trash-2"
        color="error"
        variant="ghost"
        :loading="writes.saving('delete')"
        :disabled="writes.busy.value || writes.refused.value"
        data-testid="account-delete"
        @click="remove"
      />
    </template>
    <template #end>
      <UButton :label="text.cancel" color="neutral" variant="ghost" @click="open = false" />
      <UButton
        type="submit"
        form="investment-account"
        :label="account === null ? text.add : text.save"
        :icon="account === null ? 'i-lucide-plus' : 'i-lucide-save'"
        :loading="writes.saving('save')"
        :disabled="writes.busy.value || writes.refused.value"
        data-testid="account-save"
      />
    </template>
  </AppDialog>
</template>
