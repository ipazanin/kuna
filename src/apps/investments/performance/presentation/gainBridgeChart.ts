import { gainSteps } from '../domain/periodGains'
import type { GainStep, PeriodGains } from '../domain/periodGains'
import { words } from './words'
import { bridgeChart } from '../../../../shared/charts/bridgeChart'
import type { BridgeBar, BridgeChart } from '../../../../shared/charts/bridgeChart'
import { tokenColour } from '../../../../shared/charts/chartTokens'
import type { ChartTokens } from '../../../../shared/charts/chartTokens'
import { formatMoney } from '../../../../shared/money/moneyFormat'

const STEP_LABELS: Readonly<Record<GainStep, string>> = {
  'put-in': words.bridge.putIn,
  'taken-out': words.bridge.takenOut,
  price: words.bridge.price,
  currency: words.bridge.currency,
  realised: words.bridge.realised,
  income: words.bridge.income,
  withheld: words.bridge.withheld,
  fees: words.bridge.fees,
}

/** Money put in or taken out moves the value without a gain, gains and losses take a tone, and tax and fees are costs in grey. */
const STEP_KINDS: Readonly<Record<GainStep, BridgeBar<never>['kind']>> = {
  'put-in': 'transfer',
  'taken-out': 'transfer',
  price: 'step',
  currency: 'step',
  realised: 'step',
  income: 'step',
  withheld: 'residual',
  fees: 'residual',
}

/** The value at the start, each step of the period that moved it and the value at the end. */
export function gainBridgeChart(gains: PeriodGains, tokens: ChartTokens): BridgeChart<never> {
  const bars: BridgeBar<never>[] = [
    { label: words.bridge.start, kind: 'total', amount: gains.start, drill: null },
    ...gainSteps(gains).flatMap((step): BridgeBar<never>[] => (step.amount === 0 ? [] : [{ label: STEP_LABELS[step.step], kind: STEP_KINDS[step.step], amount: step.amount, drill: null }])),
    { label: words.bridge.end, kind: 'total', amount: gains.end, drill: null },
  ]
  return bridgeChart(bars, tokens, {
    raises: words.bridge.gain,
    lowers: words.bridge.loss,
    total: words.bridge.total,
    residual: words.bridge.costs,
    transfer: { label: words.bridge.moved, colour: tokenColour('--invest-portfolio') },
    amount: words.bridge.amount,
    description: (shown) =>
      words.bridge.description(
        formatMoney(gains.start),
        shown
          .filter((bar) => bar.kind !== 'total')
          .map((bar) => `${bar.label} ${formatMoney(bar.amount, 'always')}`)
          .join(', '),
        formatMoney(gains.end),
      ),
  })
}
