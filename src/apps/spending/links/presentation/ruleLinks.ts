import { words } from './words'
import { ruleAssets } from '../application/assetTargets'
import { loanTargets } from '../application/loanRecords'
import { ruleLinksOf } from '../domain/linkFiling'
import type { RuleLinks } from '../domain/linkFiling'
import { language } from '../../../../shared/text/language'

/** The records of the Loans file on screen and the assets a write may link rows to, in the language on screen. */
export function ruleLinks(): RuleLinks {
  return ruleLinksOf(loanTargets(), { language, notes: words.notes }, ruleAssets())
}
