<script setup lang="ts">
import AppCard from '../../shared/ui/AppCard.vue'
import { listedRows } from '../../shared/ui/sourceHandover'
import type { HandoverWords } from '../../shared/ui/sourceHandover'
import SourceHandoverAlert from '../../shared/ui/SourceHandoverAlert.vue'

const more = (count: number): string => `And ${count} more.`
const rowLines = ['3 Mar 2026, Example Studio, 1,200.00', '9 Mar 2026, Office rent, −650.00', '14 Mar 2026, Example Client, 2,400.00, pays an invoice']
const manyLines = [...rowLines, '18 Mar 2026, Phone, −32.50', '22 Mar 2026, Card fee, −4.00', '27 Mar 2026, Example Client, 980.00', '31 Mar 2026, Interest, 0.12', '2 Apr 2026, Fuel, −61.30']
const brings = 'The new source brings its own rows. Undo puts these back until it does.'

const heldOnly: HandoverWords = {
  title: 'Giving these days to another source deletes 2 bank rows on hold',
  days: ['From 1 Mar 2026 on: “Bank link” gives way to “Statement file”.'],
  rows: [],
  notes: [brings],
}
const someRows: HandoverWords = {
  title: 'Saving takes out 3 rows',
  days: ['From 1 Mar 2026 on: “Camt file you import” gives way to “Bank’s statements”.'],
  rows: listedRows(rowLines, more),
  notes: ['1 of them pays an invoice, which shows unpaid until the new row pays it.', brings],
}
const manyRows: HandoverWords = {
  title: 'Saving takes out 8 rows',
  days: ['Up to 28 Feb 2026: “By hand” brings its rows.', '1 Mar 2026 – 31 May 2026: “By hand” gives way to “IBKR report by mail”.'],
  rows: listedRows(manyLines, more),
  notes: [brings],
}
</script>

<template>
  <AppCard
    title="SourceHandoverAlert"
    subtitle="Warns, before an account's new source periods are saved, which rows the save takes out for the new source to bring again: the days that change source, the first six rows and a count of the rest, then what else follows. With no rows, as for bank rows on hold, the list is left out."
  >
    <div class="flex flex-col gap-3 px-4 pt-1 pb-4 sm:px-5" data-testid="gallery-source-handover">
      <SourceHandoverAlert :handover="heldOnly" />
      <SourceHandoverAlert :handover="someRows" />
      <SourceHandoverAlert :handover="manyRows" />
    </div>
  </AppCard>
</template>
