<script setup lang="ts">
import { computed, inject } from 'vue'

import { LINKED_SETTINGS_TAB } from './settingsTabs'
import AppCard from '../../../../shared/ui/AppCard.vue'
import { NO_RECORDS, storedOf } from '../../../../shared/storage/domain/recordsRead'
import { useSettings } from '../application/useSettings'
import { useWorkbook } from '../../workbook/application/workbookStore'
import type { AccountRecord } from '../../workbook/domain/accountsReading'
import { recordsOfKindIn } from '../../workbook/domain/readWorkbook'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import { accountUses, periodsRefusalText, writeAccounts } from '../application/namedRecordWrites'
import { periodsChangeRefusal } from '../../../../shared/app/accountSource'
import { today } from '../../../../shared/calendar/civilDate'
import { installedPack } from '../../packs/packContribution'
import { datedOriginsOf } from '../../workbook/domain/accountSources'
import { storedItemsOfRow } from '../../workbook/domain/rowItems'
import type { CompanyPeriod } from '../../workbook/domain/workbook'
import type { RecordsOfKind } from '../application/namedRecordWrites'
import { sourceHandover } from '../domain/sourceHandover'
import { handoverWords } from './sourceHandoverWords'
import type { HandoverWords } from '../../../../shared/ui/sourceHandover'
import { companyBooksOf } from '../../workbook/domain/readWorkbook'
import AccountsEditor from './AccountsEditor.vue'
import { accountBankNames } from '../../workbook/domain/accountBanks'
import { storedCount } from '../../workbook/presentation/storedCount'
import { plural } from '../../../../shared/text/translation'
import { words } from './words'

const { state } = useWorkbook()
const settings = useSettings()
const linkedTab = inject(LINKED_SETTINGS_TAB, null)
const linked = computed(() => linkedTab?.value === 'accounts')
const writes = useRecordWrites(useWorkbook())

const recordsOnScreen: RecordsOfKind = (kind) => (state.records === null ? NO_RECORDS : recordsOfKindIn(state.records, kind))
const accountsInUse = computed(() => accountUses(recordsOnScreen))
const accounts = computed(() => state.records?.accounts ?? NO_RECORDS)

const readAccounts = computed(() => state.workbook?.accounts ?? [])
const banks = computed(() => accountBankNames(readAccounts.value))

/**
 * What saving the account's new periods does: why the write would refuse them, in its words, or the rows it takes out of the
 * ledger for the new source to bring again. The write takes those rows out with the periods, so only a filed day refuses.
 */
function periodsCheck(slug: string, after: readonly CompanyPeriod[]): { readonly fault: string | null; readonly warning: HandoverWords | null } {
  const workbook = state.workbook
  const was = workbook?.accounts.find((account) => account.slug === slug)
  if (workbook === null || was === undefined) return { fault: null, warning: null }
  const handover = sourceHandover(was, after, workbook.transactions)
  const going = new Set(handover?.rows.map((row) => row.id) ?? [])
  const left = workbook.transactions.filter((row) => !going.has(row.id))
  const refusal = periodsChangeRefusal(was.sources, after, datedOriginsOf(was, was.sources, left), installedPack().firstOpenDay(today()))
  if (refusal !== null) return { fault: periodsRefusalText(refusal, false), warning: null }
  const items = state.records?.items ?? NO_RECORDS
  return { fault: null, warning: handover === null ? null : handoverWords(handover, (row) => storedItemsOfRow(items, row).some((item) => item.invoice !== null)) }
}

function saveAccounts(made: readonly { readonly saved: number | null; readonly record: AccountRecord }[]): void {
  void writes.write(
    words.accounts.saved,
    (unit) => {
      const books = companyBooksOf(state)
      if (books === null) throw new Error(words.notSaved)
      writeAccounts(unit, books, storedOf(accounts.value), made)
    },
    { failedTitle: words.notSaved },
  )
}
</script>

<template>
  <AppCard :title="words.accounts.title" collapse-id="settings.accounts" :summary="plural(words.accounts.count(storedCount(accounts)), storedCount(accounts))" :reveal="linked">
    <template #subtitle>{{ words.accounts.subtitle(settings.currency) }}</template>
    <AccountsEditor
      :records="accounts"
      :uses="accountsInUse"
      :currency="settings.currency"
      :saving="writes.saving('save')"
      :refused="writes.refused.value"
      :accounts="readAccounts"
      :banks="banks"
      :periods-check="periodsCheck"
      @save="saveAccounts"
    />
  </AppCard>
</template>
