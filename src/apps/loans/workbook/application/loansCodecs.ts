import { BANK_LOAN_CODEC } from '../domain/bankLoanReading'
import { EXTRA_PAYMENT_CODEC } from '../domain/extraPaymentReading'
import { INFORMAL_LOAN_CODEC } from '../domain/informalLoanReading'
import { LATE_INSTALMENT_CODEC } from '../domain/lateInstalmentReading'
import { MOVEMENT_CODEC } from '../domain/movementReading'
import { RATE_PERIOD_CODEC } from '../domain/ratePeriodReading'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import type { RecordKind } from '../../../../shared/storage/domain/recordKind'

const LOANS_CODECS = [BANK_LOAN_CODEC, RATE_PERIOD_CODEC, EXTRA_PAYMENT_CODEC, LATE_INSTALMENT_CODEC, INFORMAL_LOAN_CODEC, MOVEMENT_CODEC] as readonly RecordCodec<unknown>[]

/** The codec of a Loans kind. Throws for a kind the Loans file does not keep. */
export function codecOfLoansKind<R>(kind: RecordKind<R>): RecordCodec<R> {
  const codec = LOANS_CODECS.find((candidate) => candidate.kind.name === kind.name)
  if (codec === undefined) {
    throw new Error(`The Loans file keeps no ${kind.noun.en.many}.`)
  }
  return codec as RecordCodec<R>
}
