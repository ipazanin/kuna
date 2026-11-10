<script setup lang="ts">
import { computed, ref } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'

import { dayLabel, shortDayLabel } from '../../../../../../shared/calendar/dayLabel'
import { formatCount } from '../../../../../../shared/money/moneyFormat'
import { countryName } from '../../../../../../shared/text/countryName'
import { plural } from '../../../../../../shared/text/translation'
import { useRates } from '../../../../../../shared/rates/application/pageRates'
import { everydayRates } from '../../../../../../shared/rates/domain/ratesState'
import AppCard from '../../../../../../shared/ui/AppCard.vue'
import EmptyState from '../../../../../../shared/ui/EmptyState.vue'
import FactGrid from '../../../../../../shared/ui/FactGrid.vue'
import type { Fact } from '../../../../../../shared/ui/FactGrid.vue'
import FigureTable from '../../../../../../shared/ui/FigureTable.vue'
import MoneyText from '../../../../../../shared/ui/MoneyText.vue'
import type { Employee } from '../../domain/employees/employees'
import { HOME_COUNTRY, legKilometres } from '../../domain/trips/trip'
import type { TripCost, TripLeg } from '../../domain/trips/trip'
import { clockText } from '../../domain/trips/tripMoment'
import type { TripMoment } from '../../domain/trips/tripMoment'
import type { TripFile } from '../../domain/trips/tripReading'
import type { TracedFigure } from '../../ruleset/tracedFigure'
import BuildUpButton from '../BuildUpButton.vue'
import FigureDialog from '../FigureDialog.vue'
import { figureDetail } from '../tracedFigureView'
import type { AskableDetail } from '../tracedFigureView'
import SettlementDialog from './SettlementDialog.vue'
import { perDiemLineFigure, settlementBuildUps } from './tripBuildUps'
import TripCostDialog from './TripCostDialog.vue'
import TripLegDialog from './TripLegDialog.vue'
import { durationText, settlementOf, travellerName } from './tripsView'
import { words } from './words'

/** A trip's settlement: its times and report, the per diems line by line, what it pays the traveller, and its legs and costs. */
const props = defineProps<{
  file: TripFile
  employees: readonly Employee[]
}>()

const rates = useRates()
const trip = computed(() => props.file.trip)
const settlement = computed(() => settlementOf(props.file, everydayRates(rates.value)))
const buildUps = computed(() => (settlement.value.kind === 'worked' ? settlementBuildUps(props.file, settlement.value) : null))
const byAir = computed(() => trip.value.transport === 'plane')

function momentText(moment: TripMoment | null): string {
  return moment === null ? words.order.none : `${dayLabel(moment.day)} ${clockText(moment.minute)}`
}

const facts = computed((): Fact[] => {
  const { left, returned, abroad, odometer, settledOn } = trip.value
  return [
    { label: words.settlement.left, value: momentText(left) },
    { label: words.settlement.returned, value: momentText(returned) },
    ...(trip.value.country === HOME_COUNTRY
      ? []
      : [
          { label: byAir.value ? words.settlement.takeOff : words.settlement.borderOut, value: momentText(abroad?.out ?? null) },
          { label: byAir.value ? words.settlement.landing : words.settlement.borderIn, value: momentText(abroad?.back ?? null) },
        ]),
    ...(trip.value.transport === 'private-car'
      ? [{ label: words.settlement.odometer, value: odometer === null ? words.order.none : words.settlement.odometerRange(formatCount(odometer.start), formatCount(odometer.end)) }]
      : []),
    { label: words.settlement.settledOn, value: settledOn === null ? words.settlement.notYet : dayLabel(settledOn) },
  ]
})

const tellsApart = computed(() => [trip.value.number, travellerName(trip.value.traveller, props.employees)])
const subtitle = computed(() => words.trip.title(trip.value.number))

function detailOf(figure: TracedFigure): AskableDetail {
  return figureDetail(figure, subtitle.value, tellsApart.value, () => null, true)
}

const opened = ref<AskableDetail | null>(null)
const figureOpen = computed({
  get: () => opened.value !== null,
  set: (open: boolean) => {
    if (!open) opened.value = null
  },
})

