import type { LoanChange, LoanCosts } from '../domain/loanScenario'
import { rateText, typedRate } from '../../bankLoans/domain/yearlyRate'
import { typedCount } from '../../bankLoans/presentation/typedCount'
import { words as bankWords } from '../../bankLoans/presentation/words'
import type { ExtraPayment } from '../../workbook/domain/extraPayment'
import type { RatePeriod } from '../../workbook/domain/ratePeriod'
import { words as loansWords } from '../../words'
import { words } from './words'
import { civilDate, parseCivilDate } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { ZERO, plainAmount } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import { typedAmount } from '../../../../shared/money/typedAmount'

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

/** The costs the fields give, blank as nothing, or null while one is not an amount of zero or more. */
export function typedCosts(texts: CostTexts): { readonly costs: LoanCosts | null; readonly errors: Readonly<Record<keyof CostTexts, string | null>> } {
  const typed = (text: string) => (text.trim() === '' ? ZERO : typedAmount(text))
  const upfront = typed(texts.upfront)
  const monthly = typed(texts.monthly)
  const yearly = typed(texts.yearly)
  const error = (amount: typeof upfront): string | null => (amount === null || amount < 0 ? words.editor.costError : null)
  return {
    costs: upfront === null || monthly === null || yearly === null || upfront < 0 || monthly < 0 || yearly < 0 ? null : { upfront, monthly, yearly },
    errors: { upfront: error(upfront), monthly: error(monthly), yearly: error(yearly) },
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
  }
}

export type ChangeErrors = Readonly<Partial<Record<'amount' | 'date' | 'due' | 'until' | 'rate' | 'instalments' | keyof CostTexts, string | null>>>

/** What a change may hold: the day its loan is paid out and the due dates a change can start on. */
export interface ChangeRules {
  readonly drawdown: CivilDate
  readonly dues: ReadonlySet<string>
}

const EXAMPLE_DAY = civilDate(2027, 3, 1)

/** The change the fields give, or null while one is wrong, with why each is. */
export function typedChange(texts: ChangeTexts, rules: ChangeRules): { readonly change: LoanChange | null; readonly errors: ChangeErrors } {
  const amount = typedAmount(texts.amount)
  const positive = amount !== null && amount > 0 ? amount : null
  const due = rules.dues.has(texts.due) ? parseCivilDate(texts.due) : null
  const dueError = due === null ? words.editor.dueError : null
  const amountError = positive === null ? loansWords.form.anAmount : null
  const rate = typedRate(texts.rate.rate)
  const rateError = rate === null ? bankWords.rateFields.rateError : null
  switch (texts.kind) {
    case 'extra-payment': {
      const date = parseCivilDate(texts.date)
      const dateError = date === null ? loansWords.form.aDate(EXAMPLE_DAY) : date < rules.drawdown ? bankWords.extraDialog.afterPayout : null
      return {
        change: positive === null || date === null || dateError !== null ? null : { kind: 'extra-payment', date, amount: positive, effect: texts.effect },
        errors: { amount: amountError, date: dateError },
      }
    }
    case 'regular-extra-payment': {
      const until = texts.until === '' ? null : parseCivilDate(texts.until)
      const untilError = texts.until !== '' && (until === null || (due !== null && until < due)) ? words.editor.untilError : null
      return {
        change: positive === null || due === null || untilError !== null ? null : { kind: 'regular-extra-payment', from: due, every: texts.every, until, amount: positive, effect: texts.effect },
        errors: { amount: amountError, due: dueError, until: untilError },
      }
    }
    case 'rate-change':
      return { change: due === null || rate === null ? null : { kind: 'rate-change', from: due, rate, rateType: texts.rate.rateType }, errors: { due: dueError, rate: rateError } }
    case 'move': {
      const instalments = typedCount(texts.instalments)
      const instalmentsError = instalments === null ? bankWords.loanDialog.instalmentsError : instalments > 600 ? bankWords.loanDialog.tooMany : null
      const { costs, errors } = typedCosts(texts.costs)
      return {
        change:
          due === null || rate === null || instalments === null || instalmentsError !== null || costs === null
            ? null
            : { kind: 'move', on: due, lender: texts.lender.trim(), rate, rateType: texts.rate.rateType, instalments, costs },
        errors: { due: dueError, rate: rateError, instalments: instalmentsError, ...errors },
      }
    }
  }
}
