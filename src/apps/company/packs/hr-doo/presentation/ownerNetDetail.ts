import type { RouteLocationRaw } from 'vue-router'

import { dayLabel } from '../../../../../shared/calendar/dayLabel'
import { monthLabel } from '../../../../../shared/calendar/monthLabel'
import { addMoney, negateMoney } from '../../../../../shared/money/money'
import type { DrillTarget } from '../../../filters/domain/drillTarget'
import type { OwnerNetWithProfit } from '../domain/ownerNetWithProfit'
import { RENT_TAX_LABEL } from './packCharts'
import { ruleChips, watchedIn } from './tracedFigureView'
import type { FigureDetail } from './tracedFigureView'
import type { BuildUpStep } from './yearEnd/LineBuildUp.vue'
import { plural } from '../../../../../shared/text/translation'
import { words } from './words'

export const OWNER_NET_TITLE = words.ownerNet.title

/** The build-up of the monthly net with the profit included, each line opening its rows, or Year for a year's profit. */
export function ownerNetDetail(net: OwnerNetWithProfit, period: string, link: (drill: DrillTarget) => RouteLocationRaw | null): FigureDetail {
  const months = (count: number) => plural(words.ownerNet.months(count), count)
  const step = (key: string, label: string, cents: number | null, to: RouteLocationRaw | null = null, depth: 0 | 1 = 0): BuildUpStep => ({ key, label, cents, to, depth })
  const several = net.years.length > 1
  const profitLines = net.years.flatMap(({ year, months: inYear, amount, route }) => {
    const first = inYear[0]
    const last = inYear[inYear.length - 1]
    const span = first === undefined || last === undefined ? String(year) : first === last ? monthLabel(first) : `${monthLabel(first)} – ${monthLabel(last)}`
    return [
      step(`profit-${year}`, words.ownerNet.profitBeforeTax(span), amount.amount, { path: '/company/year', query: { year: String(year) } }),
      step(`corporate-${year}`, route.corporateTax.label, negateMoney(route.corporateTax.amount), null, 1),
      step(`dividend-${year}`, route.dividendTax.label, negateMoney(route.dividendTax.amount), null, 1),
    ]
  })
  const paidOutLines = several
    ? net.years.filter((entry) => entry.paidOut.amount !== 0).map((entry) => step(`paid-${entry.year}`, words.ownerNet.paidOutOf(entry.year), entry.paidOut.amount, link(entry.paidOut.drill), 1))
    : []
  const [only] = net.years
  const steps: BuildUpStep[] = [
    step('pay', words.ownerNet.pay(months(net.payMonths)), addMoney(net.pay.amount, net.rentTax.amount), link(net.pay.drill)),
    ...(net.dividendsLeftOut.amount === 0 ? [] : [step('dividends', words.ownerNet.dividendsLeftOut, net.dividendsLeftOut.amount, link(net.dividendsLeftOut.drill), 1)]),
    ...(net.rentTax.amount !== 0
      ? [step('rent-tax', RENT_TAX_LABEL, negateMoney(net.rentTax.amount), link(net.rentTax.drill), 1), step('pay-kept', words.ownerNet.payAfterRentTax, net.pay.amount)]
      : []),
    ...(net.profitMonths.length === 0 ? [step('no-profit', words.ownerNet.noProfitMonth, null)] : profitLines),
    step('profit', words.ownerNet.profitAfterTaxes(months(net.profitMonths.length)), net.profit.amount),
    step('pay-a-month', words.ownerNet.payAMonth, net.payPerMonth),
    step('profit-a-month', words.ownerNet.profitAMonth, net.profitPerMonth),
    step('paid-out', words.ownerNet.paidOutAlready, net.paidOut, !several && only !== undefined ? link(only.paidOut.drill) : null),
    ...paidOutLines,
    step('left', words.ownerNet.leftInCompany, net.leftInCompany),
    ...(net.owed.amount === 0 ? [] : [step('sets-off', words.ownerNet.setsOff(dayLabel(net.owed.on)), net.setsOff, link(net.owed.drill), 1)]),
  ]
  return {
    title: OWNER_NET_TITLE,
    subtitle: words.ownerNet.subtitle(period, months(net.payMonths), net.profitMonths.length === 0 ? null : months(net.profitMonths.length)),
    cents: net.perMonth,
    to: null,
    steps,
    rules: ruleChips(net.profit.rules),
    watched: watchedIn([net.profit]),
  }
}
