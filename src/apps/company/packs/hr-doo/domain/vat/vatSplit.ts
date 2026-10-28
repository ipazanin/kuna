import type { Booking, Category } from '../../../../workbook/domain/workbook'
import type { VatTreatment } from '../../../../workbook/domain/vatTreatment'
import { ZERO, subtractMoney } from '../../../../../../shared/money/money'
import type { Money } from '../../../../../../shared/money/money'
import { ruleValue } from '../../ruleset/ruleset'
import type { RuleValues } from '../../ruleset/ruleset'
import type { Rate, RuleCitation } from '../../ruleset/schema'
import type { TracedFigure } from '../../ruleset/tracedFigure'
import { atRate, deducted, percentText, prorated, rulesOf, tracedFigure } from '../payroll/payrollArithmetic'
import type { RuleSource } from '../payroll/payrollArithmetic'

/** A booking's amount as the accountant books it: the cost, and the input VAT the company gets back on its return. */
export interface VatSplit {
  readonly treatment: VatTreatment
  /** The amount less its deductible VAT. VAT the company cannot deduct stays in it. */
  readonly cost: TracedFigure
  /** A claim on the state rather than a cost, zero when nothing is deductible. Both parts carry the booking's sign and add up to its amount. */
  readonly inputVat: TracedFigure
}

const BASIS_POINTS_PER_WHOLE = 10_000

/**
 * Splits a ledger amount by its category's `vat` column, so that cost and input VAT add up to the
 * amount to the cent. The rules are read on the booking's date, which stands for the supply date
 * the bank row does not carry.
 */
export function vatSplit(booking: Booking, category: Category, rules: RuleSource = ruleValue): VatSplit {
  if (booking.category !== category.slug) {
    throw new RangeError(`A ${booking.category || 'blank'} booking cannot be split by the ${category.slug} category.`)
  }
  const { amount } = booking
  const paid = tracedFigure('Amount paid', amount, 'ledger', [])
  const treatment = category.vat
  switch (treatment) {
    case 'none':
      return passedThrough(treatment, paid, 'No VAT in the amount', [])
    case 'reverse-charge':
      return passedThrough(treatment, paid, 'Reverse charge: no VAT in the amount, and the VAT on the return cancels out', [
        rules('hr.vat.reverse-charge', booking.date).citation,
      ])
    case 'foreign-vat':
      return passedThrough(treatment, paid, 'Foreign VAT, not deductible in Croatia, stays in the cost', [
        rules('hr.vat.reverse-charge', booking.date).citation,
      ])
    case 'representation':
      return passedThrough(treatment, paid, 'Representation: its VAT is not deductible and stays in the cost', [
        rules('hr.vat.input-deduction', booking.date).citation,
      ])
    case 'deductible-25':
    case 'deductible-13':
    case 'deductible-5': {
      const rates = rules('hr.vat.rates', booking.date)
      const deduction = rules('hr.vat.input-deduction', booking.date)
      const rate = rateOf(treatment, rates.value)
      const inputVat = tracedFigure(`Input VAT at ${percentText(rate)}, deductible`, vatInside(amount, rate), 'ledger', [
        rates.citation,
        deduction.citation,
      ], [paid])
      return split(treatment, paid, inputVat)
    }
    case 'car-50': {
      const rates = rules('hr.vat.rates', booking.date)
      const deduction = rules('hr.vat.input-deduction', booking.date)
      const rate = rates.value.standardRate.basisPoints
      const share = deduction.value.personalCarDeductibleShare.basisPoints
      const vat = tracedFigure(`VAT at ${percentText(rate)} inside the amount`, vatInside(amount, rate), 'ledger', [rates.citation], [paid])
      const inputVat = tracedFigure(`Input VAT on a personal car, ${percentText(share)} deductible`, atRate(vat.amount, share), 'ledger', [
        rates.citation,
        deduction.citation,
      ], [vat])
      return split(treatment, paid, inputVat)
    }
  }
}

/** The VAT inside an amount that includes it, rounded to the cent. */
function vatInside(amount: Money, rate: Rate): Money {
  return prorated(amount, rate, BASIS_POINTS_PER_WHOLE + rate)
}

function rateOf(treatment: 'deductible-25' | 'deductible-13' | 'deductible-5', rates: RuleValues['hr.vat.rates']): Rate {
  switch (treatment) {
    case 'deductible-25':
      return rates.standardRate.basisPoints
    case 'deductible-13':
      return rates.reducedRate.basisPoints
    case 'deductible-5':
      return rates.lowestRate.basisPoints
  }
}

function passedThrough(treatment: VatTreatment, paid: TracedFigure, label: string, citations: readonly RuleCitation[]): VatSplit {
  return {
    treatment,
    cost: tracedFigure(label, paid.amount, 'ledger', citations, [paid]),
    inputVat: tracedFigure('No deductible input VAT', ZERO, 'ledger', citations),
  }
}

function split(treatment: VatTreatment, paid: TracedFigure, inputVat: TracedFigure): VatSplit {
  const steps = [paid, deducted(inputVat)]
  return {
    treatment,
    cost: tracedFigure('Cost without the deductible VAT', subtractMoney(paid.amount, inputVat.amount), 'ledger', rulesOf(steps), steps),
    inputVat,
  }
}
