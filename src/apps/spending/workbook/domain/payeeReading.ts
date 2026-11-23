import { PAYEE_PARTIES } from './payee'
import type { Payee } from './payee'
import { PAYEE_RECORDS } from './spendingKinds'
import { labelWords, withIdField } from '../../../../shared/storage/domain/recordCodec'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import { filledFields } from '../../../../shared/storage/domain/recordFields'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { ownId, requiredChoice, textOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'
import { ibanListOf } from '../../../../shared/text/iban'
import { readEach } from '../../../../shared/storage/domain/recordsRead'
import type { Reading, RecordsRead } from '../../../../shared/storage/domain/recordsRead'
import { payeeProblem } from '../../payees/domain/payeeDetails'
import type { PayeeProblem } from '../../payees/domain/payeeDetails'

/** The names a field holds, one per line, trimmed, blank lines left out. A name may hold a comma, so lines part them. */
function namesOf(text: string): readonly string[] {
  return text
    .split('\n')
    .map((name) => name.trim())
    .filter((name) => name !== '')
}

/** A payee from its fields: its names one per line, its IBANs separated by commas, and a party of person, business or blank. */
export function payeeOf(fields: StoredFields, id: RecordId | null): Payee {
  return {
    id: ownId(id),
    names: namesOf(textOf(fields.names)),
    ibans: ibanListOf(textOf(fields.ibans)),
    party: textOf(fields.party).trim() === '' ? null : requiredChoice(fields, 'party', PAYEE_PARTIES),
    taxId: textOf(fields.tax_id).trim(),
    website: textOf(fields.website).trim(),
    note: textOf(fields.note).trim(),
  }
}

export const PAYEE_CODEC: RecordCodec<Payee> = withIdField(
  PAYEE_RECORDS,
  (fields) => labelWords([namesOf(textOf(fields.names))[0] ?? '']),
  payeeOf,
  (payee) =>
    filledFields({
      names: payee.names.join('\n'),
      ibans: payee.ibans.join(', '),
      party: payee.party,
      tax_id: payee.taxId,
      website: payee.website,
      note: payee.note,
    }),
)

/** Payees count as `payeeProblem` says, each against every other stored payee, so two that share a name or an IBAN both stay out. */
export function readPayees(read: RecordsRead<Payee>, reasonOf: (problem: PayeeProblem) => string): Reading<Payee> {
  const payees = read.records.map((stored) => stored.record)
  return readEach(read, ({ record: payee }) => {
    const problem = payeeProblem(payee, payees)
    return problem === null ? [] : [reasonOf(problem)]
  })
}
