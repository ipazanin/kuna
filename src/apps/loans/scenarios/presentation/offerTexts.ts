import { costTexts, typedCosts } from './changeTexts'
import { spanOf } from './scenarioComparison'
import { words } from './words'
import type { CostTexts } from './changeTexts'
import type { LoanChange, OfferTerms } from '../domain/loanScenario'
import { fractionOf, rateText, typedRate } from '../../bankLoans/domain/yearlyRate'
import { typedLoanTerms } from '../../bankLoans/presentation/loanTermsTexts'
import type { LoanTermsErrors } from '../../bankLoans/presentation/loanTermsTexts'
import { subsidyTexts, typedSubsidy } from '../../bankLoans/presentation/subsidyTexts'
import type { SubsidyTexts } from '../../bankLoans/presentation/subsidyTexts'
import { typedTerm } from '../../bankLoans/presentation/typedTerm'
import { words as bankWords } from '../../bankLoans/presentation/words'
import type { BankLoan } from '../../workbook/domain/bankLoan'
import type { RatePeriod } from '../../workbook/domain/ratePeriod'
import { parseCivilDate } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { dayMonthsLater } from '../../../../shared/calendar/monthKey'
import { plainAmount } from '../../../../shared/money/money'
import { formatMoney, formatRate } from '../../../../shared/money/moneyFormat'
import { typedAmount } from '../../../../shared/money/typedAmount'
import { typedCount } from '../../../../shared/text/typedCount'

type RateChange = Extract<LoanChange, { kind: 'rate-change' }>

/** An offer as typed: the amount, rate, term and repayment up front, and the rest, which changes nothing until filled. */
export interface OfferTexts {
  principal: string
  rate: string
  /** The first rate's kind, kept from a saved offer, fixed for a new one. */
  rateType: RatePeriod['rateType']
  years: string
  months: string
  repayment: BankLoan['repayment']
  name: string
  lender: string
  payout: string
  /** Blank for a month after the payout. */
  firstInstalment: string
  interimAmount: string
  interimDate: string
  fixedYears: string
  thenVariable: string
  subsidised: boolean
  subsidy: SubsidyTexts
  costs: CostTexts
  bankEks: string
}

/** Where a fixed rate gives way to a variable one, counted in whole years from the first instalment. */
function variableAfter(firstInstalment: CivilDate, years: number): CivilDate {
  return dayMonthsLater(firstInstalment, 12 * years)
}

/**
 * The fields for a saved offer, or a new one paid out today, with the changes the fields do not hold:
 * every change but the first rate and a variable rate from a whole year on after a fixed one.
 */
export function offerTexts(name: string, terms: OfferTerms | null, changes: readonly LoanChange[], today: CivilDate): { readonly texts: OfferTexts; readonly later: readonly LoanChange[] } {
  const rates = changes.filter((change): change is RateChange => change.kind === 'rate-change')
  const first = terms === null ? undefined : rates.find((change) => change.from === terms.firstInstalment)
  const yearsFixed =
    terms === null || first === undefined || first.rateType !== 'fixed'
      ? []
      : rates.flatMap((change) => {
          if (change === first || change.rateType !== 'variable') return []
          const years = Math.floor(terms.instalments / 12)
          const whole = Array.from({ length: years }, (_, index) => index + 1).find((count) => variableAfter(terms.firstInstalment, count) === change.from)
          return whole === undefined || whole * 12 >= terms.instalments ? [] : [{ change, years: whole }]
        })
  const variable = yearsFixed[0] ?? null
  const payout = terms?.drawdown ?? today
  return {
    texts: {
      principal: terms === null ? '' : plainAmount(terms.principal),
      rate: first === undefined ? '' : rateText(first.rate),
      rateType: first?.rateType ?? 'fixed',
      years: terms === null ? '' : String(Math.floor(terms.instalments / 12)),
      months: terms === null ? '' : String(terms.instalments % 12),
      repayment: terms?.repayment ?? 'annuity',
      name,
      lender: terms?.lender ?? '',
      payout,
      firstInstalment: terms === null || terms.firstInstalment === dayMonthsLater(payout, 1) ? '' : terms.firstInstalment,
      interimAmount: terms?.interimInterest ? plainAmount(terms.interimInterest.amount) : '',
      interimDate: terms?.interimInterest?.date ?? '',
      fixedYears: variable === null ? '' : String(variable.years),
      thenVariable: variable === null ? '' : rateText(variable.change.rate),
      subsidised: (terms?.subsidy ?? null) !== null,
      subsidy: subsidyTexts(terms?.subsidy ?? null),
      costs: costTexts(terms?.costs ?? null),
      bankEks: terms === null || terms.bankEks === null ? '' : rateText(terms.bankEks),
    },
    later: changes.filter((change) => change !== first && change !== variable?.change),
  }
}

