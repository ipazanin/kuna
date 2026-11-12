<script setup lang="ts">
import { computed } from 'vue'

import { surtaxChargedBy, taxWithSurtax } from '../domain/citySurtax'
import type { ForeignIncomeYear } from '../domain/foreignIncome'
import { JOPPD_CODES, TAX_RULES } from '../domain/taxRules'
import type { TaxRule } from '../domain/taxRules'
import type { CapitalGainsYear } from '../domain/taxYear'
import SurtaxCityCard from './SurtaxCityCard.vue'
import { taxLink } from './taxLinks'
import { payerOf } from './taxText'
import { words } from './words'
import { civilDate } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import { subtractMoney, ZERO } from '../../../../shared/money/money'
import { percentText } from '../../../../shared/money/percent'
import { plural } from '../../../../shared/text/translation'
import AppCard from '../../../../shared/ui/AppCard.vue'
import DashboardGrid from '../../../../shared/ui/DashboardGrid.vue'
import FactGrid from '../../../../shared/ui/FactGrid.vue'
import type { Fact } from '../../../../shared/ui/FactGrid.vue'
import FigureTable from '../../../../shared/ui/FigureTable.vue'
import KpiTile from '../../../../shared/ui/KpiTile.vue'
import NoteLine from '../../../../shared/ui/NoteLine.vue'

/** The year's capital gains tax in four tiles, what to type into the JOPPD, the year's deadlines and the rules the figures rest on. */
const props = defineProps<{
  gains: CapitalGainsYear
  foreign: ForeignIncomeYear
  today: CivilDate
}>()

const text = words
const marks = text.marks
const hasSales = computed(() => props.gains.sales.length > 0)
const lossesBeyond = computed(() => subtractMoney(props.gains.losses, props.gains.lossesOffset))
const leftOut = computed(() => props.gains.leftOut + props.foreign.leftOut)
const rulesYear = computed(() => (props.gains.rules.ownRow ? null : props.gains.rules.rules.year))
const surtax = computed(() => props.gains.surtax)
const surtaxCity = computed(() => surtaxChargedBy(surtax.value))
const taxLabel = computed(() => {
  if (surtax.value.kind === 'no-city') return text.tiles.taxBeforeSurtax
  return surtaxCity.value === null ? text.tiles.taxToPay : text.tiles.taxAndSurtax
})
const taxCaption = computed(() => {
  const { gains } = props
  if (gains.due === null) {
    return text.tiles.noJoppd
  }
  const day = dayLabel(gains.due)
  const owed = surtax.value
  if (owed.kind === 'none') return text.tiles.taxToPayCaption(day)
  if (owed.kind === 'no-city') return text.tiles.taxBeforeSurtaxCaption(gains.rules.rules.gainsRate, day)
  return surtaxCity.value === null ? text.tiles.noSurtaxCaption(day) : text.tiles.taxAndSurtaxCaption(formatMoney(gains.tax), formatMoney(owed.amount), day)
})

/** Field 14.2: nothing in a year without surtax, the city's surtax once it is known, and a pointer to the city card until then. */
const surtaxFact = computed((): Fact => {
  const owed = surtax.value
  const field = (value: string, caption: string): Fact => ({ label: text.joppd.fields.surtax, value, caption, lang: 'hr' })
  if (owed.kind === 'none') return field(formatMoney(ZERO), marks.settled)
  if (owed.kind === 'no-city') return field(text.joppd.cityNotChosen, text.joppd.chooseCity)
  const city = surtaxCity.value
  return field(formatMoney(owed.amount), city === null ? text.joppd.noSurtax : text.joppd.surtaxAt(percentText(owed.rate), city.name))
})

