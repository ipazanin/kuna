<script setup lang="ts">
import { computed, ref } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'

import { words } from './words'
import { ACCOUNT_WRITES, newAccount } from '../../accounts/application/accountWrites'
import { openingOn, startDays, startsWithin } from '../../accounts/domain/bankOpening'
import { words as accountWords } from '../../accounts/presentation/words'
import type { DraftedAccount } from '../domain/statementRows'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import { ROWS_FROM, bankLinkOffered, rowsFromRefusal } from '../../workbook/domain/account'
import type { Account, RowsFrom } from '../../workbook/domain/account'
import { words as spendingWords } from '../../words'
import { parseCivilDate, today } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { formatAccountMoney } from '../../../../shared/money/moneyFormat'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import { listInWords } from '../../../../shared/text/listInWords'
import { plural } from '../../../../shared/text/translation'
import ChoiceButtons from '../../../../shared/ui/ChoiceButtons.vue'
import DayField from '../../../../shared/ui/DayField.vue'

/**
 * The accounts a file needs that Kuna does not keep, drafted from the file, each starting on the day typed beside it and with its rows
 * coming in as picked beside it, added with one tap. The file's dry run then reads again on its own.
 */
const props = defineProps<{ title: string; missing: readonly DraftedAccount[] }>()

const store = useSpendingBooks()
const writes = useRecordWrites(store)

const ROWS_FROM_OPTIONS = ROWS_FROM.map((rowsFrom) => ({ value: rowsFrom, label: accountWords.rowsFrom[rowsFrom] }))
const settings = computed(() => store.state.workbook?.settings ?? { bankSyncDeployment: '' })

/** The start day typed for each draft, by its kind and currency. One not typed starts on the earliest day its rows allow. */
const typedStarts = ref<Readonly<Record<string, string>>>({})
/** How each draft's rows come in, and the IBAN typed for one linked to a bank, by its kind and currency. One not picked comes in as its draft says while a bank link is offered. */
const pickedRowsFrom = ref<Readonly<Record<string, RowsFrom>>>({})
const typedIbans = ref<Readonly<Record<string, string>>>({})
const tried = ref(false)

function keyOf({ account }: DraftedAccount): string {
  return `${account.kind} ${account.currency}`
}

function typedStart(drafted: DraftedAccount): string {
  return typedStarts.value[keyOf(drafted)] ?? drafted.account.openedOn
}

function typeStart(drafted: DraftedAccount, typed: string): void {
  typedStarts.value = { ...typedStarts.value, [keyOf(drafted)]: typed }
}

function offersBankLink({ account }: DraftedAccount): boolean {
  return bankLinkOffered(account.kind, null, settings.value)
}

function rowsFromOf(drafted: DraftedAccount): RowsFrom {
  return offersBankLink(drafted) ? (pickedRowsFrom.value[keyOf(drafted)] ?? drafted.account.rowsFrom) : 'by-hand'
}

function pickRowsFrom(drafted: DraftedAccount, rowsFrom: RowsFrom): void {
  pickedRowsFrom.value = { ...pickedRowsFrom.value, [keyOf(drafted)]: rowsFrom }
}

function typedIban(drafted: DraftedAccount): string {
  return typedIbans.value[keyOf(drafted)] ?? drafted.account.iban
}

function typeIban(drafted: DraftedAccount, typed: string): void {
  typedIbans.value = { ...typedIbans.value, [keyOf(drafted)]: typed }
}

/** The draft's IBAN and how its rows come in, or null while it is linked to a bank with no IBAN typed. */
function sourceOf(drafted: DraftedAccount): Pick<Account, 'iban' | 'rowsFrom'> | null {
  const rowsFrom = rowsFromOf(drafted)
  const iban = rowsFrom === 'bank-link' ? typedIban(drafted) : drafted.account.iban
  return rowsFromRefusal({ kind: drafted.account.kind, iban, rowsFrom }, null, settings.value) === null ? { iban, rowsFrom } : null
}

/** The typed day, or null while it is not one the draft can start on, which runs to today. */
function startOf(drafted: DraftedAccount): CivilDate | null {
  const startsOn = parseCivilDate(typedStart(drafted))
  return startsOn !== null && startsWithin(drafted.evidence, startsOn, today()) ? startsOn : null
}