/** The name a blank one becomes, such as "€100,000.00 at 4% over 10 y", or empty until the figures are typed. */
export function offerAutoName(texts: OfferTexts): string {
  const principal = typedAmount(texts.principal)
  const rate = typedRate(texts.rate)
  const instalments = typedTerm(texts.years, texts.months)
  return principal === null || rate === null || instalments === null ? '' : words.editor.autoName(formatMoney(principal), formatRate(fractionOf(rate)), spanOf(instalments))
}

/** Whether the fields fill anything under More terms that changes a figure, so the section opens on them. */
export function fillsMore(texts: OfferTexts): boolean {
  const costs = Object.values(texts.costs).some((cost) => cost.trim() !== '')
  return (
    [texts.lender, texts.firstInstalment, texts.interimAmount, texts.interimDate, texts.fixedYears, texts.thenVariable, texts.bankEks].some((text) => text.trim() !== '') || texts.subsidised || costs
  )
}

/** Whether a field under More terms is wrong while the four up front are right, which only opening the section shows. */
export function wrongInMore(errors: OfferErrors): boolean {
  return errors.principal === null && errors.rate === null && errors.term === null
}

export type OfferErrors = LoanTermsErrors & Readonly<Record<'rate' | 'term' | 'fixedYears' | 'thenVariable' | 'bankEks', string | null>>

/**
 * The offer the fields give with its rates, the first from the first instalment and a variable one
 * after the fixed years, or nulls while a field is wrong, with why each is.
 */
export function typedOffer(texts: OfferTexts): { readonly terms: OfferTerms | null; readonly rates: readonly RateChange[]; readonly errors: OfferErrors } {
  const instalments = typedTerm(texts.years, texts.months)
  const payout = parseCivilDate(texts.payout)
  const firstInstalment = texts.firstInstalment === '' && payout !== null ? dayMonthsLater(payout, 1) : texts.firstInstalment
  const loan = typedLoanTerms({
    lender: texts.lender,
    principal: texts.principal,
    drawdown: texts.payout,
    firstInstalment,
    instalments: instalments === null ? '' : String(instalments),
    interimAmount: texts.interimAmount,
    interimDate: texts.interimDate,
    repayment: texts.repayment,
  })
  const subsidy = texts.subsidised ? typedSubsidy(texts.subsidy, instalments, bankWords.subsidyFields).subsidy : null
  const { costs } = typedCosts(texts.costs)
  const bankEks = texts.bankEks.trim() === '' ? null : typedRate(texts.bankEks)
  const rate = typedRate(texts.rate)
  const variableWanted = texts.fixedYears.trim() !== '' || texts.thenVariable.trim() !== ''
  const fixedYears = typedCount(texts.fixedYears)
  const fixedYearsWrong = variableWanted && (fixedYears === null || (instalments !== null && fixedYears * 12 >= instalments))
  const thenVariable = typedRate(texts.thenVariable)
  const thenVariableWrong = variableWanted && thenVariable === null
  const errors: OfferErrors = {
    ...loan.errors,
    rate: rate === null ? bankWords.rateFields.rateError : null,
    term: instalments === null ? words.editor.termError : null,
    fixedYears: fixedYearsWrong ? words.editor.fixedForError : null,
    thenVariable: thenVariableWrong ? bankWords.rateFields.rateError : null,
    bankEks: texts.bankEks.trim() !== '' && bankEks === null ? bankWords.rateFields.rateError : null,
  }
  const valid = loan.terms !== null && rate !== null && costs !== null && (!texts.subsidised || subsidy !== null) && errors.bankEks === null && !fixedYearsWrong && !thenVariableWrong
  if (!valid || loan.terms === null || rate === null || costs === null) return { terms: null, rates: [], errors }
  const terms: OfferTerms = { ...loan.terms, subsidy, costs, bankEks }
  const first: RateChange = { kind: 'rate-change', from: terms.firstInstalment, rate, rateType: texts.rateType }
  const later: RateChange[] =
    fixedYears === null || thenVariable === null || !variableWanted ? [] : [{ kind: 'rate-change', from: variableAfter(terms.firstInstalment, fixedYears), rate: thenVariable, rateType: 'variable' }]
  return { terms, rates: [first, ...later], errors }
}
