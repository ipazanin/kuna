<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'

import { saveDeployment } from '../application/bankSync'
import type { BankSyncOutcome } from '../application/bankSync'
import { loadPendingLink } from '../infrastructure/bankBrowserState'
import { notedBankReturn } from './bankReturnOnOpen'
import BankAccountsSetup from './BankAccountsSetup.vue'
import { BANK_SYNC_SCOPE } from './bankSyncPort'
import { heldBankSetup, useBankSync } from './useBankSync'
import { words } from './words'
import { useHeldRows } from './useHeldRows'
import DryRunLines from '../../statements/presentation/DryRunLines.vue'
import { rowKey } from '../../workbook/domain/transaction'
import QuestionList from '../../../../shared/ui/QuestionList.vue'
import { twinWords } from '../../../../shared/ai/presentation/copiedRowsWords'
import AccountMoneyText from '../../accounts/presentation/AccountMoneyText.vue'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import { LINKABLE_BANKS } from '../../workbook/domain/spendingSettings'
import { today } from '../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { currentToken } from '../../../../shared/google/googleAuth'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import { usePageSync } from '../../../../shared/sync/presentation/pageSync'
import AppCard from '../../../../shared/ui/AppCard.vue'
import FormGrid from '../../../../shared/ui/FormGrid.vue'

/** Settings' Bank sync tab: the script's deployment, a link per bank, and what the last fetch did. With no deployment saved it shows the field and nothing else. */
const store = useSpendingBooks()
const writes = useRecordWrites(store)
const page = usePageSync()
const sync = useBankSync()

/** The rows this fetch put on hold, asked about here as on To review. */
const held = useHeldRows((key) => sync.lastOutcome.value?.dryRun.lines.some((line) => line.outcome === 'look-alike' && rowKey(line.row) === key) ?? false)

const settings = computed(() => store.state.workbook?.settings ?? null)
const deployment = ref(settings.value?.bankSyncDeployment ?? '')
watch(
  () => settings.value?.bankSyncDeployment,
  (saved) => {
    deployment.value = saved ?? ''
  },
)
const saved = computed(() => (settings.value?.bankSyncDeployment ?? '') !== '')
const unchanged = computed(() => deployment.value.trim() === (settings.value?.bankSyncDeployment ?? ''))

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

function announced(outcome: BankSyncOutcome | null): void {
  if (outcome?.receipt) writes.announce(outcome.receipt)
}

async function save(): Promise<void> {
  const typed = deployment.value.trim()
  const book = store.state.workbook
  if (book === null) return
  // Called first in the tap, so Google's window may open. Only a first deployment asks, and a blank one asks for nothing.
  await page.saveAllowing(typed === '' || saved.value ? [] : [BANK_SYNC_SCOPE], () =>
    writes.write(words.saved, (unit) => saveDeployment(unit, book, typed), { key: 'deployment', failedTitle: words.notSaved }),
  )
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
    <AppCard :title="words.title" :subtitle="words.subtitle" data-testid="spending-bank-sync">
      <div class="flex flex-col gap-4 px-4 pt-3 pb-4 sm:px-5">
        <FormGrid>
          <UFormField :label="words.deployment" :help="words.deploymentHelp" class="sm:col-span-2" data-testid="spending-bank-sync-deployment">
            <UInput v-model="deployment" class="w-full" autocomplete="off" spellcheck="false" />
          </UFormField>
        </FormGrid>
        <UButton class="self-start" :label="words.save" icon="i-lucide-save" :disabled="unchanged" :loading="writes.saving('deployment')" data-testid="spending-bank-sync-save" @click="save" />
        <UAlert v-if="returnLine !== null" icon="i-lucide-triangle-alert" color="warning" variant="subtle" :title="returnLine" data-testid="spending-bank-sync-return" />
        <UAlert v-if="sync.failure.value !== null" icon="i-lucide-triangle-alert" color="error" variant="subtle" :title="sync.failure.value" data-testid="spending-bank-sync-failed" />
        <template v-if="saved">
          <ul class="divide-y divide-default rounded-control border border-default">
            <li v-for="{ bank, name, line, action } in banks" :key="bank" class="flex flex-wrap items-center gap-3 px-3 py-2.5" data-testid="spending-bank-link">
              <span class="flex min-w-0 flex-1 flex-col gap-0.5">
                <span class="text-sm text-highlighted">{{ name }}</span>
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
    <BankAccountsSetup v-if="setup !== null && setup.linked.length > 0" :outcome="setup" />
    <AppCard v-if="sync.lastOutcome.value !== null" :title="words.lastSync" data-testid="spending-bank-sync-result">
      <div class="flex flex-col gap-3 px-4 pt-3 pb-4 sm:px-5">
        <p class="text-sm text-highlighted" data-testid="spending-bank-sync-summary">
          {{ words.summary(sync.lastOutcome.value.dryRun.newRows, sync.lastOutcome.value.dryRun.alreadyIn, sync.lastOutcome.value.dryRun.filled) }}
        </p>
        <ul v-if="sync.lastOutcome.value.dryRun.notes.length > 0" class="flex flex-col gap-1 text-sm text-muted" data-testid="spending-bank-sync-notes">
          <li v-for="note in sync.lastOutcome.value.dryRun.notes" :key="note">{{ note }}</li>
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
            <AccountMoneyText :cents="item.amount" :currency="item.currency" sign="always" tone="flow" />
          </template>
        </QuestionList>
        <DryRunLines v-if="sync.lastOutcome.value.dryRun.lines.length > 0" :lines="sync.lastOutcome.value.dryRun.lines" />
        <p v-else class="text-sm text-muted">{{ words.nothing }}</p>
      </div>
    </AppCard>
  </div>
</template>