const perDiemLines = computed(() => {
  const worked = settlement.value
  if (worked.kind !== 'worked') return []
  return worked.perDiemLines.map((line, index) => {
    const figure = perDiemLineFigure(line, index)
    return {
      key: index,
      label: figure.label,
      place: line.from === null ? null : countryName(line.country),
      from: line.from === null ? words.order.none : `${shortDayLabel(line.from.day)} ${clockText(line.from.minute)}`,
      hours: durationText(line.minutes),
      share: words.perDiems.shares[line.share],
      /** After the country on a phone, or on its own for the time at home around a trip abroad. */
      captionShare: line.from === null ? words.perDiems.shares[line.share] : `, ${words.perDiems.shareInCaption[line.share]}`,
      meals: line.meals,
      mealsPaid: line.meals === 0 ? null : words.perDiems.mealsPaid(line.meals),
      figure,
    }
  })
})

/** What the traveller is owed, line by line, and the subtotal. The advance is deducted below it, when the order paid one. */
const owedParts = computed(() => {
  const figures = buildUps.value
  if (figures === null) return []
  return [figures.perDiems, ...(figures.kilometres === null ? [] : [figures.kilometres]), figures.travellerCosts]
})

/** What the trip comes to at the foot of the table: the payout once an advance is taken off, else what the traveller is owed. */
const due = computed(() => (buildUps.value === null ? null : trip.value.advance === null ? buildUps.value.owed : buildUps.value.payout))

const legKm = computed(() => legKilometres(props.file.legs))
const legsSummary = computed(() => plural(words.legs.summary(props.file.legs.length, formatCount(legKm.value)), props.file.legs.length))
const costsSummary = computed(() => plural(words.costs.summary(props.file.costs.length), props.file.costs.length))

const settlementOpen = ref(false)
const legOpen = ref(false)
const editingLeg = ref<TripLeg | null>(null)
const costOpen = ref(false)
const editingCost = ref<TripCost | null>(null)

function openLeg(leg: TripLeg | null): void {
  editingLeg.value = leg
  legOpen.value = true
}

function openCost(cost: TripCost | null): void {
  editingCost.value = cost
  costOpen.value = true
}

function route(leg: TripLeg): string {
  return [leg.from, leg.to].filter((place) => place !== '').join(' – ')
}
</script>

