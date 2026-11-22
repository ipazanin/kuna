<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'

import type { BankSyncOutcome } from '../application/bankSync'
import { loadPendingLink } from '../../../../shared/bank-sync/infrastructure/bankBrowserState'
import { notedBankReturn } from './bankReturnOnOpen'
import BankAccountsSetup from './BankAccountsSetup.vue'
import BankApplicationPanel from './BankApplicationPanel.vue'
import BankFieldsCard from './BankFieldsCard.vue'
import BankLinkDialog from '../../../../shared/bank-sync/presentation/BankLinkDialog.vue'
import BankSyncSetup from '../../../../shared/bank-sync/presentation/BankSyncSetup.vue'
import { BANK_SYNC_SCOPE, bankSyncBuiltIn } from '../../../../shared/bank-sync/application/pageBankSync'
import { words as bankScriptWords } from '../../../../shared/bank-sync/application/words'
import { words as bankWords } from '../../../../shared/bank-sync/presentation/words'
import { BANK_USAGE } from '../domain/bankLinks'
import { useSpendingBankHost } from './spendingBankHost'
import { heldBankSetup, useBankSync } from './useBankSync'
import { words } from './words'
import { useHeldRows } from './useHeldRows'
import DryRunLines from '../../statements/presentation/DryRunLines.vue'
import { dryRunNotes } from '../../statements/presentation/readingLines'
import { rowKey } from '../../workbook/domain/transaction'
import QuestionList from '../../../../shared/ui/QuestionList.vue'
import { twinWords } from '../../../../shared/ai/presentation/copiedRowsWords'
import AccountMoneyText from '../../accounts/presentation/AccountMoneyText.vue'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import { bankSyncSetUp } from '../../workbook/domain/spendingSettings'
import { today } from '../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { currentToken } from '../../../../shared/google/googleAuth'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import AppCard from '../../../../shared/ui/AppCard.vue'
import AppDialog from '../../../../shared/ui/AppDialog.vue'
import NoteLine from '../../../../shared/ui/NoteLine.vue'

/**
 * Settings' Bank sync tab: the person's own Enable Banking application, each bank linked with a personal login, and what the last fetch did. A
 * linked bank Enable Banking no longer lists keeps its row, which offers Remove in place of Link again. Remove asks first, since the bank's
 * session cannot come back. With no application set up it walks the person through making one and bringing its key, and shows nothing else.
 */
const store = useSpendingBooks()
const writes = useRecordWrites(store)
const sync = useBankSync()
const host = useSpendingBankHost()
const builtIn = bankSyncBuiltIn()

/** The rows this fetch put on hold, asked about here as on To review. */
const held = useHeldRows((key) => sync.lastOutcome.value?.dryRun.lines.some((line) => line.outcome === 'look-alike' && rowKey(line.row) === key) ?? false)

const settings = computed(() => store.state.workbook?.settings ?? null)
const saved = computed(() => settings.value !== null && bankSyncSetUp(settings.value))
/** The walk-through stays open from its Check until Done, so its last step can say whether the application is active. */
const finishing = ref(false)
const walking = computed(() => settings.value !== null && (!saved.value || finishing.value))

const links = computed(() => (store.state.workbook?.bankLinks ?? []).filter((link) => link.usage === BANK_USAGE))
const linkRows = computed(() =>
  links.value.map((link) => {
    const listed = sync.listed.value === null || sync.listed.value.some((bank) => bank.name === link.bank)
    return {
      link,
      line: link.endsOn < today() ? words.endedOn(dayLabel(link.endsOn)) : words.linkedUntil(dayLabel(link.endsOn)),
      listed,
    }
  }),
)
const picking = ref(false)
/** The bank whose Remove is asking first, or null. */
const confirmingRemoval = ref<string | null>(null)
const removalOpen = computed({
  get: () => confirmingRemoval.value !== null,
  set: (open) => {
    if (!open) confirmingRemoval.value = null
  },
})

