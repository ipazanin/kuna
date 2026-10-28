import type { BankLoan } from './bankLoan'
import type { ExtraPayment } from './extraPayment'
import type { InformalLoan } from './informalLoan'
import type { LateInstalment } from './lateInstalment'
import type { Movement } from './movement'
import type { RatePeriod } from './ratePeriod'
import { recordKind } from '../../../../shared/storage/domain/recordKind'

export const BANK_LOAN_RECORDS = recordKind<BankLoan>('bank-loan', 'bank loan', 'bank loans')
export const RATE_PERIOD_RECORDS = recordKind<RatePeriod>('rate-period', 'rate period', 'rate periods')
export const EXTRA_PAYMENT_RECORDS = recordKind<ExtraPayment>('extra-payment', 'extra payment', 'extra payments', 'an')
export const LATE_INSTALMENT_RECORDS = recordKind<LateInstalment>('late-instalment', 'late instalment', 'late instalments')
export const INFORMAL_LOAN_RECORDS = recordKind<InformalLoan>('informal-loan', 'informal loan', 'informal loans', 'an')
export const MOVEMENT_RECORDS = recordKind<Movement>('movement', 'movement', 'movements')
