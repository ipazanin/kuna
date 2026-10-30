import { CASH_MOVEMENT_KINDS } from './cashMovement'
import type { CashMovement } from './cashMovement'
import { decimalField, importKeyOf, namedAccount, positiveDecimal, rateFor, requiredCurrency } from './investmentFields'
import { CASH_MOVEMENT_RECORDS, INVESTMENT_ACCOUNT_RECORDS } from './investmentKinds'
import { words } from './words'
import { withIdField } from '../../../../shared/storage/domain/recordCodec'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import { filledFields } from '../../../../shared/storage/domain/recordFields'
import { keyOfRecordId } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { ownId, requiredChoice, requiredDate, textOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'

export function cashMovementOf(fields: StoredFields, id: RecordId | null): CashMovement {
  const currency = requiredCurrency(fields, 'currency')
  return {
    id: ownId(id),
    account: namedAccount(fields, 'account'),
    kind: requiredChoice(fields, 'kind', CASH_MOVEMENT_KINDS, 'kind of cash movement'),
    date: requiredDate(fields, 'date'),
    currency,
    amount: positiveDecimal(fields, 'amount'),
    rate: rateFor(fields, currency),
    importKey: importKeyOf(fields),
    note: textOf(fields.note),
  }
}

export const CASH_MOVEMENT_CODEC: RecordCodec<CashMovement> = withIdField(CASH_MOVEMENT_RECORDS, words.labels.cashMovement, cashMovementOf, (movement) =>
  filledFields({
    account: keyOfRecordId(INVESTMENT_ACCOUNT_RECORDS, movement.account),
    kind: movement.kind,
    date: movement.date,
    currency: movement.currency,
    amount: decimalField(movement.amount),
    rate: decimalField(movement.rate),
    import_key: movement.importKey,
    note: movement.note,
  }),
)
