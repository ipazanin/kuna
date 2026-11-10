import type { BankLoan, InterimInterest, LoanTerms } from '../../workbook/domain/bankLoan'
import { MOST_INSTALMENTS } from '../../workbook/domain/bankLoanReading'
import { parseCivilDate } from '../../../../shared/calendar/civilDate'
import { plainAmount } from '../../../../shared/money/money'
import { typedAmount } from '../../../../shared/money/typedAmount'
import { typedCount } from '../../../../shared/text/typedCount'

/** The terms a bank loan shares with an offer, as typed. */
export interface LoanTermsTexts {
  lender: string
  principal: string
  drawdown: string
  firstInstalment: string
  instalments: string
  interimAmount: string
  interimDate: string
  repayment: BankLoan['repayment']
}

export function loanTermsTexts(terms: LoanTerms | null): LoanTermsTexts {
  return {
    lender: terms?.lender ?? '',
    principal: terms === null ? '' : plainAmount(terms.principal),
    drawdown: terms?.drawdown ?? '',
    firstInstalment: terms?.firstInstalment ?? '',
    instalments: terms === null ? '' : String(terms.instalments),
    interimAmount: terms?.interimInterest ? plainAmount(terms.interimInterest.amount) : '',
    interimDate: terms?.interimInterest?.date ?? '',
    repayment: terms?.repayment ?? 'annuity',
  }
}

/** What is wrong with each field of a loan's terms, or null where nothing is. */
export interface LoanTermsFaults {
  readonly principal: 'no-amount' | null
  readonly drawdown: 'no-date' | null
  readonly firstInstalment: 'no-date' | 'not-after-drawdown' | null
  readonly instalments: 'no-count' | 'too-many' | null
  /** The interest before the first instalment needs an amount above zero and its date, or neither. */
  readonly interim: 'half-given' | null
}

/** The terms the fields give, the subsidy left to its own fields, or null while one is wrong, with what is wrong with each. */
export function typedLoanTerms(texts: LoanTermsTexts): { readonly terms: Omit<LoanTerms, 'subsidy'> | null; readonly instalments: number | null; readonly faults: LoanTermsFaults } {
  const amount = typedAmount(texts.principal)
  const principal = amount !== null && amount > 0 ? amount : null
  const drawdown = parseCivilDate(texts.drawdown)
  const firstInstalment = parseCivilDate(texts.firstInstalment)
  const instalments = typedCount(texts.instalments)
  const interestAmount = typedAmount(texts.interimAmount)
  const interestDate = parseCivilDate(texts.interimDate)
  const interim: InterimInterest | null | undefined =
    texts.interimAmount.trim() === '' && texts.interimDate === ''
      ? null
      : interestAmount === null || interestAmount <= 0 || interestDate === null
        ? undefined
        : { amount: interestAmount, date: interestDate }
  const faults: LoanTermsFaults = {
    principal: principal === null ? 'no-amount' : null,
    drawdown: drawdown === null ? 'no-date' : null,
    firstInstalment: firstInstalment === null ? 'no-date' : drawdown !== null && firstInstalment <= drawdown ? 'not-after-drawdown' : null,
    instalments: instalments === null ? 'no-count' : instalments > MOST_INSTALMENTS ? 'too-many' : null,
    interim: interim === undefined ? 'half-given' : null,
  }
  const valid = Object.values(faults).every((fault) => fault === null)
  return {
    terms:
      valid && principal !== null && drawdown !== null && firstInstalment !== null && instalments !== null && interim !== undefined
        ? { lender: texts.lender, principal, drawdown, firstInstalment, instalments, interimInterest: interim, repayment: texts.repayment }
        : null,
    instalments,
    faults,
  }
}
