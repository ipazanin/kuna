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
import { writeDrafts } from '../application/draftWrites'
import { ACCOUNT_WRITES, accountUses } from '../application/namedRecordWrites'
import type { RecordsOfKind } from '../application/namedRecordWrites'
import AccountsEditor from './AccountsEditor.vue'
import { storedCount } from './settingsCounts'
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
const saving = computed(() => writes.busy.value || state.writing)

function saveAccounts(made: readonly { readonly saved: number | null; readonly record: AccountRecord }[]): void {
  void writes.write(words.accounts.saved, (unit) => writeDrafts(unit.of(ACCOUNT_WRITES), storedOf(accounts.value), made), {
    failedTitle: words.notSaved,
  })
}
</script>

<template>
  <AppCard :title="words.accounts.title" collapse-id="settings.accounts" :summary="plural(words.accounts.count(storedCount(accounts)), storedCount(accounts))" :reveal="linked">
    <template #subtitle>{{ words.accounts.subtitle(settings.currency) }}</template>
    <AccountsEditor :records="accounts" :uses="accountsInUse" :currency="settings.currency" :saving="saving" @save="saveAccounts" />
  </AppCard>
</template>
