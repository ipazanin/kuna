<script setup lang="ts">
import { computed } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'

import { addBankAccounts, bringBackBankDetails, fixOpening, keepMine, keepOutOfKuna, takeBankDetails } from '../application/bankSetupWrites'
import type { BankSyncOutcome } from '../application/bankSync'
import { bankAccountKey, setupLines } from '../domain/bankAccountSetup'
import type { AccountProposal, SetupLine } from '../domain/bankAccountSetup'
import type { LinkedAccount } from '../domain/bankAnswer'
import type { BalanceDifference } from '../domain/bankBalance'
import { differenceLine, olderRowsLine, pendingCaption, pendingLine } from './bankStepResult'
import { useBankSync } from './useBankSync'
import { words } from './words'
import { words as accountWords } from '../../accounts/presentation/words'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import type { Account } from '../../workbook/domain/account'
import type { LinkableBank } from '../../workbook/domain/spendingSettings'
import { today } from '../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { formatAccountMoney } from '../../../../shared/money/moneyFormat'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import { plural } from '../../../../shared/text/translation'
import AppCard from '../../../../shared/ui/AppCard.vue'

/** The Bank sync tab's list of every account the linked banks give, each kept, offered to add, offered to update, or left out of Kuna, and the fixes the last fetch's balances suggest. */
const props = defineProps<{ outcome: Pick<BankSyncOutcome, 'linked' | 'proposals' | 'differences' | 'olderRows'> }>()

const store = useSpendingBooks()
const writes = useRecordWrites(store)
const sync = useBankSync()

const book = computed(() => store.state.workbook)
const lines = computed<readonly SetupLine[]>(() => (book.value === null ? [] : setupLines(props.outcome.linked, props.outcome.proposals, book.value)))
/** The lines that ask for something: an account to add, one to update, and one that fits once it takes the bank's details. */
const shown = computed(() => lines.value.filter((line) => line.kind !== 'not-in-kuna' && !(line.kind === 'kept' && line.update === null)))
const kept = computed(() => lines.value.flatMap((line) => (line.kind === 'kept' && line.update === null ? [line] : [])))
const leftOut = computed(() => lines.value.flatMap((line) => (line.kind === 'not-in-kuna' ? [line] : [])))
/** The differences whose account still opens as it did at the fetch, so one fixed or edited since stops showing. */
const differences = computed(() =>
  props.outcome.differences.filter((difference) => book.value?.accounts.find((account) => account.id === difference.account.id)?.opening === difference.account.opening),
)
const explained = computed(() => differences.value.filter((difference) => difference.explained))
const unexplained = computed(() => differences.value.filter((difference) => !difference.explained))
const addable = computed(() => lines.value.flatMap((line) => (line.kind === 'missing' && line.proposal !== null ? [line.proposal] : [])))

function title(bank: LinkableBank, currency: string): string {
  return words.setup.account(words.banks[bank], currency)
}

function about(linked: LinkedAccount): string {
  return [linked.iban, linked.product, linked.details].filter((part): part is string => part !== null && part.trim() !== '').join(' · ')
}

function draftLine({ account }: AccountProposal): string {
  const kind = accountWords.kinds[account.kind]
  const named = account.name.toLowerCase().includes(kind.toLowerCase())
  return words.setup.draft(account.name, named ? null : kind, formatAccountMoney(account.opening, account.currency), dayLabel(account.openedOn))
}

/** How the opening was worked out. Null while the bank holds pending rows, since only the warning about them is worth saying then. */
function openingLine({ opening }: AccountProposal): string | null {
  if (opening.source === 'start') return words.setup.openingStart
  if (opening.source === 'guess') return words.setup.openingGuess
  if (opening.source === 'pending') return null
  return plural(words.setup.openingWorked(opening.rows), opening.rows)
}

function heldLine(proposal: AccountProposal): string {
  return [openingLine(proposal), words.setup.rowsHeld].filter((part): part is string => part !== null).join(' ')
}

