import type { LoanSubsidy } from '../../workbook/domain/bankLoan'
import { plainAmount } from '../../../../shared/money/money'
import { typedAmount } from '../../../../shared/money/typedAmount'
import { typedCount } from '../../../../shared/text/typedCount'

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

/** What is wrong with each field of a subsidy, or null where nothing is. */
export interface SubsidyFaults {
  readonly monthly: 'no-amount' | null
  readonly firstInstalment: 'no-count' | null
  /** Past the end when the covered instalments run beyond the loan's last. */
  readonly instalments: 'no-count' | 'past-the-end' | null
}

/** The subsidy the fields name for a loan of this many instalments, or null while one is wrong, with what is wrong with each. */
export function typedSubsidy(texts: SubsidyTexts, instalments: number | null): { readonly subsidy: LoanSubsidy | null; readonly faults: SubsidyFaults } {
  const monthly = typedAmount(texts.monthly)
  const firstInstalment = typedCount(texts.firstInstalment)
  const count = typedCount(texts.instalments)
  const pastTheEnd = firstInstalment !== null && count !== null && instalments !== null && firstInstalment + count - 1 > instalments
  const faults: SubsidyFaults = {
    monthly: monthly === null || monthly <= 0 ? 'no-amount' : null,
    firstInstalment: firstInstalment === null ? 'no-count' : null,
    instalments: count === null ? 'no-count' : pastTheEnd ? 'past-the-end' : null,
  }
  const subsidy = monthly !== null && monthly > 0 && firstInstalment !== null && count !== null && !pastTheEnd ? { monthly, firstInstalment, instalments: count, payer: texts.payer.trim() } : null
  return { subsidy, faults }
}
