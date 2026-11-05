import type { Money } from '../../money/money'
import { foldRuleText, normaliseIban } from '../../text/fold'

/** What the rules know besides the row itself. */
export interface CategorisationContext {
  /** The owner's own account IBANs, normalised. */
  readonly ownIbans: ReadonlySet<string>
  /** Every client's IBAN, normalised. */
  readonly clientIbans: ReadonlySet<string>
  /**
   * The bank accounts a card purchase settles against, normalised. A PDF-era card row names one of
   * these as its counterparty instead of the merchant.
   */
  readonly cardSettlementIbans: ReadonlySet<string>
  /** Each account's currency, upper case. An account not listed counts in `workbookCurrency`. */
  readonly accountCurrencies: ReadonlyMap<string, string>
  readonly workbookCurrency: string
}

/** What a camt statement said about an entry beyond its money. Every field is blank on a row from a statement PDF or typed by hand. */
export interface TransactionSignals {
  readonly purpose: string
  readonly txDomain: string
  readonly txFamily: string
  readonly txSubFamily: string
  readonly creditorReference: string
  readonly instructedCurrency: string
}

/** The fields of a bank row the rules read. Each app's own row type carries them. */
export interface CategorisableRow {
  readonly account: string
  readonly amount: Money
  readonly counterparty: string
  readonly counterpartyIban: string
  readonly description: string
  readonly signals: TransactionSignals
}

/** Everything a rule can test about one transaction, worked out once rather than per rule. */
export interface TransactionFacts {
  readonly isCredit: boolean
  readonly counterpartyIban: string
  readonly hasCounterpartyIban: boolean
  readonly ownAccount: boolean
  readonly clientAccount: boolean
  readonly counterparty: string
  readonly description: string
  readonly txDomain: string
  readonly txFamily: string
  readonly txSubFamily: string
  readonly purpose: string
  readonly revenueCode: string
  readonly isCard: boolean
  readonly foreignCurrency: boolean
}

export function transactionFacts(transaction: CategorisableRow, context: CategorisationContext): TransactionFacts {
  const description = foldRuleText(transaction.description)
  const counterpartyIban = normaliseIban(transaction.counterpartyIban)
  const { signals } = transaction
  return {
    // The ledger holds one signed amount, credits positive, so a zero amount reads as a debit.
    isCredit: transaction.amount > 0,
    counterpartyIban,
    hasCounterpartyIban: counterpartyIban !== '',
    ownAccount: counterpartyIban !== '' && context.ownIbans.has(counterpartyIban),
    clientAccount: counterpartyIban !== '' && context.clientIbans.has(counterpartyIban),
    counterparty: foldRuleText(transaction.counterparty),
    description,
    txDomain: foldRuleText(signals.txDomain),
    txFamily: foldRuleText(signals.txFamily),
    txSubFamily: foldRuleText(signals.txSubFamily),
    purpose: foldRuleText(signals.purpose),
    revenueCode: budgetRevenueCode(signals.creditorReference, description),
    isCard: isCardTransaction(signals, counterpartyIban, description, context),
    foreignCurrency: isForeignCurrency(signals, description, context.accountCurrencies.get(transaction.account) ?? context.workbookCurrency),
  }
}

/**
 * The four-digit revenue code of a payment to the state budget: from the structured creditor
 * reference (`HR68 1651-...`) when there is one, else from the head of the folded description.
 * Only the head, since a four-digit number elsewhere is far likelier an invoice number.
 */
export function budgetRevenueCode(creditorReference: string, foldedDescription: string): string {
  const referenceCode =
    creditorReference
      .toUpperCase()
      .replace(/\s+/g, '')
      .replace(/^HR\d{2}/, '')
      .split('-')[0] ?? ''
  if (/^\d{4}$/.test(referenceCode)) {
    return referenceCode
  }
  return /^(\d{4})\b/.exec(foldedDescription)?.[1] ?? ''
}

/**
 * A card purchase: the ISO code says so, the counterparty is a card settlement account, the folded
 * description heads with a masked card number, or it carries a PDF statement's card line. The ISO
 * codes are compared as stored, without folding.
 */
export function isCardTransaction(
  signals: Pick<TransactionSignals, 'txDomain' | 'txFamily'>,
  counterpartyIban: string,
  foldedDescription: string,
  context: Pick<CategorisationContext, 'cardSettlementIbans'>,
): boolean {
  if (signals.txDomain === 'PMNT' && signals.txFamily === 'CCRD') {
    return true
  }
  if (context.cardSettlementIbans.has(counterpartyIban)) {
    return true
  }
  if (/^\d{6}X{6}\d{4},/.test(foldedDescription)) {
    return true
  }
  return foldedDescription.includes('POS KUPOVINA')
}

/** A payment in a currency other than the account's: the instructed currency, else the currency field of a PDF card line. */
export function isForeignCurrency(signals: Pick<TransactionSignals, 'instructedCurrency'>, foldedDescription: string, accountCurrency: string): boolean {
  const currency = foldRuleText(signals.instructedCurrency) || postedCurrency(foldedDescription)
  return currency !== '' && currency !== accountCurrency
}

/**
 * The currency of a PDF card line, `POS KUPOVINA/03.04/GBP/312,40`, read as that field and not as a
 * bare code anywhere in the text, which a merchant's name could carry.
 */
export function postedCurrency(foldedDescription: string): string {
  return /POS KUPOVINA\/\d{2}\.\d{2}\/([A-Z]{3})\//.exec(foldedDescription)?.[1] ?? ''
}
