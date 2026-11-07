<script setup lang="ts">
import { computed } from 'vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import type { ForeignIncomeYear } from '../domain/foreignIncome'
import { JOPPD_CODES, TAX_RULES } from '../domain/taxRules'
import type { TaxRule } from '../domain/taxRules'
import type { CapitalGainsYear } from '../domain/taxYear'
import { taxLink } from './taxLinks'
import { payerOf } from './taxText'
import { words } from './words'
import { civilDate } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import { subtractMoney, ZERO } from '../../../../shared/money/money'
import { plural } from '../../../../shared/text/translation'
import AppCard from '../../../../shared/ui/AppCard.vue'
import DashboardGrid from '../../../../shared/ui/DashboardGrid.vue'
import FactGrid from '../../../../shared/ui/FactGrid.vue'
import type { Fact } from '../../../../shared/ui/FactGrid.vue'
import FigureTable from '../../../../shared/ui/FigureTable.vue'
import KpiTile from '../../../../shared/ui/KpiTile.vue'

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
const surtax = computed(() => props.gains.rules.rules.surtax)
const taxCaption = computed(() => {
  const { gains } = props
  if (gains.due === null) {
    return text.tiles.noJoppd
  }
  return surtax.value ? text.tiles.taxBeforeSurtaxCaption(gains.rules.rules.gainsRate, dayLabel(gains.due)) : text.tiles.taxToPayCaption(dayLabel(gains.due))
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
        field(fields.surtax, surtax.value ? text.joppd.citySurtax : formatMoney(ZERO), marks.settled),
        surtax.value
          ? field(fields.payment, text.joppd.paymentWithSurtax(formatMoney(gains.payout)), marks.reading)
          : field(fields.payment, `1, ${formatMoney(gains.payout)}`, text.joppd.payoutSettled),
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
    <p v-if="gains.estimated || foreign.estimated" class="flex items-start gap-2 type-body text-warning" data-testid="tax-estimated">
      <UIcon name="i-lucide-triangle-alert" class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{{ text.estimated }}</span>
    </p>
    <p v-if="leftOut > 0" class="flex items-start gap-2 type-body text-warning" data-testid="tax-left-out">
      <UIcon name="i-lucide-triangle-alert" class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{{ plural(text.leftOut(leftOut), leftOut) }}</span>
    </p>
    <p v-if="rulesYear !== null" class="type-caption" data-testid="tax-other-rules">{{ text.otherRules(gains.year, rulesYear) }}</p>
    <template v-if="hasSales">
      <DashboardGrid layout="tiles" data-testid="tax-tiles">
        <KpiTile :label="surtax ? text.tiles.taxBeforeSurtax : text.tiles.taxToPay" :value="formatMoney(gains.tax)" :to="null" :caption="taxCaption" icon="i-lucide-landmark" />
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
