import type { CategorisationContext } from '../../../../shared/categorising/domain/transactionFacts'
import type { Settings } from '../../settings/domain/settings'
import type { Account, Client } from '../../workbook/domain/workbook'

/** The context a workbook gives the rules: its own IBANs and currencies, its clients' IBANs, and the card settlement accounts from its settings. */
export function categorisationContextOf(workbook: {
  readonly accounts: readonly Account[]
  readonly clients: readonly Client[]
  readonly settings: Pick<Settings, 'currency' | 'cardSettlementIbans'>
}): CategorisationContext {
  return {
    ownIbans: new Set(workbook.accounts.map((account) => account.iban).filter((iban) => iban !== '')),
    clientIbans: new Set(workbook.clients.flatMap((client) => client.ibans)),
    cardSettlementIbans: new Set(workbook.settings.cardSettlementIbans),
    accountCurrencies: new Map(workbook.accounts.filter((account) => account.currency !== '').map((account) => [account.slug, account.currency.toUpperCase()])),
    workbookCurrency: workbook.settings.currency.toUpperCase(),
  }
}
