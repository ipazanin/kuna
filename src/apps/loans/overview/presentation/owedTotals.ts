import { ZERO, negateMoney, sumMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import type { BankLoanFigures } from '../../bankLoans/presentation/bankLoanView'
import type { InformalLoanFigures } from '../../informalLoans/presentation/informalLoanView'
import type { CivilDate } from '../../../../shared/calendar/civilDate'

export interface OwedTotals {
  /** What you owe over every loan. */
  readonly owed: Money
  /** What others owe you on informal loans, apart from what you owe. */
  readonly owedToYou: Money
}

/** The figures of each loan, which the screen or card has worked out already. A bank loan whose plan cannot be worked out has none. */
export interface LoanFigures {
  readonly bank: readonly (BankLoanFigures | null)[]
  readonly informal: readonly InformalLoanFigures[]
}

/** The totals the Loans Overview and its card on the home lead with. A bank loan without figures adds nothing. */
export function owedTotals(loans: LoanFigures): OwedTotals {
  const owed: Money[] = [...loans.bank.map((figures) => figures?.owed ?? ZERO), ...loans.informal.map((figures) => figures.owedByYou)]
  return {
    owed: sumMoney(owed.filter((amount) => amount > 0)),
    owedToYou: sumMoney(owed.filter((amount) => amount < 0).map(negateMoney)),
  }
}

/** A bank loan's name beside its figures, as the Overview lists it. */
export interface NamedBankLoanFigures {
  readonly name: string
  readonly figures: BankLoanFigures | null
}

export interface BankLoanTotals {
  /** The earliest next payment over the bank loans, and the loan it is of. */
  readonly next: { readonly name: string; readonly date: CivilDate; readonly yourShare: Money } | null
  /** The interest of the year over every bank loan, and the part of it subsidies pay. */
  readonly interestThisYear: { readonly year: number; readonly interest: Money; readonly subsidy: Money }
  /** The day the last bank loan is paid off. */
  readonly lastPayoff: CivilDate | null
}

/** What the Overview's tiles show over the bank loans, or null when none has figures. */
export function bankLoanTotals(loans: readonly NamedBankLoanFigures[]): BankLoanTotals | null {
  const known = loans.flatMap((loan) => (loan.figures === null ? [] : [{ name: loan.name, figures: loan.figures }]))
  const [first] = known
  if (first === undefined) return null
  const next = known
    .flatMap(({ name, figures }) => (figures.next === null ? [] : [{ name, date: figures.next.date, yourShare: figures.next.yourShare }]))
    .reduce<BankLoanTotals['next']>((earliest, payment) => (earliest === null || payment.date < earliest.date ? payment : earliest), null)
  const payoffs = known.flatMap(({ figures }) => (figures.payoff === null ? [] : [figures.payoff]))
  return {
    next,
    interestThisYear: {
      year: first.figures.interestThisYear.year,
      interest: sumMoney(known.map(({ figures }) => figures.interestThisYear.interest)),
      subsidy: sumMoney(known.map(({ figures }) => figures.interestThisYear.subsidy)),
    },
    lastPayoff: payoffs.reduce<CivilDate | null>((latest, payoff) => (latest === null || payoff > latest ? payoff : latest), null),
  }
}