async function removeLink(): Promise<void> {
  const bank = confirmingRemoval.value
  if (bank !== null && (await sync.removeLink(bank))) confirmingRemoval.value = null
}

const pendingCode = ref(loadPendingLink()?.code != null)
const pendingBank = computed(() => {
  const pending = loadPendingLink()
  return pendingCode.value && pending !== null ? pending.bank : null
})

const returned = notedBankReturn()
const returnLine = returned?.kind === 'refused' ? words.linkRefused(returned.reason) : returned?.kind === 'elsewhere' ? words.cameBackElsewhere : null

/** After a reload the last fetch's accounts, against the file, with nothing held, so the step's link still lands on the list. */
const setup = computed(heldBankSetup)
/** What the last sync's dry run left out or noticed. */
const syncNotes = computed(() => (sync.lastOutcome.value === null ? [] : dryRunNotes(sync.lastOutcome.value.dryRun, store.state.workbook?.accounts ?? [])))

function announced(outcome: BankSyncOutcome | null): void {
  if (outcome?.receipt) writes.announce(outcome.receipt)
}

async function finish(): Promise<void> {
  announced(await sync.finishLink())
  pendingCode.value = loadPendingLink()?.code != null
}

async function syncNow(): Promise<void> {
  announced(await sync.syncNow())
}

onMounted(() => {
  // Back from the bank with the page already holding the access: nothing to tap. Without it, as after a reload in Firefox, Finish linking takes the tap Google's window needs.
  const stop = watch(
    () => store.state.workbook !== null,
    (open) => {
      if (!open) return
      queueMicrotask(() => stop())
      if (currentToken(BANK_SYNC_SCOPE) === null) return
      if (pendingCode.value) void finish()
      // With the access already here, the list says which linked bank Enable Banking no longer has, at no tap's cost.
      else if (saved.value && links.value.length > 0) void sync.listBanks()
    },
    { immediate: true },
  )
})
</script>