/** What Update account changes, and why the IBAN is one another account already has when the bank gives one IBAN for every currency. */
function changes(line: Extract<SetupLine, { kind: 'kept' | 'fits' }> & { readonly update: Account }): string {
  const { account, update } = line
  const details = [
    ...(account.bank === update.bank || update.bank === null || update.bank === 'other' ? [] : [words.setup.detailBank(words.banks[update.bank])]),
    ...(account.iban === update.iban ? [] : [words.setup.detailIban(update.iban)]),
    ...(account.currency === update.currency ? [] : [words.setup.detailCurrency(update.currency)]),
    ...(account.kind === update.kind ? [] : [words.setup.detailKind(accountWords.kinds[update.kind])]),
  ]
  const shared = account.iban !== update.iban && lines.value.some((other) => other.kind === 'kept' && other.bank === line.bank && other.account.id !== account.id && other.account.iban === update.iban)
  const gives = words.setup.updateGives(account.name, details.join(', '))
  return shared ? `${gives} ${words.setup.sharedIban(words.banks[line.bank])}` : gives
}

function stateLine(line: SetupLine): string {
  if (line.kind === 'kept') return words.setup.keptAs(line.account.name)
  if (line.kind === 'fits') return changes(line)
  return words.setup.notKept
}

function currencyOf(line: SetupLine): string {
  if (line.kind === 'kept' || line.kind === 'fits') return line.update?.currency ?? line.account.currency
  return line.kind === 'missing' ? line.currency : line.linked.currency
}

function keyOf(line: SetupLine): string {
  return `${line.linked.uid} ${currencyOf(line)}`
}

async function add(proposals: readonly AccountProposal[], key: string): Promise<void> {
  const open = book.value
  if (open === null) return
  await writes.write(plural(words.setup.added(proposals.length), proposals.length), (unit) => addBankAccounts(unit, open, proposals, today()), { key, failedTitle: words.setup.notAdded })
}

async function update(account: Account, updated: Account, proposal: AccountProposal | null, key: string): Promise<void> {
  const open = book.value
  if (open === null) return
  const current = open.accounts.find((each) => each.id === account.id)
  if (current === undefined) return
  await writes.write(words.setup.updated, (unit) => takeBankDetails(unit, open, current, { ...current, ...pick(updated) }, proposal, today()), { key, failedTitle: words.setup.notUpdated })
}

/** The bank's details only, so a change made to the account since the fetch stays. */
function pick({ bank, iban, currency, kind }: Account): Pick<Account, 'bank' | 'iban' | 'currency' | 'kind'> {
  return { bank, iban, currency, kind }
}

async function leaveOut(linked: LinkedAccount, out: boolean, key: string): Promise<void> {
  const open = book.value
  if (open === null) return
  await writes.write(out ? words.setup.markedOut : words.setup.broughtBack, (unit) => keepOutOfKuna(unit, open, linked, out), { key, failedTitle: words.notSaved })
}

