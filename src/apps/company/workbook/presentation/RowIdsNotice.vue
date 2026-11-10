<script setup lang="ts">
import { computed } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'

import { NO_RECORDS, recordsOf } from '../../../../shared/storage/domain/recordsRead'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import { plural } from '../../../../shared/text/translation'
import { giveRowsIds } from '../application/rowIdWrites'
import { useWorkbook } from '../application/workbookStore'
import { rowsWithoutId } from '../domain/ledgerReading'
import { words } from './words'

/** Offers, while ledger rows from before imports gave each row an id have none, to give them all one in one write with Undo. */
const store = useWorkbook()
const { state } = store
const writes = useRecordWrites(store)

const count = computed(() => rowsWithoutId(recordsOf(state.records?.ledger ?? NO_RECORDS)).length)

function give(): void {
  const records = state.records
  if (records === null) return
  const given = count.value
  void writes.write(plural(words.rowIds.given(given), given), (unit) => giveRowsIds(unit, records), { failedTitle: words.rowIds.notGiven, key: 'row-ids', titleCounts: true })
}
</script>

<template>
  <UAlert
    v-if="count > 0"
    icon="i-lucide-fingerprint"
    color="info"
    variant="subtle"
    :title="plural(words.rowIds.title(count), count)"
    :description="words.rowIds.description"
    :actions="[{ label: words.rowIds.give, icon: 'i-lucide-fingerprint', color: 'neutral', variant: 'outline', size: 'sm', loading: writes.saving('row-ids'), onClick: give }]"
    data-testid="row-ids-notice"
  />
</template>