/** The year's JOPPD: its head, the line for lots under two years when it has one, and the code-02 line when it has tax-free gains. */
const joppdFacts = computed((): Fact[] => {
  const { gains } = props
  const field = (label: string, value: string, caption: string): Fact => ({ label, value, caption, lang: 'hr' })
  const fields = text.joppd.fields
  const period = text.joppd.period(dayLabel(civilDate(gains.year, 1, 1)), dayLabel(civilDate(gains.year, 12, 31)))
  const head = [field(fields.reportMark, gains.reportMark, marks.reading), field(fields.typeAndSubmitter, `${JOPPD_CODES.gainsReportType}, ${JOPPD_CODES.submitter}`, marks.reading)]
  const gainsLine = gains.gainsLine
    ? [
        field(fields.recipient, JOPPD_CODES.gains.recipient, marks.unconfirmed),
        field(fields.receipt, JOPPD_CODES.gains.receipt, marks.settled),
        field(fields.period, period, marks.reading),
        field(fields.receipts, formatMoney(gains.taxableGains), marks.reading),
        field(fields.expenses, formatMoney(gains.lossesOffset), marks.reading),
        field(fields.base, formatMoney(gains.base), marks.reading),
        field(fields.tax, formatMoney(gains.tax), text.joppd.rateSettled),
        surtaxFact.value,
        {
          none: field(fields.payment, `1, ${formatMoney(gains.payout)}`, text.joppd.payoutSettled),
          'no-city': field(fields.payment, text.joppd.paymentWithSurtax(formatMoney(gains.payout)), marks.reading),
          due: field(fields.payment, `1, ${formatMoney(gains.payout)}`, marks.reading),
        }[surtax.value.kind],
      ]
    : []
  const taxFreeLine =
    gains.taxFreeGains > 0
      ? [
          field(
            fields.taxFreeLine,
            `${JOPPD_CODES.taxFree.nonTaxable}, ${formatMoney(gains.taxFreeGains)}, ${JOPPD_CODES.taxFree.recipientAndReceipt}`,
            gains.endsInLoss ? marks.unconfirmed : marks.settled,
          ),
        ]
      : []
  return [...head, ...gainsLine, ...taxFreeLine]
})

/** The year's own dates, then each payment whose 30 days still run on the day. */
const deadlineFacts = computed((): Fact[] => {
  const { gains, foreign, today } = props
  const dates: Fact[] = []
  if (gains.due !== null) {
    dates.push({ label: text.deadlines.joppd, value: dayLabel(gains.due), caption: gains.endsInLoss ? text.deadlines.joppdTaxFreeOnly : marks.settled })
  }
  if (foreign.filesInoDoh) {
    const bookedNet = foreign.payments.filter((entry) => entry.route === 'booked-net').length
    const fileBy = text.deadlines.inoDohCaption(dayLabel(foreign.inoDohDue.fileBy))
    const caption = bookedNet > 0 ? `${fileBy} ${plural(text.deadlines.bookedNet(bookedNet), bookedNet)}` : fileBy
    dates.push({ label: text.deadlines.inoDoh, value: dayLabel(foreign.inoDohDue.due), caption, lang: 'hr' })
  }
  if (foreign.inoIzjavaDue !== null) {
    dates.push({ label: text.deadlines.inoIzjava, value: dayLabel(foreign.inoIzjavaDue), caption: text.deadlines.inoIzjavaCaption, lang: 'hr' })
  }
  const running = foreign.payments.flatMap((entry) => (entry.due !== null && entry.due >= today ? [{ entry, due: entry.due }] : []))
  return [
    ...dates,
    ...running.map(({ entry, due }) => ({
      label: payerOf(entry),
      value: dayLabel(due),
      caption: entry.route === 'referral' ? text.deadlines.referral(dayLabel(entry.payment.date)) : text.deadlines.payment(dayLabel(entry.payment.date)),
    })),
  ]
})

const rules = computed(() => (Object.keys(TAX_RULES) as TaxRule[]).map((key) => ({ key, mark: TAX_RULES[key].mark, ...text.rules.list[key] })))
const readings = computed(() => rules.value.filter((rule) => rule.mark !== 'settled').length)
</script>

