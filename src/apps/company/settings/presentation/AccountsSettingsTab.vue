<script setup lang="ts">
import { computed, inject } from 'vue'

import { LINKED_SETTINGS_TAB } from '../../../../shared/app/appContribution'
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
import { rowsInWords, storedCount } from './settingsCounts'

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
  void writes.write('Accounts saved', (unit) => writeDrafts(unit.of(ACCOUNT_WRITES), storedOf(accounts.value), made), {
    failedTitle: 'Not saved',
  })
}
</script>

<template>
  <AppCard
    title="Accounts"
    collapse-id="settings.accounts"
    :summary="rowsInWords(storedCount(accounts), 'account', 'accounts')"
    :reveal="linked"
  >
    <template #subtitle>
      Your bank accounts, by the names ledger rows use. A blank currency means {{ settings.currency }}.
    </template>
    <AccountsEditor
      :records="accounts"
      :uses="accountsInUse"
      :currency="settings.currency"
      :saving="saving"
      @save="saveAccounts"
    />
  </AppCard>
</template>
