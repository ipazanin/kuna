<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'

import type { BankSyncOutcome } from '../application/bankSync'
import { loadPendingLink } from '../infrastructure/bankBrowserState'
import { notedBankReturn } from './bankReturnOnOpen'
import BankAccountsSetup from './BankAccountsSetup.vue'
import BankApplicationPanel from './BankApplicationPanel.vue'
import BankFieldsCard from './BankFieldsCard.vue'
import BankSyncSetup from './BankSyncSetup.vue'
import { BANK_SYNC_SCOPE, bankSyncBuiltIn } from './bankSyncPort'
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
import { LINKABLE_BANKS, bankSyncSetUp } from '../../workbook/domain/spendingSettings'
import { today } from '../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { currentToken } from '../../../../shared/google/googleAuth'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import AppCard from '../../../../shared/ui/AppCard.vue'
import NoteLine from '../../../../shared/ui/NoteLine.vue'

/**
 * Settings' Bank sync tab: the person's own Enable Banking application, a link per bank, and what the last fetch did. With
 * no application set up it walks the person through making one and bringing its key, and shows nothing else.
 */
const store = useSpendingBooks()
const writes = useRecordWrites(store)
const sync = useBankSync()
const builtIn = bankSyncBuiltIn()

/** The rows this fetch put on hold, asked about here as on To review. */
const held = useHeldRows((key) => sync.lastOutcome.value?.dryRun.lines.some((line) => line.outcome === 'look-alike' && rowKey(line.row) === key) ?? false)

const settings = computed(() => store.state.workbook?.settings ?? null)
const saved = computed(() => settings.value !== null && bankSyncSetUp(settings.value))
/** The walk-through stays open from its Check until Done, so its last step can say whether the application is active. */
const finishing = ref(false)
const walking = computed(() => settings.value !== null && (!saved.value || finishing.value))

const banks = computed(() =>
  LINKABLE_BANKS.map((bank) => {
    const until = settings.value?.bankLinks[bank] ?? null
    return {
      bank,
      name: words.banks[bank],
      until,
      line: until === null ? words.notLinked : until < today() ? words.endedOn(dayLabel(until)) : words.linkedUntil(dayLabel(until)),
      action: until === null ? words.link(words.banks[bank]) : words.linkAgain(words.banks[bank]),
    }
  }),
)

const pendingCode = ref(loadPendingLink()?.code != null)
const pendingBank = computed(() => {
  const pending = loadPendingLink()
  return pendingCode.value && pending !== null ? words.banks[pending.bank] : null
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
      if (pendingCode.value && currentToken(BANK_SYNC_SCOPE) !== null) void finish()
    },
    { immediate: true },
  )
})
</script>

<template>
  <div class="flex flex-col gap-6">
    <BankSyncSetup v-if="builtIn && walking" @holding="finishing = true" @done="finishing = false" />
    <AppCard v-else :title="words.title" :subtitle="words.subtitle" data-testid="spending-bank-sync">
      <div class="flex flex-col gap-4 px-4 pt-3 pb-4 sm:px-5">
        <NoteLine v-if="!builtIn" tone="info" size="body" data-testid="spending-bank-sync-no-script">{{ words.noScript }}</NoteLine>
        <BankApplicationPanel v-else :application-id="settings?.bankSyncApplication ?? ''" />
        <UAlert v-if="returnLine !== null" icon="i-lucide-triangle-alert" color="warning" variant="subtle" :title="returnLine" data-testid="spending-bank-sync-return" />
        <UAlert v-if="sync.failure.value !== null" icon="i-lucide-triangle-alert" color="error" variant="subtle" :title="sync.failure.value" data-testid="spending-bank-sync-failed" />
        <template v-if="builtIn && saved">
          <ul class="divide-y divide-default rounded-control border border-default">
            <li v-for="{ bank, name, line, action } in banks" :key="bank" class="flex flex-wrap items-center gap-3 px-3 py-2.5" data-testid="spending-bank-link">
              <span class="flex min-w-0 flex-1 flex-col gap-0.5">
                <span class="type-row-title">{{ name }}</span>
                <span class="type-caption" data-testid="spending-bank-link-state">{{ line }}</span>
              </span>
              <UButton :label="action" color="neutral" variant="outline" size="sm" :loading="sync.busy.value" :data-testid="`spending-bank-link-${bank}`" @click="sync.link(bank)" />
            </li>
          </ul>
          <div class="flex flex-wrap gap-3">
            <UButton v-if="pendingBank !== null" :label="words.finish(pendingBank)" icon="i-lucide-link" :loading="sync.busy.value" data-testid="spending-bank-link-finish" @click="finish" />
            <UButton v-else-if="sync.canSync()" :label="words.syncNow" icon="i-lucide-refresh-cw" :loading="sync.busy.value" data-testid="spending-bank-sync-now" @click="syncNow" />
          </div>
        </template>
      </div>
    </AppCard>
    <BankFieldsCard v-if="builtIn && saved && banks.some(({ until }) => until !== null)" :application-id="settings?.bankSyncApplication ?? ''" />
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
