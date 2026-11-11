<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'

import { addBankAccounts, bringBackBankDetails, fixOpening, keepMine, keepOutOfKuna, takeBankDetails } from '../application/bankSetupWrites'
import type { BankSetup } from '../application/bankSync'
import { canStartOn, setupActions, setupLineCurrency, setupLineKey, setupLines, startDays, startedAccount } from '../domain/bankAccountSetup'
import type { AccountProposal, BankAccountStart, SetupLine, StartedAccount } from '../domain/bankAccountSetup'
import type { LinkedAccount } from '../domain/bankAnswer'
import { currentDifferences } from '../domain/bankBalance'
import type { BalanceDifference } from '../domain/bankBalance'
import { differenceLine, olderRowsLine, pendingCaption, pendingLine } from './bankStepResult'
import { useBankSync } from './useBankSync'
import { words } from './words'
import { words as accountWords } from '../../accounts/presentation/words'
import { words as spendingWords } from '../../words'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import type { Account } from '../../workbook/domain/account'
import type { LinkableBank } from '../../workbook/domain/spendingSettings'
import { parseCivilDate, today } from '../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { formatAccountMoney } from '../../../../shared/money/moneyFormat'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import { plural } from '../../../../shared/text/translation'
import AppCard from '../../../../shared/ui/AppCard.vue'
import DayField from '../../../../shared/ui/DayField.vue'

/** The Bank sync tab's list of every account the linked banks give, each kept, offered to add, offered to update, or left out of Kuna, and the fixes the last fetch's balances suggest. */
const props = defineProps<{ outcome: BankSetup }>()

const store = useSpendingBooks()
const writes = useRecordWrites(store)
const sync = useBankSync()

const book = computed(() => store.state.workbook)
const lines = computed<readonly SetupLine[]>(() => (book.value === null ? [] : setupLines(props.outcome.linked, props.outcome.proposals, book.value)))
/** The lines that ask for something: an account to add, one to update, and one that fits once it takes the bank's details. */
const shown = computed(() => lines.value.filter((line) => line.kind !== 'not-in-kuna' && !(line.kind === 'kept' && line.update === null)))
const kept = computed(() => lines.value.flatMap((line) => (line.kind === 'kept' && line.update === null ? [line] : [])))
const leftOut = computed(() => lines.value.flatMap((line) => (line.kind === 'not-in-kuna' ? [line] : [])))
const differences = computed(() => currentDifferences(props.outcome.differences, book.value?.accounts ?? []))
const explained = computed(() => differences.value.filter((difference) => difference.explained))
const unexplained = computed(() => differences.value.filter((difference) => !difference.explained))
/** Each account to add, by its line's key. */
const addable = computed(() => lines.value.flatMap((line) => (line.kind === 'missing' && line.proposal !== null ? [{ key: setupLineKey(line), proposal: line.proposal }] : [])))

/** The start day typed for each account to add, by its line's key. One not typed starts on the day of the fetch. */
const typedStarts = ref<Readonly<Record<string, string>>>({})
/** The lines whose Add was tapped with a day out of range, which show the range. */
const tried = ref<ReadonlySet<string>>(new Set())

function typedStart(proposal: AccountProposal, key: string): string {
  return typedStarts.value[key] ?? proposal.fetchedOn
}

function typeStart(key: string, typed: string): void {
  typedStarts.value = { ...typedStarts.value, [key]: typed }
}

/** The start the typed day gives, or null while it is not a day the account can start on. */
function startOf(proposal: AccountProposal, key: string): BankAccountStart | null {
  const startsOn = parseCivilDate(typedStart(proposal, key))
  return startsOn !== null && canStartOn(proposal, startsOn) ? { proposal, startsOn } : null
}

/** Each account as its typed day starts it, by its line's key, left out while the typed day is out of range so no figure shows for a day nobody picked. */
const started = computed(
  () =>
    new Map(
      addable.value.flatMap(({ key, proposal }) => {
        const start = startOf(proposal, key)
        return start === null ? [] : [[key, startedAccount(start)] as const]
      }),
    ),
)

function startError(proposal: AccountProposal, key: string): string | false {
  if (!tried.value.has(key) || startOf(proposal, key) !== null) return false
  const { earliest, latest } = startDays(proposal)
  return accountWords.startDay.between(earliest, latest)
}

function title(bank: LinkableBank, currency: string): string {
  return words.setup.account(words.banks[bank], currency)
}

function about(linked: LinkedAccount): string {
  return [linked.iban, linked.product, linked.details].filter((part): part is string => part !== null && part.trim() !== '').join(' · ')
}

function draftLine({ account }: StartedAccount): string {
  const kind = accountWords.kinds[account.kind]
  const named = account.name.toLowerCase().includes(kind.toLowerCase())
  return words.setup.draft(account.name, named ? null : kind, formatAccountMoney(account.opening, account.currency), dayLabel(account.openedOn))
}

