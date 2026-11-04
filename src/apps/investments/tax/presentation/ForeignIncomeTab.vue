<script setup lang="ts">
import { computed } from 'vue'

import type { ForeignIncomeYear, ForeignPayment } from '../domain/foreignIncome'
import { payerOf } from './taxText'
import { words } from './words'
import { QUANTITY_PLACES } from '../../holdings/presentation/holdingText'
import { words as recordWords } from '../../workbook/domain/words'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { DECIMAL_ZERO } from '../../../../shared/money/decimal'
import { formatCurrencyAmount, formatMoney, formatQuantity } from '../../../../shared/money/moneyFormat'
import { countryName } from '../../../../shared/text/countryName'
import { plural } from '../../../../shared/text/translation'
import AppCard from '../../../../shared/ui/AppCard.vue'
import FactGrid from '../../../../shared/ui/FactGrid.vue'
import type { Fact } from '../../../../shared/ui/FactGrid.vue'
import FigureTable from '../../../../shared/ui/FigureTable.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'

/** Each payment of the year by the country of its ISIN, in euros at HNB's rate of its day, with its Croatian tax, the credit for tax withheld abroad and how it is settled. */
const props = defineProps<{
  foreign: ForeignIncomeYear
}>()

const text = words.foreign
const rules = computed(() => props.foreign.rules.rules)

const totals = computed((): Fact[] => [
  { label: text.inoDoh, value: formatMoney(props.foreign.inoDoh.leftToPay), caption: text.inoDohCaption(formatMoney(props.foreign.inoDoh.credit), formatMoney(props.foreign.inoDoh.lost)) },
  { label: text.joppd, value: formatMoney(props.foreign.joppd.leftToPay), caption: text.joppdCaption },
])

function routeOf(entry: ForeignPayment): string {
  switch (entry.route) {
    case 'ino-doh':
      return text.routes.inoDoh(dayLabel(props.foreign.inoDohDue.due), dayLabel(props.foreign.inoDohDue.fileBy))
    case 'joppd':
      return entry.due === null ? '' : text.routes.joppd(dayLabel(entry.due))
    case 'referral':
      return entry.due === null ? '' : text.routes.referral(dayLabel(entry.due))
    case 'booked-net':
      return text.routes.bookedNet
    case 'none':
      return text.routes.none
  }
}

/** What the row says beside its route: its JOPPD codes, what a referral credit owes, its rate standing in for one not out yet, or that it has none. */
function noteOf(entry: ForeignPayment): string {
  const notes: string[] = []
  if (entry.codes !== null) notes.push(text.codes(entry.codes.recipient, entry.codes.receipt))
  if (entry.route === 'referral') notes.push(text.referralTax)
  if (entry.rate.kind === 'missing') notes.push(text.noRate(dayLabel(entry.payment.date)))
  if (entry.rate.kind === 'hnb' && entry.rate.rate.estimatedFrom !== null) notes.push(text.rateNotOut(dayLabel(entry.rate.rate.estimatedFrom)))
  if (entry.route === 'none' && entry.payment.note !== '') notes.push(entry.payment.note)
  return notes.join('. ')
}

function rateOf(entry: ForeignPayment): string {
  return entry.rate.kind === 'hnb' ? formatQuantity(entry.rate.rate.unitsPerEuro, QUANTITY_PLACES) : ''
}
</script>