<template>
  <div class="flex flex-col gap-6">
    <NoteLine v-if="gains.estimated || foreign.estimated" size="body" tone="warning" data-testid="tax-estimated">{{ text.estimated }}</NoteLine>
    <NoteLine v-if="leftOut > 0" size="body" tone="warning" data-testid="tax-left-out">{{ plural(text.leftOut(leftOut), leftOut) }}</NoteLine>
    <p v-if="rulesYear !== null" class="type-caption" data-testid="tax-other-rules">{{ text.otherRules(gains.year, rulesYear) }}</p>
    <template v-if="hasSales">
      <DashboardGrid layout="tiles" data-testid="tax-tiles">
        <KpiTile :label="taxLabel" :value="formatMoney(taxWithSurtax(gains.tax, gains.surtax))" :to="null" :caption="taxCaption" icon="i-lucide-landmark" />
        <KpiTile :label="text.tiles.taxableGains" :value="formatMoney(gains.taxableGains)" :to="taxLink(gains.year, 'sales')" :caption="text.tiles.taxableGainsCaption" />
        <KpiTile
          :label="text.tiles.lossesOffset"
          :value="formatMoney(gains.lossesOffset)"
          :to="taxLink(gains.year, 'sales')"
          :caption="lossesBeyond > 0 ? text.tiles.lossesBeyond(formatMoney(lossesBeyond)) : text.tiles.lossesOffsetCaption"
        />
        <KpiTile :label="text.tiles.taxFreeGains" :value="formatMoney(gains.taxFreeGains)" :to="taxLink(gains.year, 'sales')" :caption="text.tiles.taxFreeGainsCaption" />
      </DashboardGrid>
      <p v-if="gains.oldLosses > 0" class="type-caption" data-testid="tax-old-losses">{{ text.oldLosses(formatMoney(gains.oldLosses)) }}</p>
      <p v-if="gains.due === null" class="type-caption" data-testid="tax-no-joppd">{{ gains.endsInLoss ? text.noJoppd.lossYear : text.noJoppd.noGains }}</p>
    </template>
    <SurtaxCityCard v-if="gains.gainsLine && surtax.kind !== 'none'" :surtax="surtax" />
    <DashboardGrid layout="cards">
      <AppCard v-if="gains.due !== null" :title="text.joppd.title" :subtitle="text.joppd.subtitle(gains.year)" data-testid="tax-joppd">
        <div class="px-4 pt-3 pb-4 sm:px-5">
          <FactGrid :facts="joppdFacts" />
        </div>
      </AppCard>
      <AppCard :title="text.deadlines.title" data-testid="tax-deadlines">
        <div class="px-4 pt-3 pb-4 sm:px-5">
          <FactGrid v-if="deadlineFacts.length > 0" :facts="deadlineFacts" />
          <p v-else class="type-body">{{ text.deadlines.none }}</p>
        </div>
      </AppCard>
    </DashboardGrid>
    <AppCard
      :title="text.rules.title"
      :subtitle="text.rules.subtitle"
      collapse-id="investments.tax.rules"
      :summary="plural(text.rules.summary(rules.length, readings), rules.length)"
      start-collapsed
      data-testid="tax-rules"
    >
      <FigureTable class="mt-2 mb-2 px-1 sm:px-2" :label="text.rules.title">
        <thead>
          <tr>
            <th scope="col" class="text-start">{{ text.rules.rule }}</th>
            <th scope="col" class="text-start">{{ text.rules.mark }}</th>
            <th scope="col" class="hidden text-start @lg:table-cell">{{ text.rules.source }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="rule in rules" :key="rule.key" data-testid="tax-rule">
            <th scope="row" class="cell-wraps text-start font-normal">
              {{ rule.rule }}
              <span class="block type-caption @lg:hidden">{{ rule.source }}</span>
            </th>
            <td class="text-start" :class="{ 'text-warning': rule.mark === 'unconfirmed' }">{{ marks[rule.mark] }}</td>
            <td class="cell-wraps hidden text-start text-toned @lg:table-cell">{{ rule.source }}</td>
          </tr>
        </tbody>
      </FigureTable>
    </AppCard>
  </div>
</template>