/** How the opening was worked out. Null while the bank holds pending rows, since only the warning about them is worth saying then. */
function openingLine({ opening }: StartedAccount): string | null {
  if (opening.source === 'start') return words.setup.openingStart
  if (opening.source === 'guess') return words.setup.openingGuess
  if (opening.source === 'pending') return null
  if (opening.rows === 0) return words.setup.openingBalance
  return plural(words.setup.openingWorked(opening.rows), opening.rows)
}

/** How the opening was worked out, and that the rows from the day wait on this page while there are any. */
function heldLine(account: StartedAccount): string {
  return [openingLine(account), account.opening.rows === 0 ? null : words.setup.rowsHeld].filter((part): part is string => part !== null).join(' ')
}

/** Whether a line offers to have the bank bring the rows of an account kept by hand. */
function offersSync(line: SetupLine): boolean {
  return line.kind === 'kept' && line.account.rowsFrom === 'by-hand' && line.update?.rowsFrom === 'bank-link'
}

/** What Update account or Switch to bank changes, and why the IBAN is one another account already has when the bank gives one IBAN for every currency. */
function changes(line: Extract<SetupLine, { kind: 'kept' | 'fits' }> & { readonly update: Account }): string {
  const { account, update } = line
  const details = [
    ...(account.bank === update.bank || update.bank === null || update.bank === 'other' ? [] : [words.setup.detailBank(words.banks[update.bank])]),
    ...(account.iban === update.iban ? [] : [words.setup.detailIban(update.iban)]),
    ...(account.currency === update.currency ? [] : [words.setup.detailCurrency(update.currency)]),
    ...(account.kind === update.kind ? [] : [words.setup.detailKind(accountWords.kinds[update.kind])]),
  ]
  const shared = account.iban !== update.iban && lines.value.some((other) => other.kind === 'kept' && other.bank === line.bank && other.account.id !== account.id && other.account.iban === update.iban)
  const gives = offersSync(line) ? words.setup.switchGives(details.join(', ')) : words.setup.updateGives(account.name, details.join(', '))
  return shared ? `${gives} ${words.setup.sharedIban(words.banks[line.bank])}` : gives
}

function stateLine(line: SetupLine): string {
  if (line.kind === 'kept') return line.account.rowsFrom === 'by-hand' ? words.setup.keptByHand(line.account.name) : words.setup.keptAs(line.account.name)
  if (line.kind === 'fits') return changes(line)
  return words.setup.notKept
}

/** Adds the accounts, each from its typed day, once every typed day is one its account can start on. */
async function add(adding: readonly { readonly key: string; readonly proposal: AccountProposal }[], key: string): Promise<void> {
  const open = book.value
  if (open === null) return
  tried.value = new Set([...tried.value, ...adding.map((each) => each.key)])
  const starts = adding.flatMap((each) => startOf(each.proposal, each.key) ?? [])
  if (starts.length < adding.length) {
    // Add all may refuse for a field below the fold on a phone, so the first refused day takes focus.
    await nextTick()
    document.querySelector<HTMLInputElement>('[data-testid="spending-bank-account-start"][aria-invalid="true"]')?.focus()
    return
  }
  await writes.write(plural(accountWords.addedCount(starts.length), starts.length), (unit) => addBankAccounts(unit, open, starts, today()), { key, failedTitle: spendingWords.form.notAdded })
}

async function update(account: Account, updated: Account, proposal: AccountProposal | null, key: string): Promise<void> {
  const open = book.value
  if (open === null) return
  const current = open.accounts.find((each) => each.id === account.id)
  if (current === undefined) return
  await writes.write(words.setup.updated, (unit) => takeBankDetails(unit, open, current, updated, proposal, today()), { key, failedTitle: words.setup.notUpdated })
}

async function leaveOut(linked: LinkedAccount, out: boolean, key: string): Promise<void> {
  const open = book.value
  if (open === null) return
  await writes.write(out ? words.setup.markedOut : words.setup.broughtBack, (unit) => keepOutOfKuna(unit, open, linked, out), { key, failedTitle: words.notSaved })
}

async function keepTheirs(line: SetupLine, key: string): Promise<void> {
  const open = book.value
  if (open === null) return
  await writes.write(offersSync(line) ? words.setup.keptByHandToast : words.setup.keptMine, (unit) => keepMine(unit, open, line.linked), { key, failedTitle: words.notSaved })
}

async function bringBackMine(linked: LinkedAccount, key: string): Promise<void> {
  const open = book.value
  if (open === null) return
  await writes.write(words.setup.broughtBack, (unit) => bringBackBankDetails(unit, open, linked), { key, failedTitle: words.notSaved })
}

