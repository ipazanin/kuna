/** What a camt statement said about an entry beyond its money. Every field is blank on a row from a statement PDF or typed by hand. */
export interface TransactionSignals {
  readonly purpose: string
  readonly txDomain: string
  readonly txFamily: string
  readonly txSubFamily: string
  readonly creditorReference: string
  readonly instructedCurrency: string
}
