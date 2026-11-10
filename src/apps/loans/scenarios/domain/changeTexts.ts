import type { LoanChange, LoanCosts } from './loanScenario'
import { rateText, typedRate } from '../../bankLoans/domain/yearlyRate'
import { MOST_INSTALMENTS } from '../../workbook/domain/bankLoanReading'
import type { ExtraPayment } from '../../workbook/domain/extraPayment'
import type { RatePeriod } from '../../workbook/domain/ratePeriod'
import { parseCivilDate } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { ZERO, plainAmount } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import { typedAmount } from '../../../../shared/money/typedAmount'
import { typedCount } from '../../../../shared/text/typedCount'

/** A rate and whether the bank can change it, as typed. */
export interface RateTexts {
  rate: string
  rateType: RatePeriod['rateType']
}

/** What a loan charges beside its instalments, as typed. A blank field costs nothing. */
export interface CostTexts {
  upfront: string
  monthly: string
  yearly: string
}

export function costTexts(costs: LoanCosts | null): CostTexts {
  const text = (amount: Money): string => (amount === 0 ? '' : plainAmount(amount))
  return costs === null ? { upfront: '', monthly: '', yearly: '' } : { upfront: text(costs.upfront), monthly: text(costs.monthly), yearly: text(costs.yearly) }
}

/** Which cost fields do not hold an amount of zero or more. */
export type CostFaults = Readonly<Record<keyof CostTexts, boolean>>

/** The costs the fields give, blank as nothing, or null while one is not an amount of zero or more. */
export function typedCosts(texts: CostTexts): { readonly costs: LoanCosts | null; readonly faults: CostFaults } {
  const typed = (text: string) => (text.trim() === '' ? ZERO : typedAmount(text))
  const upfront = typed(texts.upfront)
  const monthly = typed(texts.monthly)
  const yearly = typed(texts.yearly)
  const wrong = (amount: typeof upfront): boolean => amount === null || amount < 0
  return {
    costs: upfront === null || monthly === null || yearly === null || upfront < 0 || monthly < 0 || yearly < 0 ? null : { upfront, monthly, yearly },
    faults: { upfront: wrong(upfront), monthly: wrong(monthly), yearly: wrong(yearly) },
  }
}

/** One change as its fields hold it, whatever its kind, so switching fields keeps what was typed. */
export interface ChangeTexts {
  /** Tells the editor's blocks apart, nothing more. */
  readonly id: number
  readonly kind: LoanChange['kind']
  amount: string
  date: string
  /** A due date: when a regular payment or a rate starts, or when the loan moves. */
  due: string
  every: 'month' | 'year'
  until: string
  effect: ExtraPayment['effect']
  rate: RateTexts
  lender: string
  instalments: string
  costs: CostTexts
}

/** A new block of the kind, on the due date given and, for a move, over the instalments the old loan has left then. */
export function blankChange(id: number, kind: LoanChange['kind'], due: CivilDate | null, instalments: number | null): ChangeTexts {
  return {
    id,
    kind,
    amount: '',
    date: kind === 'extra-payment' ? (due ?? '') : '',
    due: due ?? '',
    every: 'month',
    until: '',
    effect: 'shorter-term',
    rate: { rate: '', rateType: kind === 'move' ? 'fixed' : 'variable' },
    lender: '',
    instalments: instalments === null ? '' : String(instalments),
    costs: costTexts(null),
  }
}

export function changeTextsOf(id: number, change: LoanChange): ChangeTexts {
  const blank = blankChange(id, change.kind, null, null)
  switch (change.kind) {
    case 'extra-payment':
      return { ...blank, amount: plainAmount(change.amount), date: change.date, effect: change.effect }
    case 'regular-extra-payment':
      return { ...blank, amount: plainAmount(change.amount), due: change.from, every: change.every, until: change.until ?? '', effect: change.effect }
    case 'rate-change':
      return { ...blank, due: change.from, rate: { rate: rateText(change.rate), rateType: change.rateType } }
    case 'move':
      return {
        ...blank,
        due: change.on,
        lender: change.lender,
        rate: { rate: rateText(change.rate), rateType: change.rateType },
        instalments: String(change.instalments),
        costs: costTexts(change.costs),
      }
    case 'term-change':
      return { ...blank, due: change.from, instalments: String(change.instalments) }
  }
}

