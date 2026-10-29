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

export const OWNER_NET_TITLE = 'Monthly net, profit included'

/** The build-up of the monthly net with the profit included, each line opening its rows, or Year for a year's profit. */
export function ownerNetDetail(net: OwnerNetWithProfit, period: string, link: (drill: DrillTarget) => RouteLocationRaw | null): FigureDetail {
  const months = (count: number) => `${count} ${count === 1 ? 'month' : 'months'}`
  const step = (key: string, label: string, cents: number | null, to: RouteLocationRaw | null = null, depth: 0 | 1 = 0): BuildUpStep => ({ key, label, cents, to, depth })
  const several = net.years.length > 1
  const profitLines = net.years.flatMap(({ year, months: inYear, amount, route }) => {
    const first = inYear[0]
    const last = inYear[inYear.length - 1]
    const span = first === undefined || last === undefined ? String(year) : first === last ? monthLabel(first) : `${monthLabel(first)} – ${monthLabel(last)}`
    return [
      step(`profit-${year}`, `Profit before tax, ${span}`, amount.amount, { path: '/company/year', query: { year: String(year) } }),
      step(`corporate-${year}`, route.corporateTax.label, negateMoney(route.corporateTax.amount), null, 1),
      step(`dividend-${year}`, route.dividendTax.label, negateMoney(route.dividendTax.amount), null, 1),
    ]
  })
  const paidOutLines = several
    ? net.years
        .filter((entry) => entry.paidOut.amount !== 0)
        .map((entry) => step(`paid-${entry.year}`, `Paid in ${entry.year + 1} out of ${entry.year}`, entry.paidOut.amount, link(entry.paidOut.drill), 1))
    : []
  const [only] = net.years
  const steps: BuildUpStep[] = [
    step('pay', `Pay without loans and dividends, ${months(net.payMonths)}`, addMoney(net.pay.amount, net.rentTax.amount), link(net.pay.drill)),
    ...(net.dividendsLeftOut.amount === 0 ? [] : [step('dividends', 'Dividends left out, since the profit counts them', net.dividendsLeftOut.amount, link(net.dividendsLeftOut.drill), 1)]),
    ...(net.rentTax.amount !== 0 ? [step('rent-tax', RENT_TAX_LABEL, negateMoney(net.rentTax.amount), link(net.rentTax.drill), 1), step('pay-kept', 'Pay after the rent tax', net.pay.amount)] : []),
    ...(net.profitMonths.length === 0 ? [step('no-profit', 'No complete month of profit yet', null)] : profitLines),
    step('profit', `Profit after both taxes, ${months(net.profitMonths.length)}`, net.profit.amount),
    step('pay-a-month', 'Pay a month', net.payPerMonth),
    step('profit-a-month', 'From profit a month', net.profitPerMonth),
    step('paid-out', 'Paid out of it as dividends already', net.paidOut, !several && only !== undefined ? link(only.paidOut.drill) : null),
    ...paidOutLines,
    step('left', 'Left in the company', net.leftInCompany),
    ...(net.owed.amount === 0 ? [] : [step('sets-off', `Of it, sets off what the owner owes on ${dayLabel(net.owed.on)}`, net.setsOff, link(net.owed.drill), 1)]),
  ]
  return {
    title: OWNER_NET_TITLE,
    subtitle: `${period}. Pay over ${months(net.payMonths)}, profit over ${net.profitMonths.length === 0 ? 'no complete month' : `${months(net.profitMonths.length)} up to the last complete month`}. The profit is the company's, so it follows the period alone.`,
    cents: net.perMonth,
    to: null,
    steps,
    rules: ruleChips(net.profit.rules),
    watched: watchedIn([net.profit]),
  }
}
