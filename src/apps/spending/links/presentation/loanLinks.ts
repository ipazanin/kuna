import { words } from './words'
import { loanTargets } from '../application/loanRecords'
import { instalmentLinksOf } from '../domain/instalmentSplit'
import type { InstalmentLinks } from '../domain/instalmentSplit'
import { language } from '../../../../shared/text/language'

/** The records of the Loans file on screen a write may link rows to, in the language on screen. */
export function loanLinks(): InstalmentLinks {
  return instalmentLinksOf(loanTargets(), { language, notes: words.notes })
}
