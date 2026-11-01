import { gainSteps } from '../domain/periodGains'
import type { GainStep, PeriodGains } from '../domain/periodGains'
import { words } from './words'
import { bridgeChart } from '../../../../shared/charts/bridgeChart'
import type { BridgeChart, StepBar } from '../../../../shared/charts/bridgeChart'
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
const STEP_KINDS: Readonly<Record<GainStep, StepBar<never>['kind']>> = {
  'put-in': 'transfer',
  'taken-out': 'transfer',
  price: 'step',
  currency: 'step',
  realised: 'step',
  income: 'step',
  withheld: 'residual',
  fees: 'residual',
}

export interface GainBridgeChart extends BridgeChart<never> {
  /** True when no step moved the value, so there is no bar to draw. */
  readonly still: boolean
}

/** Each step of the period that moved the value, running on from the value at the start, which the card writes above it with the end. */
export function gainBridgeChart(gains: PeriodGains, tokens: ChartTokens): GainBridgeChart {
  const bars = gainSteps(gains).flatMap((step): StepBar<never>[] => (step.amount === 0 ? [] : [{ label: STEP_LABELS[step.step], kind: STEP_KINDS[step.step], amount: step.amount, drill: null }]))
  const chart = bridgeChart(
    bars,
    tokens,
    {
      raises: words.bridge.gain,
      lowers: words.bridge.loss,
      residual: words.bridge.costs,
      transfer: { label: words.bridge.moved, colour: tokenColour('--invest-portfolio') },
      amount: words.bridge.amount,
      description: (shown) => words.bridge.description(formatMoney(gains.start), shown.map((bar) => `${bar.label} ${formatMoney(bar.amount, 'always')}`).join(', '), formatMoney(gains.end)),
    },
    gains.start,
  )
  return { ...chart, still: bars.length === 0 }
}
