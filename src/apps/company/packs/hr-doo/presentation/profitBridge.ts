import type { BridgeWording } from '../../../../../shared/charts/bridgeChart'
import { formatMoney } from '../../../../../shared/money/moneyFormat'
import type { DrillTarget } from '../../../filters/domain/drillTarget'
import { words } from './words'

/** The pack's bridges read from their first bar, one bar per step, and a step raises or lowers profit unless a caller names what it moves. */
export const PROFIT_BRIDGE: BridgeWording<DrillTarget> = {
  raises: words.bridge.raises,
  lowers: words.bridge.lowers,
  total: words.bridge.total,
  residual: words.bridge.residual,
  amount: words.bridge.amount,
  description: (bars) =>
    bars.length === 0
      ? words.bridge.none
      : words.bridge.description(
          bars[0]?.label ?? '',
          formatMoney(bars[0]?.amount ?? 0),
          bars
            .slice(1)
            .map((bar) => `${bar.label} ${formatMoney(bar.amount, bar.kind === 'total' ? 'negative' : 'always')}`)
            .join(', '),
          bars[bars.length - 1]?.label ?? null,
        ),
}