async function setOpening(difference: BalanceDifference, key: string): Promise<void> {
  const current = book.value?.accounts.find((each) => each.id === difference.account.id)
  if (current === undefined || difference.fixedOpening === null) return
  const opening = difference.fixedOpening
  await writes.write(words.openingSet, (unit) => fixOpening(unit, current, opening), { key, failedTitle: words.notSet })
}
</script>

<template>
  <AppCard :title="words.setup.title" :subtitle="words.setup.subtitle" data-testid="spending-bank-sync-setup">
    <div class="flex flex-col gap-3 px-4 pt-3 pb-4 sm:px-5">
      <UButton
        v-if="addable.length > 1"
        class="self-start"
        :label="words.setup.addAll(addable.length)"
        icon="i-lucide-plus"
        :loading="writes.saving('add-all')"
        data-testid="spending-bank-account-add-all"
        @click="add(addable, 'add-all')"
      />
      <ul v-if="shown.length > 0" class="divide-y divide-default rounded-control border border-default">
        <li v-for="line in shown" :key="setupLineKey(line)" class="flex flex-wrap items-center gap-3 px-3 py-2.5" data-testid="spending-bank-account" :data-kind="line.kind">
          <span class="flex min-w-0 flex-1 basis-60 flex-col gap-0.5">
            <span class="text-sm text-highlighted">{{ title(line.bank, setupLineCurrency(line)) }}</span>
            <span class="type-caption break-words" data-testid="spending-bank-account-about">{{ about(line.linked) }}</span>
            <span class="text-sm text-muted" data-testid="spending-bank-account-state">{{ stateLine(line) }}</span>
            <template v-if="line.kind === 'missing'">
              <template v-if="line.proposal !== null">
                <UFormField
                  :label="accountWords.startDay.label"
                  :help="accountWords.startDay.help"
                  :error="startError(line.proposal, setupLineKey(line))"
                  class="my-1.5"
                  data-testid="spending-bank-account-start-field"
                >
                  <DayField
                    :model-value="typedStart(line.proposal, setupLineKey(line))"
                    :min="startDays(line.proposal).earliest"
                    :max="startDays(line.proposal).latest"
                    class="w-full max-w-60"
                    data-testid="spending-bank-account-start"
                    @update:model-value="typeStart(setupLineKey(line), $event)"
                  />
                </UFormField>
                <template v-if="started.has(setupLineKey(line))">
                  <span class="text-sm text-muted" data-testid="spending-bank-account-draft">{{ draftLine(started.get(setupLineKey(line))!) }}</span>
                  <span class="type-caption">{{ heldLine(started.get(setupLineKey(line))!) }}</span>
                  <span v-if="started.get(setupLineKey(line))!.opening.source === 'pending'" class="type-caption" data-testid="spending-bank-account-pending">{{ words.setup.openingPending }}</span>
                </template>
                <span class="type-caption">{{ words.setup.addBeforeReload }}</span>
              </template>
              <span v-else class="type-caption">{{ words.setup.notFetched }}</span>
            </template>
            <span v-else-if="line.kind === 'kept' && line.update !== null" class="type-caption">{{ changes({ ...line, update: line.update }) }}</span>
          </span>
          <span class="flex flex-wrap gap-2">
            <UButton
              v-if="line.kind === 'missing' && line.proposal !== null"
              :label="words.setup.add"
              color="neutral"
              variant="outline"
              size="sm"
              :loading="writes.saving(`add-${setupLineKey(line)}`)"
              data-testid="spending-bank-account-add"
              @click="add([{ key: setupLineKey(line), proposal: line.proposal }], `add-${setupLineKey(line)}`)"
            />
            <UButton
              v-if="(line.kind === 'kept' || line.kind === 'fits') && line.update !== null"
              :label="offersSync(line) ? words.setup.switchToBank : words.setup.update"
              color="neutral"
              variant="outline"
              size="sm"
              :loading="writes.saving(`update-${setupLineKey(line)}`)"
              data-testid="spending-bank-account-update"
              @click="update(line.account, line.update, line.kind === 'fits' ? line.proposal : null, `update-${setupLineKey(line)}`)"
            />
            <UButton
              v-if="setupActions(line).includes('keep-mine')"
              :label="offersSync(line) ? words.setup.keepByHand : words.setup.keepMine"
              color="neutral"
              variant="ghost"
              size="sm"
              :loading="writes.saving(`mine-${setupLineKey(line)}`)"
              data-testid="spending-bank-account-keep-mine"
              @click="keepTheirs(line, `mine-${setupLineKey(line)}`)"
            />
            <UButton
              v-if="setupActions(line).includes('leave-out')"
              :label="words.setup.leaveOut"
              color="neutral"
              variant="ghost"
              size="sm"
              :loading="writes.saving(`out-${setupLineKey(line)}`)"
              data-testid="spending-bank-account-leave-out"
              @click="leaveOut(line.linked, true, `out-${setupLineKey(line)}`)"
            />
          </span>
        </li>
      </ul>
      <p v-else-if="unexplained.length === 0 && outcome.olderRows.length === 0" class="text-sm text-muted" data-testid="spending-bank-sync-nothing-to-set">{{ words.setup.nothingToSet }}</p>
      <UAlert
        v-for="difference in explained"
        :key="difference.account.id"
        icon="i-lucide-info"
        color="neutral"
        variant="subtle"
        :title="pendingLine(difference)"
        data-testid="spending-bank-sync-pending"
      />
      <UAlert
        v-for="difference in unexplained"
        :key="difference.account.id"
        icon="i-lucide-triangle-alert"
        color="warning"
        variant="subtle"
        :title="differenceLine(difference)"
        :description="difference.pending === null ? words.setOpeningCaption : pendingCaption({ ...difference, pending: difference.pending })"
        data-testid="spending-bank-sync-difference"
      >
        <template v-if="difference.fixedOpening !== null" #actions>
          <UButton
            :label="words.setOpening(formatAccountMoney(difference.fixedOpening, difference.account.currency))"
            color="neutral"
            variant="outline"
            size="sm"
            :loading="writes.saving(`opening-${difference.account.id}`)"
            data-testid="spending-bank-sync-set-opening"
            @click="setOpening(difference, `opening-${difference.account.id}`)"
          />
        </template>
      </UAlert>
      <UAlert
        v-for="older in outcome.olderRows"
        :key="older.account.id"
        icon="i-lucide-triangle-alert"
        color="warning"
        variant="subtle"
        :title="olderRowsLine(older)"
        data-testid="spending-bank-sync-older-rows"
      >
        <template #actions>
          <UButton
            :label="words.linkAgain(words.banks[older.bank])"
            color="neutral"
            variant="outline"
            size="sm"
            :loading="sync.busy.value"
            data-testid="spending-bank-sync-link-again"
            @click="sync.link(older.bank)"
          />
        </template>
      </UAlert>
    </div>
  </AppCard>
  <AppCard v-if="kept.length > 0" :title="plural(words.setup.keptCount(kept.length), kept.length)" collapse-id="spending.bank-sync.kept" start-collapsed data-testid="spending-bank-sync-kept">
    <ul class="divide-y divide-default border-t border-default">
      <li v-for="line in kept" :key="setupLineKey(line)" class="flex flex-wrap items-center gap-3 px-4 py-2.5 sm:px-5" data-testid="spending-bank-account" data-kind="kept">
        <span class="flex min-w-0 flex-1 basis-60 flex-col gap-0.5">
          <span class="text-sm text-highlighted">{{ title(line.bank, setupLineCurrency(line)) }}</span>
          <span class="type-caption break-words" data-testid="spending-bank-account-about">{{ about(line.linked) }}</span>
          <span class="text-sm text-muted" data-testid="spending-bank-account-state">{{ stateLine(line) }}</span>
        </span>
        <UButton
          v-if="setupActions(line).includes('bring-back-mine')"
          :label="line.account.rowsFrom === 'by-hand' ? words.setup.offerBankAgain : words.setup.bringBack"
          color="neutral"
          variant="ghost"
          size="sm"
          :loading="writes.saving(`mine-back-${setupLineKey(line)}`)"
          data-testid="spending-bank-account-bring-back-mine"
          @click="bringBackMine(line.linked, `mine-back-${setupLineKey(line)}`)"
        />
      </li>
    </ul>
  </AppCard>
  <AppCard
    v-if="leftOut.length > 0"
    :title="plural(words.setup.notInKunaCount(leftOut.length), leftOut.length)"
    collapse-id="spending.bank-sync.not-in-kuna"
    data-testid="spending-bank-sync-not-in-kuna"
  >
    <ul class="divide-y divide-default border-t border-default">
      <li v-for="line in leftOut" :key="setupLineKey(line)" class="flex flex-wrap items-center gap-3 px-4 py-2.5 sm:px-5" data-testid="spending-bank-account" data-kind="not-in-kuna">
        <span class="flex min-w-0 flex-1 basis-60 flex-col gap-0.5">
          <span class="text-sm text-highlighted">{{ title(line.bank, setupLineCurrency(line)) }}</span>
          <span class="type-caption break-words" data-testid="spending-bank-account-about">{{ about(line.linked) }}</span>
        </span>
        <UButton
          :label="words.setup.bringBack"
          color="neutral"
          variant="outline"
          size="sm"
          :loading="writes.saving(`back-${setupLineKey(line)}`)"
          data-testid="spending-bank-account-bring-back"
          @click="leaveOut(line.linked, false, `back-${setupLineKey(line)}`)"
        />
      </li>
    </ul>
  </AppCard>
</template>
