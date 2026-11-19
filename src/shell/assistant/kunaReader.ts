import type { AppReader, ReportFigure } from '../../shared/app/assistantReader'
import { netWorthSides } from '../../shared/app/netWorthSides'
import { personalNet } from '../../shared/app/personalNet'
import { parseCivilDate, today } from '../../shared/calendar/civilDate'
import { currencyCodeOf, EURO } from '../../shared/money/currencyCode'
import type { Money } from '../../shared/money/money'
import { countedHubApps } from '../netWorth/hubApps'
import { words } from './words'

/**
 * Net worth as the chat reads it, for today only: the sum, what you have and what you owe, and each part by its app and its key,
 * so a loan goes by its lender and payout day and never by a name a person gave. What the parts leave out, and why there is no sum, are counts with their reason.
 */
function netWorthFigures(period: string | null): readonly ReportFigure[] {
  if (period !== null && parseCivilDate(period) !== today()) throw new RangeError('Net worth reads only today. Each app’s own reports read other days.')
  const apps = countedHubApps().map((entry) => entry.read())
  const net = personalNet(apps)
  const { has, owes } = netWorthSides(apps)
  const currency = currencyCodeOf(apps[0]?.currency ?? EURO) ?? EURO
  const amount = (label: string, cents: Money): ReportFigure => ({ label, of: 'app', cents, currency })
  const why: readonly ReportFigure[] =
    net.sum.state === 'ready'
      ? [amount('what you have less what you owe', net.sum.cents)]
      : net.sum.state === 'failed'
        ? [{ label: `no sum, as ${net.sum.apps.map((app) => app.app.id).join(' and ')} did not open`, count: 1 }]
        : net.sum.state === 'currencies'
          ? [{ label: 'no sum, as the apps keep different currencies', count: 1 }]
          : net.sum.state === 'nothing'
            ? [{ label: 'no sum, as no app is set up', count: 1 }]
            : []
  return [
    ...why,
    amount('what you have', has.total),
    amount('what you owe', owes.total),
    ...has.parts.map(({ app, part }) => amount(`what you have, ${app.app.id}: ${part.key}`, part.cents)),
    ...owes.parts.map(({ app, part }) => amount(`what you owe, ${app.app.id}: ${part.key}`, part.cents)),
    ...net.notSetUp.map((app) => ({ label: `not set up, so counted as nothing: ${app.app.id}`, count: 1 })),
    ...net.leavesOut.map((note) => ({ label: `left out: ${note}`, count: 1 })),
  ]
}

/** What the chat can read of Kuna itself: no records, and Net worth over the apps that add up. */
export function kunaReader(): AppReader {
  return {
    status: () => (personalNet(countedHubApps().map((entry) => entry.read())).sum.state === 'opening' ? 'opening' : 'open'),
    kinds: [],
    reports: [{ id: 'net_worth', title: words.reports.netWorth.title, about: words.reports.netWorth.about, period: 'day', figures: netWorthFigures }],
  }
}
