import type { MoneyTone, SignDisplay } from '../money/moneyFormat'

/** The colour class of an amount by its tone: full green or red for an outcome, the soft depth for a flow, full red for a balance below zero. Zero is ink. */
export function moneyToneClass(cents: number, tone: MoneyTone | undefined): string {
  if (tone === undefined || cents === 0) return ''
  switch (tone) {
    case 'outcome':
      return cents > 0 ? 'text-success' : 'text-error'
    case 'flow':
      return cents > 0 ? 'text-positive-soft' : 'text-negative-soft'
    case 'balance':
      return cents > 0 ? '' : 'text-error'
  }
}

/** The sign an amount shows: a flow or an outcome always shows it, and a balance or an amount in ink shows a minus below zero unless it says otherwise. */
export function moneySign(tone: MoneyTone | undefined, sign: SignDisplay | undefined): SignDisplay {
  if (tone === 'flow' || tone === 'outcome') return 'always'
  return sign ?? 'negative'
}
