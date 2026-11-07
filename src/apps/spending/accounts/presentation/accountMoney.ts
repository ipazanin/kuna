import type { AccountMoney } from '../../../../shared/money/accountMoney'
import type { CurrencyCode } from '../../../../shared/money/currencyCode'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import type { SignDisplay } from '../../../../shared/money/moneyFormat'
import { intlLocale } from '../../../../shared/text/language'

/** An amount in an account's own currency, in the language's format, such as $170.00. */
export function formatAccountMoney(cents: AccountMoney, currency: CurrencyCode, sign: SignDisplay = 'negative'): string {
  return formatMoney(cents, sign, { currency, locale: intlLocale })
}
