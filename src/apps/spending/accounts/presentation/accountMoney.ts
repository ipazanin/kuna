import type { CurrencyCode } from '../../../../shared/money/currencyCode'
import type { Money } from '../../../../shared/money/money'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import type { SignDisplay } from '../../../../shared/money/moneyFormat'
import { intlLocale } from '../../../../shared/text/language'

/** An amount in an account's own currency, in the language's format, such as $170.00. */
export function formatAccountMoney(cents: Money, currency: CurrencyCode, sign: SignDisplay = 'negative'): string {
  return formatMoney(cents, sign, { currency, locale: intlLocale })
}