/** What is wrong with each field a change of its kind shows, or null where nothing is. */
export interface ChangeFaults {
  readonly amount?: 'no-amount' | null
  readonly date?: 'no-date' | 'before-payout' | null
  readonly due?: 'no-due' | null
  /** The last regular payment does not read as a day on or after the first. */
  readonly until?: 'before-start' | null
  readonly rate?: 'no-rate' | null
  readonly instalments?: 'no-count' | 'too-many' | null
  readonly costs?: CostFaults
}

/** What a change may hold: the day its loan is paid out and the due dates a change can start on. */
export interface ChangeRules {
  readonly drawdown: CivilDate
  readonly dues: ReadonlySet<string>
}

/** The change the fields give, or null while one is wrong, with what is wrong with each. */
export function typedChange(texts: ChangeTexts, rules: ChangeRules): { readonly change: LoanChange | null; readonly faults: ChangeFaults } {
  const amount = typedAmount(texts.amount)
  const positive = amount !== null && amount > 0 ? amount : null
  const due = rules.dues.has(texts.due) ? parseCivilDate(texts.due) : null
  const dueFault = due === null ? 'no-due' : null
  const amountFault = positive === null ? 'no-amount' : null
  const rate = typedRate(texts.rate.rate)
  const rateFault = rate === null ? 'no-rate' : null
  const instalmentsOf = (): { readonly instalments: number | null; readonly fault: 'no-count' | 'too-many' | null } => {
    const instalments = typedCount(texts.instalments)
    return { instalments, fault: instalments === null ? 'no-count' : instalments > MOST_INSTALMENTS ? 'too-many' : null }
  }
  switch (texts.kind) {
    case 'extra-payment': {
      const date = parseCivilDate(texts.date)
      const dateFault = date === null ? 'no-date' : date < rules.drawdown ? 'before-payout' : null
      return {
        change: positive === null || date === null || dateFault !== null ? null : { kind: 'extra-payment', date, amount: positive, effect: texts.effect },
        faults: { amount: amountFault, date: dateFault },
      }
    }
    case 'regular-extra-payment': {
      const until = texts.until === '' ? null : parseCivilDate(texts.until)
      const untilFault = texts.until !== '' && (until === null || (due !== null && until < due)) ? 'before-start' : null
      return {
        change: positive === null || due === null || untilFault !== null ? null : { kind: 'regular-extra-payment', from: due, every: texts.every, until, amount: positive, effect: texts.effect },
        faults: { amount: amountFault, due: dueFault, until: untilFault },
      }
    }
    case 'rate-change':
      return { change: due === null || rate === null ? null : { kind: 'rate-change', from: due, rate, rateType: texts.rate.rateType }, faults: { due: dueFault, rate: rateFault } }
    case 'move': {
      const { instalments, fault } = instalmentsOf()
      const { costs, faults } = typedCosts(texts.costs)
      return {
        change:
          due === null || rate === null || instalments === null || fault !== null || costs === null
            ? null
            : { kind: 'move', on: due, lender: texts.lender.trim(), rate, rateType: texts.rate.rateType, instalments, costs },
        faults: { due: dueFault, rate: rateFault, instalments: fault, costs: faults },
      }
    }
    case 'term-change': {
      const { instalments, fault } = instalmentsOf()
      return {
        change: due === null || instalments === null || fault !== null ? null : { kind: 'term-change', from: due, instalments },
        faults: { due: dueFault, instalments: fault },
      }
    }
  }
}
