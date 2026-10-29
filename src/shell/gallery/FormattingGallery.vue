<script setup lang="ts">
import { civilDate } from '../../shared/calendar/civilDate'
import { dayLabel, shortDayLabel } from '../../shared/calendar/dayLabel'
import { monthKey } from '../../shared/calendar/monthKey'
import { monthLabel, monthName, shortMonthLabel } from '../../shared/calendar/monthLabel'
import { currencyUnitName, formatCompactMoney, formatDays, formatDecimal, formatMoney, formatPercent, formatWholeMoney } from '../../shared/money/moneyFormat'
import AppCard from '../../shared/ui/AppCard.vue'
import DrillLink from '../../shared/ui/DrillLink.vue'
import MoneyText from '../../shared/ui/MoneyText.vue'
import GallerySection from './GallerySection.vue'

const SAMPLE_DAY = civilDate(2026, 11, 20)
const SAMPLE_MONTH = monthKey(2026, 10)
const galleryLink = { path: '/gallery', hash: '#formatting' }

/** Each formatter of shared/money and shared/calendar, with what it is for. */
const FORMATTED = [
  { name: 'formatMoney', use: 'An amount to the cent', text: formatMoney(1234567) },
  { name: 'formatMoney, negative', use: 'A true minus, so columns keep their width', text: formatMoney(-98765) },
  { name: 'formatMoney, always', use: 'A change, with its sign either way', text: formatMoney(31000, 'always') },
  { name: 'formatWholeMoney', use: 'Tiles and labels, where the cents are noise', text: formatWholeMoney(4821049) },
  { name: 'formatCompactMoney', use: 'Axis ticks and tight labels', text: `${formatCompactMoney(4821049)}, ${formatCompactMoney(90700)}` },
  { name: 'formatPercent', use: 'A share', text: `${formatPercent(0.284)}, ${formatPercent(-0.031, 'always')}` },
  { name: 'formatDecimal', use: 'A plain number with one decimal', text: formatDecimal(7.4) },
  { name: 'formatDays', use: 'A number of days', text: formatDays(12.5) },
  { name: 'currencyUnitName', use: 'One unit of the currency in running text', text: currencyUnitName() },
  { name: 'dayLabel', use: 'A day', text: dayLabel(SAMPLE_DAY) },
  { name: 'shortDayLabel', use: 'A day where the year is plain', text: shortDayLabel(SAMPLE_DAY) },
  { name: 'monthLabel', use: 'A month in tooltips and text', text: monthLabel(SAMPLE_MONTH) },
  { name: 'shortMonthLabel', use: 'A month on a tight axis', text: shortMonthLabel(SAMPLE_MONTH) },
  { name: 'monthName', use: 'A month where the year is plain', text: monthName(SAMPLE_MONTH) },
] as const

const MONEY_TEXTS = [
  { label: 'Plain', cents: 1234567, props: {} },
  { label: 'Money out, as a flow', cents: -98765, props: { tone: 'flow' } },
  { label: 'Change, sign always', cents: 31000, props: { sign: 'always', tone: 'flow' } },
  { label: 'A loss, as an outcome', cents: -31000, props: { tone: 'outcome' } },
  { label: 'Cost as magnitude', cents: -412050, props: { sign: 'magnitude' } },
  { label: 'Whole euros', cents: 4821049, props: { precision: 'whole' } },
  { label: 'Compact', cents: 4821049, props: { precision: 'compact' } },
] as const
</script>

<template>
  <GallerySection
    id="formatting"
    title="Formatting"
    description="Money, shares, days and months in the language and number format on screen. Add ?lang=hr to the address for Croatian. Only these modules format figures."
  >
    <AppCard as="div" class="p-5">
      <dl class="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
        <div v-for="entry in FORMATTED" :key="entry.name" class="flex items-baseline justify-between gap-4">
          <dt class="min-w-0">
            <span class="identifier block text-toned">{{ entry.name }}</span>
            <span class="block type-caption">{{ entry.use }}</span>
          </dt>
          <dd class="figure shrink-0 text-highlighted">{{ entry.text }}</dd>
        </div>
      </dl>
    </AppCard>
  </GallerySection>

  <GallerySection id="money" title="MoneyText and DrillLink" description="Cents in, the sign and the tone by what the amount is. Every figure that has rows behind it opens them.">
    <AppCard as="div" class="p-5">
      <div class="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
        <p v-for="entry in MONEY_TEXTS" :key="entry.label" class="flex justify-between gap-4">
          <span class="text-muted">{{ entry.label }}</span
          ><MoneyText :cents="entry.cents" v-bind="entry.props" />
        </p>
        <p class="flex justify-between gap-4">
          <span class="text-muted">Drill link</span>
          <DrillLink :to="galleryLink" label="Open the 14 travel transactions"><MoneyText :cents="-391000" sign="magnitude" /></DrillLink>
        </p>
      </div>
    </AppCard>
    <p class="max-w-[65ch] text-sm text-default">
      Travel cost <DrillLink :to="galleryLink" in-prose><MoneyText :cents="391000" /></DrillLink> over the last 12 months, down from
      <DrillLink :to="galleryLink" in-prose><MoneyText :cents="512000" /></DrillLink>. Every figure opens the rows behind it.
    </p>
  </GallerySection>
</template>
