import type { CashMovement } from './cashMovement'
import type { Exchange } from './exchange'
import type { HandPrice } from './handPrice'
import type { Income } from './income'
import type { Instrument } from './instrument'
import type { InvestmentAccount } from './investmentAccount'
import type { SpinOff } from './spinOff'
import type { Split } from './split'
import type { Trade } from './trade'
import type { Transfer } from './transfer'
import { recordKind } from '../../../../shared/storage/domain/recordKind'

export const INVESTMENT_ACCOUNT_RECORDS = recordKind<InvestmentAccount>('investment-account', {
  en: { one: 'investment account', many: 'investment accounts', article: 'an' },
  hr: { one: 'investicijski račun', of: 'investicijskog računa', few: 'investicijska računa', other: 'investicijskih računa', gender: 'masculine' },
})
export const INSTRUMENT_RECORDS = recordKind<Instrument>('instrument', {
  en: { one: 'instrument', many: 'instruments', article: 'an' },
  hr: { one: 'instrument', of: 'instrumenta', few: 'instrumenta', other: 'instrumenata', gender: 'masculine' },
})
export const TRADE_RECORDS = recordKind<Trade>('trade', {
  en: { one: 'trade', many: 'trades', article: 'a' },
  hr: { one: 'transakcija', of: 'transakcije', few: 'transakcije', other: 'transakcija', gender: 'feminine' },
})
export const INCOME_RECORDS = recordKind<Income>('income', {
  en: { one: 'income payment', many: 'income payments', article: 'an' },
  hr: { one: 'primitak', of: 'primitka', few: 'primitka', other: 'primitaka', gender: 'masculine' },
})
export const CASH_MOVEMENT_RECORDS = recordKind<CashMovement>('cash-movement', {
  en: { one: 'cash movement', many: 'cash movements', article: 'a' },
  hr: { one: 'kretanje novca', of: 'kretanja novca', few: 'kretanja novca', other: 'kretanja novca', gender: 'neuter' },
})
export const EXCHANGE_RECORDS = recordKind<Exchange>('exchange', {
  en: { one: 'exchange', many: 'exchanges', article: 'an' },
  hr: { one: 'konverzija valute', of: 'konverzije valute', few: 'konverzije valute', other: 'konverzija valute', gender: 'feminine' },
})
export const TRANSFER_RECORDS = recordKind<Transfer>('transfer', {
  en: { one: 'transfer', many: 'transfers', article: 'a' },
  hr: { one: 'prijenos', of: 'prijenosa', few: 'prijenosa', other: 'prijenosa', gender: 'masculine' },
})
export const SPLIT_RECORDS = recordKind<Split>('split', {
  en: { one: 'split', many: 'splits', article: 'a' },
  hr: { one: 'podjela dionica', of: 'podjele dionica', few: 'podjele dionica', other: 'podjela dionica', gender: 'feminine' },
})
export const SPIN_OFF_RECORDS = recordKind<SpinOff>('spin-off', {
  en: { one: 'spin-off', many: 'spin-offs', article: 'a' },
  hr: { one: 'izdvajanje', of: 'izdvajanja', few: 'izdvajanja', other: 'izdvajanja', gender: 'neuter' },
})
export const PRICE_RECORDS = recordKind<HandPrice>('price', {
  en: { one: 'price', many: 'prices', article: 'a' },
  hr: { one: 'cijena', of: 'cijene', few: 'cijene', other: 'cijena', gender: 'feminine' },
})
