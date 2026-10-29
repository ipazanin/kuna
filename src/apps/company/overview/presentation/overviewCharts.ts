import type { RouteLocationRaw } from 'vue-router'

import type { DonutPart } from '../../../../shared/ui/DonutCard.vue'
import { inSentence, lineShown } from '../../settings/domain/profitAndLossLabels'
import type { Settings } from '../../settings/domain/settings'
import type { DrillTarget } from '../../filters/domain/drillTarget'
import { currencyUnitName, formatMoney, formatPercent } from '../../../../shared/money/moneyFormat'
import type { EuroSplit, EuroSplitPart } from '../domain/euroSplit'

interface SplitPart {
  readonly part: EuroSplitPart
  readonly name: string
  /** The colour token of the bucket, and a recessive grey for what is kept. */
  readonly colour: string
}

/** Each cost on screen, named by the settings, then what is kept. */
function splitParts(settings: Settings): SplitPart[] {
  const parts: SplitPart[] = [
    { part: 'operating', name: settings.bucketLabels.operating, colour: '--bucket-operating' },
    { part: 'taxes', name: settings.bucketLabels.taxes, colour: '--bucket-taxes' },
    { part: 'ownerPay', name: settings.bucketLabels['owner-pay'], colour: '--bucket-owner-pay' },
    { part: 'kept', name: 'Kept', colour: '--chart-deemphasis' },
  ]
  return parts.filter((part) => part.part !== 'ownerPay' || lineShown(settings, 'ownerPay'))
}

/** Where every euro earned went, as the parts of a ring. A loss keeps nothing, so the ring then splits every euro spent. */
export function euroDonut(split: EuroSplit, settings: Settings, linkOf: (drill: DrillTarget) => RouteLocationRaw | null): { parts: DonutPart[]; description: string } {
  const unit = currencyUnitName()
  const parts = splitParts(settings).flatMap(({ part, name, colour }): DonutPart[] => {
    const slice = split.slices.find((candidate) => candidate.part === part)
    return slice === undefined ? [] : [{ key: part, label: name, value: slice.total, colour, to: linkOf(slice.drill) }]
  })
  const shares = parts.map((part) => `${inSentence(part.label)} ${formatPercent(split.slices.find((slice) => slice.part === part.key)?.share ?? 0)}`).join(', ')
  return {
    parts,
    description:
      split.basis === 'income'
        ? `Of every ${unit} earned in the last 12 months: ${shares}.`
        : `In the last 12 months costs exceeded income by ${formatMoney(split.shortfall ?? 0)}, so the ring splits every ${unit} spent: ${shares}.`,
  }
}
