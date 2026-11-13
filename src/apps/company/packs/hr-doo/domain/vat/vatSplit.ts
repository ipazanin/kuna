import type { VatOnPrivateShare } from '../../../../owner-share/domain/ownerParts'
import { ownerPartOf } from '../../../../owner-share/domain/ownerShare'
import type { OwnerShare } from '../../../../owner-share/domain/ownerShare'
import type { Booking, Category } from '../../../../workbook/domain/workbook'
import type { VatTreatment } from '../../../../workbook/domain/vatTreatment'
import { ZERO, addMoney, negateMoney, subtractMoney } from '../../../../../../shared/money/money'
import type { Money } from '../../../../../../shared/money/money'
import { moneyAt, moneyInside, percentFromWhole, percentText } from '../../../../../../shared/money/percent'
import type { Percent } from '../../../../../../shared/money/percent'
import { hasVersionOn, ruleValue } from '../../ruleset/ruleset'
import type { RuleId, RuleValues } from '../../ruleset/ruleset'
import type { RuleCitation } from '../../ruleset/schema'
import type { TracedFigure } from '../../ruleset/tracedFigure'
import { deducted, rulesOf, tracedFigure } from '../payroll/payrollArithmetic'
import type { RuleSource } from '../payroll/payrollArithmetic'
import { PACK_ROLES } from '../packRoles'
import { words } from './words'

/** A booking's amount as the accountant books it: the cost, and the input VAT the company gets back on its return. */
export interface VatSplit {
  readonly treatment: VatTreatment
  /** The amount less its deductible VAT. VAT the company cannot deduct stays in it, and the VAT the reverse charge self-charges on a private share is added to it. */
  readonly cost: TracedFigure
  /**
   * A claim on the state rather than a cost, zero when nothing is deductible. It carries the
   * booking's sign, except for the VAT the reverse charge self-charges on a private share, which
   * the company owes and which carries the opposite sign. Cost and input VAT add up to the amount.
   */
  readonly inputVat: TracedFigure
  /**
   * The VAT the company paid or owes and cannot deduct, which is part of the cost, with the
   * booking's sign. Zero where the split takes no VAT out of the amount, as for foreign VAT or
   * representation, whose VAT stays in the amount unseen.
   */
  readonly kept: TracedFigure
}

/** The kept VAT that is there only for the owner's private share, which books that deduct in full would not keep. A personal car keeps its own half whatever the share, so none of its VAT counts. */
export function vatKeptForPrivateShare(split: VatSplit): Money {
  return split.treatment === 'car-50' ? ZERO : split.kept.amount
}

/** The rules the split of a reverse-charged row with a private share reads. */
const REVERSE_CHARGE_RULES: readonly RuleId[] = ['hr.vat.input-deduction', 'hr.vat.rates', 'hr.vat.reverse-charge']

/**
 * The VAT the owner's part of a shared row carries beyond the row: what the reverse charge
 * self-charges on the private share and the company pays with its return, settled in the one
 * category with the VAT settlement role. Null for any other treatment, whose kept VAT the row
 * already holds, on a day the rules do not cover, and without one settlement category.
 */
export const vatOnPrivateShare: VatOnPrivateShare = (row, category, share, categories) => {
  const settlements = categories.filter((candidate) => candidate.roles.includes(PACK_ROLES.vatSettlement))
  const [settlement] = settlements
  if (category.vat !== 'reverse-charge' || settlements.length !== 1 || settlement === undefined || !REVERSE_CHARGE_RULES.every((id) => hasVersionOn(id, row.date))) {
    return null
  }
  const booking: Booking = { date: row.date, amount: row.amount, category: category.slug, family: category.family, bucket: category.bucket }
  return { amount: vatSplit(booking, category, share).kept.amount, settlement }
}

/**
 * Splits a ledger amount by its category's `vat` column, so that cost and input VAT add up to the
 * amount to the cent. The owner's private share is the share the books count on the row, or null.
 * Its VAT is not deductible, and a personal car keeps its own cut unless it is used only
 * privately. The rules are read on the booking's date, which stands for the supply date the bank
 * row does not carry.
 */