<template>
  <AppCard
    :title="text.title"
    :subtitle="text.subtitle(foreign.year)"
    collapse-id="investments.tax.foreign"
    :summary="plural(text.summary(foreign.payments.length), foreign.payments.length)"
    data-testid="tax-foreign"
  >
    <div class="px-4 pt-3 sm:px-5">
      <FactGrid :facts="totals" />
    </div>
    <FigureTable class="mt-2 mb-2 px-1 sm:px-2" :label="text.title">
      <thead>
        <tr>
          <th scope="col" class="text-start">{{ text.payer }}</th>
          <th scope="col" class="cell-wraps hidden text-end @3xl:table-cell">{{ text.inCurrency }}</th>
          <th scope="col" class="cell-wraps hidden text-end @3xl:table-cell">{{ text.rate }}</th>
          <th scope="col" class="text-end">{{ text.gross }}</th>
          <th scope="col" class="cell-wraps hidden text-end @lg:table-cell">{{ text.withheld }}</th>
          <th scope="col" class="cell-wraps hidden text-end @lg:table-cell">{{ text.croatian(rules.incomeRate) }}</th>
          <th scope="col" class="cell-wraps hidden text-end @lg:table-cell">{{ text.credit }}</th>
          <th scope="col" class="cell-wraps text-end">{{ text.leftToPay }}</th>
        </tr>
      </thead>
      <tbody v-for="country in foreign.countries" :key="country.country ?? ''" data-testid="tax-foreign-country">
        <tr class="group-row">
          <th scope="rowgroup" colspan="8" class="cell-wraps text-start">
            {{ country.country === null ? text.noIsin : countryName(country.country) }}
            <span v-if="country.country === 'US' && !rules.usTreaty" class="block type-caption font-normal" data-testid="tax-no-treaty">
              {{ text.noUsTreaty(foreign.year, rules.usWithholding) }}
            </span>
          </th>
        </tr>
        <tr v-for="entry in country.payments" :key="entry.payment.id" data-testid="tax-foreign-payment">
          <th scope="row" class="cell-wraps text-start font-normal">
            {{ payerOf(entry) }}
            <span class="block type-caption">{{ dayLabel(entry.payment.date) }} · {{ recordWords.incomeKinds[entry.kind] }}</span>
            <span class="block type-caption" :class="{ 'text-warning': entry.route === 'booked-net' || entry.rate.kind === 'missing' }" data-testid="tax-foreign-route">
              {{ routeOf(entry) }}
            </span>
            <span v-if="noteOf(entry) !== ''" class="block type-caption">{{ noteOf(entry) }}</span>
          </th>
          <td class="figure hidden text-end @3xl:table-cell">
            {{ formatCurrencyAmount(entry.payment.gross, entry.payment.currency) }}
            <span v-if="entry.payment.withheld !== DECIMAL_ZERO" class="block type-caption">{{ formatCurrencyAmount(entry.payment.withheld, entry.payment.currency) }}</span>
          </td>
          <td class="figure hidden text-end @3xl:table-cell">{{ rateOf(entry) }}</td>
          <td class="cell-wraps text-end">
            <MoneyText v-if="entry.tax !== null" :cents="entry.tax.gross" />
            <span v-else class="type-caption">{{ formatCurrencyAmount(entry.payment.gross, entry.payment.currency) }}</span>
          </td>
          <td class="hidden text-end @lg:table-cell"><MoneyText v-if="entry.tax !== null" :cents="entry.tax.withheld" /></td>
          <td class="hidden text-end @lg:table-cell"><MoneyText v-if="entry.tax !== null" :cents="entry.tax.croatian" /></td>
          <td class="cell-wraps hidden text-end @lg:table-cell">
            <MoneyText v-if="entry.tax !== null" :cents="entry.tax.credit" />
            <span v-if="entry.tax !== null && entry.tax.lost > 0" class="block type-caption">{{ text.lost(formatMoney(entry.tax.lost)) }}</span>
          </td>
          <td class="text-end"><MoneyText v-if="entry.tax !== null" :cents="entry.tax.leftToPay" /></td>
        </tr>
        <tr data-testid="tax-foreign-total">
          <th scope="row" class="cell-wraps text-start">{{ text.countryTotal(country.country === null ? text.noIsin : countryName(country.country)) }}</th>
          <td class="hidden @3xl:table-cell" />
          <td class="hidden @3xl:table-cell" />
          <td class="text-end font-medium"><MoneyText :cents="country.total.gross" /></td>
          <td class="hidden text-end font-medium @lg:table-cell"><MoneyText :cents="country.total.withheld" /></td>
          <td class="hidden text-end font-medium @lg:table-cell"><MoneyText :cents="country.total.croatian" /></td>
          <td class="hidden text-end font-medium @lg:table-cell"><MoneyText :cents="country.total.credit" /></td>
          <td class="text-end font-medium"><MoneyText :cents="country.total.leftToPay" /></td>
        </tr>
      </tbody>
    </FigureTable>
    <p v-if="rules.surtax" class="px-4 pb-4 type-caption sm:px-5" data-testid="tax-foreign-before-surtax">{{ text.beforeSurtax(foreign.year) }}</p>
    <p v-if="foreign.couponsLeftOut > 0" class="px-4 pb-4 type-caption sm:px-5" data-testid="tax-coupons-left-out">{{ plural(text.couponsLeftOut(foreign.couponsLeftOut), foreign.couponsLeftOut) }}</p>
    <p v-if="foreign.croatianLeftOut > 0" class="px-4 pb-4 type-caption sm:px-5" data-testid="tax-croatian-left-out">
      {{ plural(text.croatianLeftOut(foreign.croatianLeftOut), foreign.croatianLeftOut) }}
    </p>
  </AppCard>
</template>
