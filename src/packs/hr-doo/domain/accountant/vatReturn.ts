import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { MonthKey } from '../../../../shared/calendar/monthKey'
import type { Money } from '../../../../shared/money/money'

export interface VatAmounts {
  readonly base: Money
  readonly vat: Money
}

/** A service sold outside the EU, one line of the return's sales tab. */
export interface VatSale {
  readonly invoiceNumber: string
  readonly issued: CivilDate
  readonly amount: Money
}

/**
 * A monthly VAT return as the accountant prepared it, with every figure as the return states it.
 * Services bought from the EU and from outside it, and goods bought from the EU, are reverse
 * charged, so they sit on both sides and cancel.
 */
export interface VatReturn {
  readonly period: MonthKey
  readonly salesOutsideEu: readonly VatSale[]
  /** Sales in Croatia, whose VAT the company owes. Zero when the return has no such tab. */
  readonly localSales: VatAmounts
  readonly localPurchases: VatAmounts
  /** Zero when the return has no such tab. */
  readonly euGoods: VatAmounts
  /** Zero when the return has no such tab. */
  readonly euServices: VatAmounts
  /** Zero when the return has no such tab. */
  readonly thirdCountryServices: VatAmounts
  readonly outputVat: Money
  readonly inputVat: Money
  /** Output VAT less input VAT. Negative when the company paid more VAT than it charged. */
  readonly difference: Money
  /** The overpayment brought from earlier periods, negative as the return states it. */
  readonly broughtForward: Money
  /** The difference with the overpayment brought forward, negative while the state owes the company. */
  readonly carriedForward: Money
}
