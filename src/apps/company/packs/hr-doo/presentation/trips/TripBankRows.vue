<script setup lang="ts">
import { computed } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import { shortDayLabel } from '../../../../../../shared/calendar/dayLabel'
import type { Money } from '../../../../../../shared/money/money'
import { formatMoney } from '../../../../../../shared/money/moneyFormat'
import { useRecordWrites } from '../../../../../../shared/storage/presentation/useRecordWrites'
import AppCard from '../../../../../../shared/ui/AppCard.vue'
import DrillLink from '../../../../../../shared/ui/DrillLink.vue'
import FigureTable from '../../../../../../shared/ui/FigureTable.vue'
import MoneyText from '../../../../../../shared/ui/MoneyText.vue'
import NoteLine from '../../../../../../shared/ui/NoteLine.vue'
import ProposalRow from '../../../../../../shared/ui/ProposalRow.vue'
import { useFilters } from '../../../../filters/application/filterStore'
import { rowDrill } from '../../../../filters/domain/drillTarget'
import { useWorkbook } from '../../../../workbook/application/workbookStore'
import { displayNamesOf } from '../../../../workbook/domain/displayName'
import type { Transaction } from '../../../../workbook/domain/workbook'
import { dismissTripRow, fileTripRows, linkTripRow } from '../../application/tripRowWrites'
import type { Employee } from '../../domain/employees/employees'
import { hrDooWorkbook } from '../../domain/hrDooPart'
import { filedBySettlement, linkedRow, linkedRowId, tripRowSuggestions, tripRowsSplit } from '../../domain/trips/tripBankRows'
import type { TripRowLink, TripSplitRefusal } from '../../domain/trips/tripBankRows'
import type { TripFile } from '../../domain/trips/tripReading'
import type { TripSettlement } from '../../domain/trips/tripSettlement'
import { travellerName } from './tripsView'
import { words } from './words'

/** A trip's advance and payout rows: each linked row, or the payment Kuna found for a person to link, and the rows filed by the settlement. */
const props = defineProps<{
  file: TripFile
  settlement: TripSettlement
  employees: readonly Employee[]
}>()

const store = useWorkbook()
const writes = useRecordWrites(store)
const { drillLocation } = useFilters()

const said = words.bankRows
const books = computed(() => (store.state.workbook === null ? null : hrDooWorkbook(store.state.workbook)))
const trip = computed(() => props.file.trip)
const worked = computed(() => (props.settlement.kind === 'worked' ? props.settlement : null))
const name = computed(() => travellerName(trip.value.traveller, props.employees))

const suggestions = computed(() => {
  const workbook = books.value
  if (workbook === null) return []
  const traveller = props.employees.find((employee) => employee.slug === trip.value.traveller) ?? null
  return tripRowSuggestions(
    props.file,
    worked.value,
    traveller,
    workbook.trips.map((entry) => entry.trip),
    workbook.transactions,
  )
})

interface LinkLine {
  readonly link: TripRowLink
  readonly label: string
  readonly amount: Money | null
  readonly linked: Transaction | null
  readonly found: Transaction | null
  /** What the line says when no row is linked or found. */
  readonly empty: string
}

const lines = computed((): LinkLine[] => {
  const transactions = books.value?.transactions ?? []
  const lineOf = (link: TripRowLink, amount: Money | null, empty: string): LinkLine => ({
    link,
    label: said.links[link],
    amount,
    linked: linkedRow(linkedRowId(trip.value, link), transactions),
    found: suggestions.value.find((suggestion) => suggestion.link === link)?.row ?? null,
    empty,
  })
  const advance = trip.value.advance
  const payout = worked.value !== null && worked.value.payout > 0 ? worked.value.payout : null
  return [
    ...(advance !== null || trip.value.advanceRow !== null ? [lineOf('advance', advance, advance === null ? said.notLinked : said.notFound)] : []),
    ...(payout !== null || trip.value.payoutRow !== null ? [lineOf('payout', payout, trip.value.settledOn === null ? said.afterSettling : payout === null ? said.notLinked : said.notFound)] : []),
  ]
})

const split = computed(() => {
  const workbook = books.value
  if (workbook === null || worked.value === null || (trip.value.advanceRow === null && trip.value.payoutRow === null)) return null
  return tripRowsSplit(props.file, worked.value, workbook.transactions, workbook.categories)
})

const names = computed(() => (books.value === null ? null : displayNamesOf(books.value)))

const splitRows = computed(() => {
  const planned = split.value
  if (planned === null || 'refused' in planned || books.value === null) return []
  return planned.rows.map((row) => ({
    ...row,
    label: said.links[row.link],
    filed: filedBySettlement(row, books.value?.splits ?? []),
    parts: row.parts.map((part) => ({ ...part, name: part.payment === null ? said.returned : (names.value?.category(part.category) ?? part.category) })),
  }))
})
const allFiled = computed(() => splitRows.value.length > 0 && splitRows.value.every((row) => row.filed))

function refusalText(refusal: TripSplitRefusal): string {
  switch (refusal.kind) {
    case 'not-settled':
      return said.refusals.notSettled
    case 'nothing-linked':
      return said.refusals.nothingLinked
    case 'row-gone':
      return said.refusals.rowGone(said.links[refusal.link])
    case 'no-category':
      return said.refusals.noCategory(said.payments[refusal.payment])
    case 'advance-differs':
      return said.refusals.advanceDiffers(formatMoney(refusal.row), formatMoney(refusal.advance))
    case 'payout-differs':
      return said.refusals.payoutDiffers(formatMoney(refusal.row), formatMoney(refusal.payout))
    case 'no-category-for-return':
      return said.refusals.noCategoryForReturn
  }
}