export function vatSplit(booking: Booking, category: Category, ownerShare: OwnerShare | null, rules: RuleSource = ruleValue): VatSplit {
  if (booking.category !== category.slug) {
    throw new RangeError(`A ${booking.category || 'blank'} booking cannot be split by the ${category.slug} category.`)
  }
  const { amount } = booking
  const paid = tracedFigure(words.split.paid, amount, 'ledger', [])
  const treatment = category.vat
  const deduction = () => rules('hr.vat.input-deduction', booking.date)
  const privateShare = ownerShare !== null && ownerShare > 0 && deduction().value.mixedUseDeductibleForBusinessShareOnly.holds ? ownerShare : null
  switch (treatment) {
    case 'none':
      return passedThrough(treatment, paid, words.split.none, [])
    case 'reverse-charge': {
      const reverseCharge = rules('hr.vat.reverse-charge', booking.date)
      if (privateShare === null) {
        return passedThrough(treatment, paid, words.split.reverseCharge, [reverseCharge.citation])
      }
      const rates = rules('hr.vat.rates', booking.date)
      const rate = rates.value.standardRate.basisPoints
      const selfCharged = tracedFigure(words.split.selfCharged(percentText(rate)), moneyAt(amount, rate), 'ledger', [rates.citation, reverseCharge.citation], [paid])
      const owed = tracedFigure(words.split.privateShare(percentText(percentFromWhole(privateShare))), ownerPartOf(selfCharged.amount, privateShare), 'ledger', [deduction().citation], [selfCharged])
      const steps = [paid, owed]
      return {
        treatment,
        cost: tracedFigure(words.split.costWithOwed, addMoney(paid.amount, owed.amount), 'ledger', rulesOf(steps), steps),
        inputVat: tracedFigure(words.split.owedOnPrivateShare, negateMoney(owed.amount), 'ledger', owed.rules, [deducted(owed)]),
        kept: owed,
      }
    }
    case 'foreign-vat':
      return passedThrough(treatment, paid, words.split.foreignVat, [rules('hr.vat.reverse-charge', booking.date).citation])
    case 'representation':
      return passedThrough(treatment, paid, words.split.representation, [deduction().citation])
    case 'deductible-25':
    case 'deductible-13':
    case 'deductible-5': {
      const rates = rules('hr.vat.rates', booking.date)
      const rate = rateOf(treatment, rates.value)
      if (privateShare === null) {
        const inputVat = tracedFigure(words.split.deductible(percentText(rate)), moneyInside(amount, rate), 'ledger', [rates.citation, deduction().citation], [paid])
        return split(treatment, paid, inputVat, noneKept())
      }
      const vat = tracedFigure(words.split.inside(percentText(rate)), moneyInside(amount, rate), 'ledger', [rates.citation], [paid])
      const kept = tracedFigure(words.split.privateShare(percentText(percentFromWhole(privateShare))), ownerPartOf(vat.amount, privateShare), 'ledger', [deduction().citation], [vat])
      const steps = [vat, deducted(kept)]
      const inputVat = tracedFigure(words.split.businessShare(percentText(rate)), subtractMoney(vat.amount, kept.amount), 'ledger', rulesOf(steps), steps)
      return split(treatment, paid, inputVat, kept)
    }
    case 'car-50': {
      const rates = rules('hr.vat.rates', booking.date)
      const rate = rates.value.standardRate.basisPoints
      const carRule = deduction()
      const vat = tracedFigure(words.split.inside(percentText(rate)), moneyInside(amount, rate), 'ledger', [rates.citation], [paid])
      if (privateShare === 100) {
        const citations = [rates.citation, carRule.citation]
        return split(treatment, paid, tracedFigure(words.split.noInputVat, ZERO, 'ledger', citations), tracedFigure(words.split.carOnlyPrivate, vat.amount, 'ledger', citations, [vat]))
      }
      const share = carRule.value.personalCarDeductibleShare.basisPoints
      const inputVat = tracedFigure(words.split.car(percentText(share)), moneyAt(vat.amount, share), 'ledger', [rates.citation, carRule.citation], [vat])
      const steps = [vat, deducted(inputVat)]
      return split(treatment, paid, inputVat, tracedFigure(words.split.carKept, subtractMoney(vat.amount, inputVat.amount), 'ledger', rulesOf(steps), steps))
    }
  }
}

/** The VAT inside an amount that includes it, rounded to the cent. */
function rateOf(treatment: 'deductible-25' | 'deductible-13' | 'deductible-5', rates: RuleValues['hr.vat.rates']): Percent {
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
    inputVat: tracedFigure(words.split.noInputVat, ZERO, 'ledger', citations),
    kept: noneKept(),
  }
}

function split(treatment: VatTreatment, paid: TracedFigure, inputVat: TracedFigure, kept: TracedFigure): VatSplit {
  const steps = [paid, deducted(inputVat)]
  return {
    treatment,
    cost: tracedFigure(words.split.cost, subtractMoney(paid.amount, inputVat.amount), 'ledger', rulesOf(steps), steps),
    inputVat,
    kept,
  }
}

function noneKept(): TracedFigure {
  return tracedFigure(words.split.noneKept, ZERO, 'ledger', [])
}