<template>
  <div class="flex flex-col gap-6" data-testid="trip-settlement">
    <UAlert v-if="settlement.kind === 'waiting'" icon="i-lucide-clock" color="info" variant="subtle" :title="words.gaps.title" data-testid="trip-gaps">
      <template #description>
        <ul class="list-disc ps-4">
          <li v-for="gap in settlement.gaps" :key="gap">{{ words.gaps[gap] }}</li>
        </ul>
      </template>
    </UAlert>

    <AppCard :title="words.settlement.title" data-testid="trip-settlement-facts">
      <template #actions>
        <UButton :label="words.settlement.change" icon="i-lucide-pencil" color="neutral" variant="outline" size="sm" data-testid="trip-settlement-edit" @click="settlementOpen = true" />
      </template>
      <div class="px-4 pt-1 pb-4 sm:px-5">
        <FactGrid :facts="facts" />
        <dl v-if="trip.report !== ''" class="mt-4">
          <dt class="type-caption">{{ words.settlement.report }}</dt>
          <dd class="mt-0.5 type-body">{{ trip.report }}</dd>
        </dl>
      </div>
    </AppCard>

    <AppCard v-if="buildUps" :title="words.totals.title" data-testid="trip-totals">
      <FigureTable class="px-1 pb-2 sm:px-2" :label="words.totals.title">
        <tbody>
          <tr v-for="figure in owedParts" :key="figure.label">
            <th scope="row" class="cell-wraps text-start font-normal text-toned">{{ figure.label }}</th>
            <td class="text-end"><BuildUpButton :cents="figure.amount" :label="figure.label" @open="opened = detailOf(figure)" /></td>
          </tr>
          <template v-if="trip.advance !== null">
            <tr class="total-row">
              <th scope="row" class="cell-wraps text-start font-medium text-highlighted">{{ buildUps.owed.label }}</th>
              <td class="text-end"><BuildUpButton :cents="buildUps.owed.amount" :label="buildUps.owed.label" class="font-medium" @open="opened = detailOf(buildUps.owed)" /></td>
            </tr>
            <tr>
              <th scope="row" class="cell-wraps text-start font-normal text-toned">{{ words.totals.lessAdvance }}</th>
              <td class="text-end"><BuildUpButton :cents="buildUps.advance.amount" :label="words.totals.lessAdvance" @open="opened = detailOf(buildUps.advance)" /></td>
            </tr>
          </template>
        </tbody>
        <tfoot v-if="due">
          <tr data-testid="trip-payout">
            <th scope="row" class="text-start">{{ due.label }}</th>
            <td class="text-end"><BuildUpButton :cents="due.amount" :label="due.label" @open="opened = detailOf(due)" /></td>
          </tr>
        </tfoot>
      </FigureTable>
      <p v-if="buildUps.companyCosts.steps.length > 0" class="flex items-baseline justify-between gap-3 border-t border-default px-4 py-3 text-sm sm:px-5" data-testid="trip-company-costs">
        <span class="text-muted">{{ words.totals.companyPaid }}</span>
        <BuildUpButton :cents="buildUps.companyCosts.amount" :label="words.totals.companyPaid" class="text-toned" @open="opened = detailOf(buildUps.companyCosts)" />
      </p>
    </AppCard>

    <AppCard v-if="perDiemLines.length > 0" :title="words.perDiems.title" :subtitle="words.perDiems.subtitle" collapse-id="trips.per-diems" data-testid="trip-per-diems">
      <FigureTable class="px-1 pb-2 sm:px-2" :label="words.perDiems.title">
        <thead>
          <tr>
            <th scope="col" class="text-start">{{ words.perDiems.line }}</th>
            <th scope="col" class="hidden text-start @xl:table-cell">{{ words.perDiems.from }}</th>
            <th scope="col" class="text-end">{{ words.perDiems.hours }}</th>
            <th scope="col" class="hidden text-start @md:table-cell">{{ words.perDiems.share }}</th>
            <th scope="col" class="hidden text-end @lg:table-cell">{{ words.perDiems.meals }}</th>
            <th scope="col" class="text-end">{{ words.perDiems.amount }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="line in perDiemLines" :key="line.key">
            <th scope="row" class="cell-wraps text-start font-normal">
              <span class="text-highlighted">{{ line.label }}</span>
              <span class="block type-caption"
                >{{ line.place }}<span class="@md:hidden">{{ line.captionShare }}</span
                ><span v-if="line.mealsPaid" class="@lg:hidden">, {{ line.mealsPaid }}</span></span
              >
            </th>
            <td class="hidden text-toned @xl:table-cell">{{ line.from }}</td>
            <td class="figure text-end text-toned">{{ line.hours }}</td>
            <td class="hidden text-toned @md:table-cell">{{ line.share }}</td>
            <td class="figure hidden text-end text-toned @lg:table-cell">{{ line.meals }}</td>
            <td class="text-end"><BuildUpButton :cents="line.figure.amount" :label="line.label" @open="opened = detailOf(line.figure)" /></td>
          </tr>
        </tbody>
        <tfoot v-if="buildUps">
          <tr>
            <th scope="row" class="text-start">{{ words.perDiems.total }}</th>
            <td class="hidden @xl:table-cell" />
            <td />
            <td class="hidden @md:table-cell" />
            <td class="hidden @lg:table-cell" />
            <td class="text-end"><MoneyText :cents="buildUps.perDiems.amount" /></td>
          </tr>
        </tfoot>
      </FigureTable>
    </AppCard>

    <template v-if="trip.transport === 'private-car'">
      <EmptyState
        v-if="file.legs.length === 0"
        icon="i-lucide-route"
        :title="words.legs.title"
        :description="words.legs.empty"
        :actions="[{ label: words.legs.add, icon: 'i-lucide-plus', color: 'neutral', variant: 'outline', onClick: () => openLeg(null) }]"
        data-testid="trip-legs"
      />
      <AppCard v-else :title="words.legs.title" :summary="legsSummary" collapse-id="trips.legs" data-testid="trip-legs">
        <template #actions>
          <UButton :label="words.legs.add" icon="i-lucide-plus" color="neutral" variant="outline" size="sm" data-testid="trip-leg-add" @click="openLeg(null)" />
        </template>
        <FigureTable class="px-1 pb-2 sm:px-2" :label="words.legs.title">
          <thead>
            <tr>
              <th scope="col" class="text-start">{{ words.legs.date }}</th>
              <th scope="col" class="text-start">{{ words.legs.route }}</th>
              <th scope="col" class="text-end">{{ words.legs.km }}</th>
              <th scope="col" class="w-12">
                <span class="sr-only">{{ words.order.change }}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="leg in file.legs" :key="leg.id" data-testid="trip-leg">
              <td class="text-toned">{{ shortDayLabel(leg.date) }}</td>
              <td class="cell-wraps text-highlighted">{{ route(leg) }}</td>
              <td class="figure text-end">{{ formatCount(leg.km) }}</td>
              <td class="text-end">
                <UButton icon="i-lucide-pencil" color="neutral" variant="ghost" size="sm" square :aria-label="words.legs.change(route(leg))" data-testid="trip-leg-edit" @click="openLeg(leg)" />
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" class="text-start" colspan="2">{{ words.legs.total }}</th>
              <td class="figure text-end">{{ formatCount(legKm) }}</td>
              <td />
            </tr>
          </tfoot>
        </FigureTable>
      </AppCard>
    </template>

    <EmptyState
      v-if="file.costs.length === 0"
      icon="i-lucide-receipt"
      :title="words.costs.title"
      :description="words.costs.empty"
      :actions="[{ label: words.costs.add, icon: 'i-lucide-plus', color: 'neutral', variant: 'outline', onClick: () => openCost(null) }]"
      data-testid="trip-costs"
    />
    <AppCard v-else :title="words.costs.title" :summary="costsSummary" collapse-id="trips.costs" data-testid="trip-costs">
      <template #actions>
        <UButton :label="words.costs.add" icon="i-lucide-plus" color="neutral" variant="outline" size="sm" data-testid="trip-cost-add" @click="openCost(null)" />
      </template>
      <FigureTable class="px-1 pb-2 sm:px-2" :label="words.costs.title">
        <thead>
          <tr>
            <th scope="col" class="text-start">{{ words.costs.kind }}</th>
            <th scope="col" class="hidden text-start @md:table-cell">{{ words.costs.date }}</th>
            <th scope="col" class="hidden text-start @lg:table-cell">{{ words.costs.paidBy }}</th>
            <th scope="col" class="text-end">{{ words.costs.amount }}</th>
            <th scope="col" class="w-12">
              <span class="sr-only">{{ words.order.change }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="cost in file.costs" :key="cost.id" data-testid="trip-cost">
            <th scope="row" class="cell-wraps text-start font-normal">
              <span class="text-highlighted">{{ cost.description || words.costKinds[cost.kind] }}</span>
              <span class="block type-caption"
                >{{ words.costKinds[cost.kind] }}<span class="@md:hidden">, {{ shortDayLabel(cost.date) }}</span
                ><span class="@lg:hidden">, {{ words.payers[cost.paidBy] }}</span></span
              >
            </th>
            <td class="hidden text-toned @md:table-cell">{{ shortDayLabel(cost.date) }}</td>
            <td class="hidden text-toned @lg:table-cell">{{ words.payers[cost.paidBy] }}</td>
            <td class="text-end"><MoneyText :cents="cost.amount" /></td>
            <td class="text-end">
              <UButton
                icon="i-lucide-pencil"
                color="neutral"
                variant="ghost"
                size="sm"
                square
                :aria-label="words.costs.change(cost.description || words.costKinds[cost.kind])"
                data-testid="trip-cost-edit"
                @click="openCost(cost)"
              />
            </td>
          </tr>
        </tbody>
      </FigureTable>
    </AppCard>

    <SettlementDialog v-model:open="settlementOpen" :trip="trip" />
    <TripLegDialog v-model:open="legOpen" :trip="trip" :editing="editingLeg" />
    <TripCostDialog v-model:open="costOpen" :trip="trip" :editing="editingCost" />
    <FigureDialog v-model:open="figureOpen" :detail="opened" />
  </div>
</template>