/** The draft starting on the typed day, at the file's last balance less its rows from that day on, with its rows coming in as picked, or null while the day is out of range or a bank link has no IBAN. */
function startedDraft(drafted: DraftedAccount): Omit<Account, 'id'> | null {
  const startsOn = startOf(drafted)
  const source = sourceOf(drafted)
  if (startsOn === null || source === null) return null
  const { opening, openedOn } = openingOn(drafted.evidence, startsOn)
  return { ...drafted.account, ...source, opening, openedOn }
}

/** Each draft as the typed day starts it. */
const shown = computed(() => props.missing.map((drafted) => ({ drafted, started: startedDraft(drafted), rowsFrom: rowsFromOf(drafted) })))

function startError(drafted: DraftedAccount): string | false {
  if (!tried.value || startOf(drafted) !== null) return false
  const { earliest, latest } = startDays(drafted.evidence, today())
  return accountWords.startDay.between(earliest, latest)
}

function ibanError(drafted: DraftedAccount): string | false {
  return tried.value && sourceOf(drafted) === null ? accountWords.rowsFromChoice.ibanNeeded : false
}

async function add(): Promise<void> {
  tried.value = true
  const drafts = props.missing.flatMap((drafted) => startedDraft(drafted) ?? [])
  if (drafts.length < props.missing.length) return
  const accounts = drafts.map((draft) => newAccount(draft))
  await writes.write(plural(accountWords.addedCount(accounts.length), accounts.length), (unit) => accounts.forEach((account) => unit.of(ACCOUNT_WRITES).add(account)), {
    description: listInWords(accounts.map((account) => account.name)),
    key: 'import-accounts',
    failedTitle: spendingWords.form.notAdded,
  })
}
</script>

<template>
  <UAlert icon="i-lucide-wallet" color="info" variant="subtle" :title="title" data-testid="spending-import-missing-accounts">
    <template #description>
      <ul class="flex flex-col divide-y divide-default">
        <li v-for="{ drafted, started, rowsFrom } in shown" :key="keyOf(drafted)" class="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0" data-testid="spending-import-missing-account">
          <span data-testid="spending-import-missing-account-draft">{{
            started === null ? drafted.account.name : words.import.draftLine(started.name, started.openedOn, formatAccountMoney(started.opening, started.currency))
          }}</span>
          <UFormField :label="accountWords.startDay.label" :error="startError(drafted)" data-testid="spending-import-missing-account-start-field">
            <DayField
              :model-value="typedStart(drafted)"
              :min="startDays(drafted.evidence, today()).earliest"
              :max="today()"
              class="w-full max-w-60"
              data-testid="spending-import-missing-account-start"
              @update:model-value="typeStart(drafted, $event)"
            />
          </UFormField>
          <UFormField
            v-if="offersBankLink(drafted)"
            :label="accountWords.rowsFromChoice.label"
            :help="rowsFrom === 'bank-link' ? accountWords.rowsFromChoice.bankLinkHelp(accountWords.startDay.label) : accountWords.rowsFromChoice.byHandHelp"
            data-testid="spending-import-missing-account-rows-from-field"
          >
            <ChoiceButtons
              :model-value="rowsFrom"
              :options="ROWS_FROM_OPTIONS"
              :label="accountWords.rowsFromChoice.label"
              data-testid="spending-import-missing-account-rows-from"
              @update:model-value="pickRowsFrom(drafted, $event)"
            />
          </UFormField>
          <UFormField v-if="rowsFrom === 'bank-link'" :label="accountWords.dialog.iban" :error="ibanError(drafted)">
            <UInput
              :model-value="typedIban(drafted)"
              autocomplete="off"
              spellcheck="false"
              class="w-full max-w-80"
              data-testid="spending-import-missing-account-iban"
              @update:model-value="typeIban(drafted, String($event))"
            />
          </UFormField>
        </li>
      </ul>
    </template>
    <template #actions>
      <UButton
        :label="missing.length === 1 ? words.import.addAccount : words.import.addAccounts"
        icon="i-lucide-plus"
        color="neutral"
        variant="outline"
        size="sm"
        :loading="writes.saving('import-accounts')"
        data-testid="spending-import-add-accounts"
        @click="add"
      />
    </template>
  </UAlert>
</template>