const refusal = computed(() => {
  const planned = split.value
  return planned !== null && 'refused' in planned ? refusalText(planned.refused) : null
})

function rowLink(row: Transaction) {
  return drillLocation(rowDrill(row))
}

async function link(line: LinkLine, row: Transaction | null): Promise<void> {
  const before = trip.value
  await writes.write(row === null ? said.unlinked(line.label) : said.linked(line.label), (unit) => linkTripRow(unit, before, line.link, row?.rowId ?? null), {
    key: `${line.link}-link`,
    failedTitle: said.linkNotSaved,
  })
}

async function dismiss(line: LinkLine, row: Transaction): Promise<void> {
  const before = trip.value
  const { rowId } = row
  if (rowId === null) return
  await writes.write(said.dismissed, (unit) => dismissTripRow(unit, before, rowId), { key: `${line.link}-dismiss`, failedTitle: said.dismissNotSaved })
}

async function fileRows(): Promise<void> {
  const planned = split.value
  const current = store.state.records
  const workbook = store.state.workbook
  if (planned === null || 'refused' in planned || current === null || workbook === null) return
  await writes.write(said.fileSaved, (unit) => fileTripRows(unit, { records: current, workbook }, planned.rows, workbook.settings.reviewLabel), { key: 'file-rows', failedTitle: said.notSaved })
}
</script>

<template>
  <AppCard v-if="lines.length > 0" :title="said.title" :subtitle="said.subtitle" data-testid="trip-bank-rows">
    <ul class="divide-y divide-default">
      <ProposalRow v-for="line in lines" :key="line.link" :title="line.label" :caption="line.linked || line.found ? '' : line.empty" :data-link="line.link" data-testid="trip-bank-row">
        <template #details>
          <span v-if="line.linked" class="type-caption">
            <DrillLink :to="rowLink(line.linked)">{{ said.paidOn(shortDayLabel(line.linked.date), line.linked.counterparty || name) }}</DrillLink>
          </span>
          <span v-else-if="line.found" class="break-words type-caption text-toned" data-testid="trip-bank-row-found">{{
            said.found(shortDayLabel(line.found.date), line.found.counterparty || name)
          }}</span>
        </template>
        <template v-if="line.linked || line.found || line.amount !== null" #amount>
          <MoneyText v-if="line.linked" :cents="line.linked.amount" sign="magnitude" />
          <MoneyText v-else-if="line.found" :cents="line.found.amount" sign="magnitude" class="text-muted" />
          <MoneyText v-else-if="line.amount !== null" :cents="line.amount" sign="magnitude" class="text-muted" />
        </template>
        <UButton
          v-if="line.linked"
          class="self-start"
          :label="said.unlink"
          icon="i-lucide-unlink"
          color="neutral"
          variant="outline"
          size="sm"
          :aria-label="said.unlinkLabel(line.label)"
          :loading="writes.saving(`${line.link}-link`)"
          data-testid="trip-bank-row-unlink"
          @click="link(line, null)"
        />
        <div v-else-if="line.found" class="flex flex-wrap gap-2">
          <UButton
            :label="said.link"
            icon="i-lucide-link"
            color="neutral"
            variant="outline"
            size="sm"
            :aria-label="said.linkLabel(line.label, shortDayLabel(line.found.date))"
            :loading="writes.saving(`${line.link}-link`)"
            data-testid="trip-bank-row-link"
            @click="link(line, line.found)"
          />
          <UButton
            :label="said.dismiss"
            color="neutral"
            variant="outline"
            size="sm"
            :aria-label="said.dismissLabel(line.label, shortDayLabel(line.found.date))"
            :loading="writes.saving(`${line.link}-dismiss`)"
            data-testid="trip-bank-row-dismiss"
            @click="dismiss(line, line.found)"
          />
        </div>
      </ProposalRow>
    </ul>

    <div v-if="refusal || splitRows.length > 0" class="border-t border-default py-3" data-testid="trip-bank-split">
      <p v-if="refusal" class="px-4 text-sm text-toned sm:px-5" data-testid="trip-bank-split-refusal">{{ refusal }}</p>
      <template v-else>
        <div class="flex flex-col gap-0.5 px-4 sm:px-5">
          <span class="text-sm font-medium text-highlighted">{{ said.splitTitle }}</span>
          <span class="type-caption">{{ allFiled ? (splitRows.length > 1 ? said.filed : said.filedOne) : said.splitIntro }}</span>
          <UButton v-if="!allFiled" class="mt-1 self-start" :label="said.file" icon="i-lucide-split" size="sm" :loading="writes.saving('file-rows')" data-testid="trip-bank-file" @click="fileRows" />
        </div>
        <FigureTable class="mt-2 px-1 sm:px-2" :label="said.partsLabel">
          <thead>
            <tr>
              <th scope="col" class="text-start">{{ said.part }}</th>
              <th scope="col" class="text-end">{{ said.amount }}</th>
            </tr>
          </thead>
          <tbody v-for="row in splitRows" :key="row.link" :data-link="row.link">
            <tr class="group-row">
              <th scope="rowgroup" class="text-start">
                {{ row.label }}
                <NoteLine v-if="row.filed" as="span" tone="success" inline class="ms-2 font-normal">{{ said.filedRow }}</NoteLine>
              </th>
              <td class="text-end"><MoneyText :cents="row.row.amount" sign="magnitude" class="text-muted" /></td>
            </tr>
            <tr v-for="part in row.parts" :key="part.category">
              <th scope="row" class="cell-wraps text-start font-normal text-toned">{{ part.name }}</th>
              <td class="text-end"><MoneyText :cents="part.amount" sign="magnitude" /></td>
            </tr>
          </tbody>
        </FigureTable>
      </template>
    </div>
  </AppCard>
</template>
