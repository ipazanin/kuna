import type { LoanDirection } from '../../workbook/domain/informalLoan'
import { words } from './words'
import type { Tone } from '../../../../shared/ui/toneText'

/** How a direction shows on the Overview's tiles, a loan's card and badge, and its balance line. */
export interface DirectionLook {
  readonly label: string
  readonly icon: string
  /** The Nuxt UI colour of its badge and the tone of its icon. */
  readonly tone: Extract<Tone, 'error' | 'success'>
  /** The colour token of its line on a chart and its swatch. */
  readonly token: '--loan-you-owe' | '--loan-owed-to-you'
  /** The light tint under a figure in ink that says which way a net position runs, such as on the Loans card on the home. */
  readonly tint: '--loan-you-owe-tint' | '--loan-owed-to-you-tint'
}

export const DIRECTION_LOOKS: Readonly<Record<LoanDirection, DirectionLook>> = {
  'you-owe': { label: words.youOwe, icon: 'i-lucide-banknote-arrow-up', tone: 'error', token: '--loan-you-owe', tint: '--loan-you-owe-tint' },
  'owed-to-you': { label: words.owedToYou, icon: 'i-lucide-banknote-arrow-down', tone: 'success', token: '--loan-owed-to-you', tint: '--loan-owed-to-you-tint' },
}
