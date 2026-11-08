import type { LoanSubsidy } from '../../workbook/domain/bankLoan'
import { plainAmount } from '../../../../shared/money/money'
import { typedAmount } from '../../../../shared/money/typedAmount'
import { typedCount } from '../../../../shared/text/typedCount'
import { words as loansWords } from '../../words'
import type { words } from './words'

export interface SubsidyTexts {
  monthly: string
  payer: string
  firstInstalment: string
  instalments: string
}

export function subsidyTexts(subsidy: LoanSubsidy | null): SubsidyTexts {
  return subsidy === null
    ? { monthly: '', payer: '', firstInstalment: '1', instalments: '60' }
    : { monthly: plainAmount(subsidy.monthly), payer: subsidy.payer, firstInstalment: String(subsidy.firstInstalment), instalments: String(subsidy.instalments) }
}

/** The subsidy the fields name, or why not in the loan's words, for a loan of this many instalments. */
export function typedSubsidy(
  texts: SubsidyTexts,
  instalments: number | null,
  fieldWords: typeof words.subsidyFields,
): { readonly subsidy: LoanSubsidy | null; readonly errors: Readonly<Record<Exclude<keyof SubsidyTexts, 'payer'>, string | null>> } {
  const monthly = typedAmount(texts.monthly)
  const firstInstalment = typedCount(texts.firstInstalment)
  const count = typedCount(texts.instalments)
  const pastTheEnd = firstInstalment !== null && count !== null && instalments !== null && firstInstalment + count - 1 > instalments
  const errors = {
    monthly: monthly === null || monthly <= 0 ? loansWords.form.anAmount : null,
    firstInstalment: firstInstalment === null ? fieldWords.firstInstalmentError : null,
    instalments: count === null ? fieldWords.instalmentsError : pastTheEnd && instalments !== null ? fieldWords.pastTheEnd(instalments) : null,
  }
  const subsidy = monthly !== null && monthly > 0 && firstInstalment !== null && count !== null && !pastTheEnd ? { monthly, firstInstalment, instalments: count, payer: texts.payer.trim() } : null
  return { subsidy, errors }
}
