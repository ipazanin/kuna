import type { BankLoan } from './bankLoan'
import type { ExtraPayment } from './extraPayment'
import type { InformalLoan } from './informalLoan'
import type { LateInstalment } from './lateInstalment'
import type { Movement } from './movement'
import type { RatePeriod } from './ratePeriod'
import { recordKind } from '../../../../shared/storage/domain/recordKind'

export const BANK_LOAN_RECORDS = recordKind<BankLoan>('bank-loan', {
  en: { one: 'bank loan', many: 'bank loans', article: 'a' },
  hr: { one: 'kredit', of: 'kredita', few: 'kredita', other: 'kredita', gender: 'masculine' },
})
export const RATE_PERIOD_RECORDS = recordKind<RatePeriod>('rate-period', {
  en: { one: 'rate period', many: 'rate periods', article: 'a' },
  hr: { one: 'razdoblje kamatne stope', of: 'razdoblja kamatne stope', few: 'razdoblja kamatne stope', other: 'razdoblja kamatne stope', gender: 'neuter' },
})
export const EXTRA_PAYMENT_RECORDS = recordKind<ExtraPayment>('extra-payment', {
  en: { one: 'extra payment', many: 'extra payments', article: 'an' },
  hr: { one: 'prijevremena otplata', of: 'prijevremene otplate', few: 'prijevremene otplate', other: 'prijevremenih otplata', gender: 'feminine' },
})
export const LATE_INSTALMENT_RECORDS = recordKind<LateInstalment>('late-instalment', {
  en: { one: 'late instalment', many: 'late instalments', article: 'a' },
  hr: { one: 'zakašnjeli anuitet', of: 'zakašnjelog anuiteta', few: 'zakašnjela anuiteta', other: 'zakašnjelih anuiteta', gender: 'masculine' },
})
export const INFORMAL_LOAN_RECORDS = recordKind<InformalLoan>('informal-loan', {
  en: { one: 'informal loan', many: 'informal loans', article: 'an' },
  hr: { one: 'pozajmica', of: 'pozajmice', few: 'pozajmice', other: 'pozajmica', gender: 'feminine' },
})
export const MOVEMENT_RECORDS = recordKind<Movement>('movement', {
  en: { one: 'movement', many: 'movements', article: 'a' },
  hr: { one: 'promjena', of: 'promjene', few: 'promjene', other: 'promjena', gender: 'feminine' },
})
