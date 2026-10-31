import { problemOf, refusedProblems } from '../../../../../../shared/storage/domain/recordsRead'
import type { Reading, RecordProblem, RecordsRead } from '../../../../../../shared/storage/domain/recordsRead'
import { addMoney, plainAmount } from '../../../../../../shared/money/money'
import { GRANT_RELEASES } from './grants'
import type { Grant, GrantClawback, GrantParts, GrantRelease } from './grants'
import { filledKey, labelWords } from '../../../../../../shared/storage/domain/recordCodec'
import type { RecordCodec } from '../../../../../../shared/storage/domain/recordCodec'
import { amountText, filledFields } from '../../../../../../shared/storage/domain/recordFields'
import { recordIdOf } from '../../../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../../../shared/storage/domain/recordId'
import { GRANT_RECORDS } from '../hrDooKinds'
import { sharedKeys } from '../../../../../../shared/storage/domain/sharedKeys'
import { keyedId, optionalDate, optionalMoney, optionalPeriod, positiveMoney, refuse, requiredChoice, requiredDate, slugOf, textOf } from '../../../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../../../shared/storage/domain/storedFields'
import { words } from '../words'

const DEFAULT_RELEASE: GrantRelease = 'fixed-then-assets'

/** A grant made from its fields as an editor makes one, with the id its name makes. */
export function grantOfFields(fields: StoredFields): Grant {
  return grantOf(fields, recordIdOf(GRANT_RECORDS, slugOf(fields.grant)))
}

export function grantOf(fields: StoredFields, id: RecordId | null): Grant {
  const slug = slugOf(fields.grant)
  if (slug === '') refuse(words.reading.noGrantName)
  const received = requiredDate(fields, 'received')
  const amount = positiveMoney(fields, 'amount')
  const parts = partsOf(fields, amount)
  const period = optionalPeriod(fields, 'period_from', 'period_to')
  const release = fields.release === undefined ? DEFAULT_RELEASE : requiredChoice(fields, 'release', GRANT_RELEASES)
  if (release === 'fixed-then-assets' && parts === null) refuse(words.reading.fixedThenAssetsNeedsParts)
  if (release === 'straight-line' && period === null) refuse(words.reading.straightLineNeedsPeriod)
  return {
    slug,
    received,
    amount,
    parts,
    period,
    release,
    clawbackFirstYear: clawbackOf(fields, 'clawback_year1'),
    clawbackSecondYear: clawbackOf(fields, 'clawback_year2'),
    employmentRequiredUntil: optionalDate(fields, 'employment_required_until'),
    note: textOf(fields.note),
    id: keyedId(id),
  }
}

/** A clawback as its field: whole, an amount, or blank. */
function clawbackText(clawback: GrantClawback | null): string | null {
  return clawback === null || clawback === 'whole' ? clawback : amountText(clawback)
}

export const GRANT_CODEC: RecordCodec<Grant> = {
  kind: GRANT_RECORDS,
  key: (fields) => filledKey(slugOf(fields.grant)),
  label: (fields) => labelWords([textOf(fields.grant)]),
  make: grantOf,
  fieldsOf: (grant) =>
    filledFields({
      grant: grant.slug,
      received: grant.received,
      amount: amountText(grant.amount),
      fixed_part: grant.parts === null ? null : amountText(grant.parts.fixed),
      variable_part: grant.parts === null ? null : amountText(grant.parts.variable),
      period_from: grant.period?.from,
      period_to: grant.period?.to,
      release: grant.release,
      clawback_year1: clawbackText(grant.clawbackFirstYear),
      clawback_year2: clawbackText(grant.clawbackSecondYear),
      employment_required_until: grant.employmentRequiredUntil,
      note: grant.note,
    }),
}

/** Both parts or neither, never negative, and together the whole grant. */
function partsOf(fields: StoredFields, amount: Grant['amount']): GrantParts | null {
  const fixed = optionalMoney(fields, 'fixed_part')
  const variable = optionalMoney(fields, 'variable_part')
  if (fixed === null && variable === null) return null
  if (fixed === null || variable === null) refuse(words.reading.partsGoTogether)
  if (fixed < 0 || variable < 0) refuse(words.reading.partsNegative)
  const total = addMoney(fixed, variable)
  if (total !== amount) refuse(words.reading.partsAddUp(plainAmount(total), plainAmount(amount)))
  return { fixed, variable }
}

/** `whole`, a positive amount, or blank. */
function clawbackOf(fields: StoredFields, name: string): GrantClawback | null {
  const field = fields[name]
  if (field === undefined) return null
  if (slugOf(field) === 'whole') return 'whole'
  return field.money !== null && field.money > 0 ? field.money : refuse(words.reading.notWholeOrAmount(name, field.text))
}

/** The grants. A name on more than one record leaves out every record of it, since its income would count twice. */
export function readGrants(read: RecordsRead<Grant>): Reading<Grant> {
  const twice = sharedKeys(read.records, (stored) => stored.record.slug)
  const problems: RecordProblem[] = [
    ...refusedProblems(read),
    ...read.records.filter((stored) => twice.has(stored.record.slug)).map((stored) => problemOf(stored, words.reading.listedTwice(stored.record.slug))),
  ]
  return { facts: read.records.map((stored) => stored.record).filter((grant) => !twice.has(grant.slug)), problems }
}