<template>
  <div class="flex flex-col gap-6">
    <BankSyncSetup v-if="builtIn && walking" :host="host" @holding="finishing = true" @done="finishing = false" />
    <AppCard v-else :title="words.title" :subtitle="words.subtitle" data-testid="spending-bank-sync">
      <div class="flex flex-col gap-4 px-4 pt-3 pb-4 sm:px-5">
        <NoteLine v-if="!builtIn" tone="info" size="body" data-testid="spending-bank-sync-no-script">{{ bankScriptWords.noScript }}</NoteLine>
        <BankApplicationPanel v-else :application-id="settings?.bankSyncApplication ?? ''" />
        <UAlert v-if="returnLine !== null" icon="i-lucide-triangle-alert" color="warning" variant="subtle" :title="returnLine" data-testid="spending-bank-sync-return" />
        <UAlert v-if="sync.failure.value !== null" icon="i-lucide-triangle-alert" color="error" variant="subtle" :title="sync.failure.value" data-testid="spending-bank-sync-failed" />
        <template v-if="builtIn && saved">
          <ul v-if="linkRows.length > 0" class="divide-y divide-default rounded-control border border-default">
            <li v-for="{ link, line, listed } in linkRows" :key="link.id" class="flex flex-wrap items-center gap-3 px-3 py-2.5" data-testid="spending-bank-link">
              <span class="flex min-w-0 flex-1 flex-col gap-0.5">
                <span class="type-row-title">{{ link.bank }}</span>
                <span class="type-caption" data-testid="spending-bank-link-state">{{ line }}</span>
                <NoteLine v-if="!listed" tone="warning" data-testid="spending-bank-link-not-listed">{{ words.notListed }}</NoteLine>
              </span>
              <UButton
                v-if="listed"
                :label="words.linkAgain"
                :aria-label="words.linkAgainOf(link.bank)"
                color="neutral"
                variant="outline"
                size="sm"
                :loading="sync.busy.value"
                data-testid="spending-bank-link-again"
                @click="sync.link(link.bank)"
              />
              <UButton
                v-else
                :label="words.removeLink"
                :aria-label="words.removeLinkOf(link.bank)"
                icon="i-lucide-unlink"
                color="error"
                variant="ghost"
                size="sm"
                data-testid="spending-bank-link-remove"
                @click="confirmingRemoval = link.bank"
              />
            </li>
          </ul>
          <p v-else class="type-aside" data-testid="spending-bank-link-none">{{ words.noLinkYet }}</p>
          <div class="flex flex-wrap gap-3">
            <UButton :label="words.linkBank" icon="i-lucide-landmark" color="neutral" variant="outline" :loading="sync.busy.value" data-testid="spending-bank-link-add" @click="picking = true" />
            <UButton v-if="pendingBank !== null" :label="words.finish(pendingBank)" icon="i-lucide-link" :loading="sync.busy.value" data-testid="spending-bank-link-finish" @click="finish" />
            <UButton v-else-if="sync.canSync()" :label="words.syncNow" icon="i-lucide-refresh-cw" :loading="sync.busy.value" data-testid="spending-bank-sync-now" @click="syncNow" />
          </div>
        </template>
      </div>
    </AppCard>
    <AppDialog
      v-model:open="removalOpen"
      :title="words.removeLinkTitle(confirmingRemoval ?? '')"
      :description="words.removeLinkDescription(confirmingRemoval ?? '')"
      :dismissible="sync.removing.value === null"
      changes
    >
      <template #end>
        <UButton :label="bankWords.key.cancel" color="neutral" variant="ghost" :disabled="sync.removing.value !== null" @click="confirmingRemoval = null" />
        <UButton
          :label="words.removeLink"
          icon="i-lucide-unlink"
          color="error"
          :loading="sync.removing.value !== null"
          :disabled="writes.refused.value"
          data-testid="spending-bank-link-remove-confirm"
          @click="removeLink"
        />
      </template>
    </AppDialog>
    <BankLinkDialog v-if="builtIn && saved" v-model:open="picking" :links="links" :linking="sync" :host="host" />
    <BankFieldsCard v-if="builtIn && saved && links.length > 0" :application-id="settings?.bankSyncApplication ?? ''" />
    <BankAccountsSetup v-if="setup !== null && setup.linked.length > 0" :outcome="setup" />
    <AppCard v-if="sync.lastOutcome.value !== null" :title="words.lastSync" data-testid="spending-bank-sync-result">
      <div class="flex flex-col gap-3 px-4 pt-3 pb-4 sm:px-5">
        <p class="type-row-title" data-testid="spending-bank-sync-summary">
          {{ words.summary(sync.lastOutcome.value.dryRun.newRows, sync.lastOutcome.value.dryRun.alreadyIn, sync.lastOutcome.value.dryRun.filled) }}
        </p>
        <ul v-if="syncNotes.length > 0" class="flex flex-col gap-1 type-aside" data-testid="spending-bank-sync-notes">
          <li v-for="note in syncNotes" :key="note">{{ note }}</li>
        </ul>
        <UAlert
          v-for="problem in sync.lastOutcome.value.problems"
          :key="problem"
          icon="i-lucide-triangle-alert"
          color="warning"
          variant="subtle"
          :title="problem"
          data-testid="spending-bank-sync-problem"
        />
        <QuestionList
          v-if="held.items.value.length > 0"
          :items="held.items.value"
          :options="held.options"
          :label="twinWords.choice"
          :heading="twinWords.title"
          :intro="twinWords.intro.sync"
          :saving="held.saving.value"
          @answer="held.answer"
        >
          <template #amount="{ item }">
            <AccountMoneyText :cents="item.amount" :currency="item.currency" tone="flow" />
          </template>
        </QuestionList>
        <DryRunLines v-if="sync.lastOutcome.value.dryRun.lines.length > 0" :lines="sync.lastOutcome.value.dryRun.lines" :below-questions="held.items.value.length > 0" />
        <p v-else class="type-aside">{{ words.nothing }}</p>
      </div>
    </AppCard>
  </div>
</template>