async function keepTheirs(linked: LinkedAccount, key: string): Promise<void> {
  const open = book.value
  if (open === null) return
  await writes.write(words.setup.keptMine, (unit) => keepMine(unit, open, linked), { key, failedTitle: words.notSaved })
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
        <li v-for="line in shown" :key="keyOf(line)" class="flex flex-wrap items-center gap-3 px-3 py-2.5" data-testid="spending-bank-account" :data-kind="line.kind">
          <span class="flex min-w-0 flex-1 basis-60 flex-col gap-0.5">
            <span class="text-sm text-highlighted">{{ title(line.bank, currencyOf(line)) }}</span>
            <span class="type-caption break-words" data-testid="spending-bank-account-about">{{ about(line.linked) }}</span>
            <span class="text-sm text-muted" data-testid="spending-bank-account-state">{{ stateLine(line) }}</span>
            <template v-if="line.kind === 'missing'">
              <template v-if="line.proposal !== null">
                <span class="text-sm text-muted" data-testid="spending-bank-account-draft">{{ draftLine(line.proposal) }}</span>
                <span class="type-caption">{{ heldLine(line.proposal) }}</span>
                <span v-if="line.proposal.opening.source === 'pending'" class="type-caption" data-testid="spending-bank-account-pending">{{ words.setup.openingPending }}</span>
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
              :loading="writes.saving(`add-${keyOf(line)}`)"
              data-testid="spending-bank-account-add"
              @click="add([line.proposal], `add-${keyOf(line)}`)"
            />
            <UButton
              v-if="(line.kind === 'kept' || line.kind === 'fits') && line.update !== null"
              :label="words.setup.update"
              color="neutral"
              variant="outline"
              size="sm"
              :loading="writes.saving(`update-${keyOf(line)}`)"
              data-testid="spending-bank-account-update"
              @click="update(line.account, line.update, line.kind === 'fits' ? line.proposal : null, `update-${keyOf(line)}`)"
            />
            <UButton
              v-if="line.kind === 'kept' && line.update !== null && bankAccountKey(line.linked) !== null"
              :label="words.setup.keepMine"
              color="neutral"
              variant="ghost"
              size="sm"
              :loading="writes.saving(`mine-${keyOf(line)}`)"
              data-testid="spending-bank-account-keep-mine"
              @click="keepTheirs(line.linked, `mine-${keyOf(line)}`)"
            />
            <UButton
              v-if="(line.kind === 'missing' || line.kind === 'fits') && bankAccountKey(line.linked) !== null"
              :label="words.setup.leaveOut"
              color="neutral"
              variant="ghost"
              size="sm"
              :loading="writes.saving(`out-${keyOf(line)}`)"
              data-testid="spending-bank-account-leave-out"
              @click="leaveOut(line.linked, true, `out-${keyOf(line)}`)"
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
      <li v-for="line in kept" :key="keyOf(line)" class="flex flex-wrap items-center gap-3 px-4 py-2.5 sm:px-5" data-testid="spending-bank-account" data-kind="kept">
        <span class="flex min-w-0 flex-1 basis-60 flex-col gap-0.5">
          <span class="text-sm text-highlighted">{{ title(line.bank, currencyOf(line)) }}</span>
          <span class="type-caption break-words" data-testid="spending-bank-account-about">{{ about(line.linked) }}</span>
          <span class="text-sm text-muted" data-testid="spending-bank-account-state">{{ stateLine(line) }}</span>
        </span>
        <UButton
          v-if="line.keptMine"
          :label="words.setup.bringBack"
          color="neutral"
          variant="ghost"
          size="sm"
          :loading="writes.saving(`mine-back-${keyOf(line)}`)"
          data-testid="spending-bank-account-bring-back-mine"
          @click="bringBackMine(line.linked, `mine-back-${keyOf(line)}`)"
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
      <li v-for="line in leftOut" :key="keyOf(line)" class="flex flex-wrap items-center gap-3 px-4 py-2.5 sm:px-5" data-testid="spending-bank-account" data-kind="not-in-kuna">
        <span class="flex min-w-0 flex-1 basis-60 flex-col gap-0.5">
          <span class="text-sm text-highlighted">{{ title(line.bank, currencyOf(line)) }}</span>
          <span class="type-caption break-words" data-testid="spending-bank-account-about">{{ about(line.linked) }}</span>
        </span>
        <UButton
          :label="words.setup.bringBack"
          color="neutral"
          variant="outline"
          size="sm"
          :loading="writes.saving(`back-${keyOf(line)}`)"
          data-testid="spending-bank-account-bring-back"
          @click="leaveOut(line.linked, false, `back-${keyOf(line)}`)"
        />
      </li>
    </ul>
  </AppCard>
</template>
