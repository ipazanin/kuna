import type { MoneyTone } from '../money/moneyFormat'

/** `flow` greens money coming in and leaves money going out in the normal ink. `outcome` also reds a loss. */
export function moneyToneClass(cents: number, tone: MoneyTone | undefined): string {
  if (tone === undefined || cents === 0) return ''
  if (cents > 0) return 'text-success'
  return tone === 'outcome' ? 'text-error' : ''
}
