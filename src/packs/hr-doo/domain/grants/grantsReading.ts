import { addMoney, plainAmount } from '../../../../shared/money/money'
import { GRANT_RELEASES } from './grants'
import type { Grant, GrantClawback, GrantParts, GrantRelease } from './grants'
import { recordIdOf } from '../../../../features/workbook/domain/recordId'
import type { RecordId } from '../../../../features/workbook/domain/recordId'
import { GRANT_RECORDS } from '../hrDooKinds'
import { problemOf, refusedProblems } from '../../../../features/workbook/domain/recordsRead'
import type { Reading, RecordsRead } from '../../../../features/workbook/domain/recordsRead'
import { sharedKeys } from '../../../../features/workbook/domain/sharedKeys'
import { keyedId, optionalDate, optionalMoney, optionalPeriod, positiveMoney, refuse, requiredChoice, requiredDate, slugOf, textOf } from '../../../../features/workbook/domain/storedFields'
import type { StoredFields } from '../../../../features/workbook/domain/storedFields'
import type { RecordProblem } from '../../../../features/workbook/domain/workbook'

const DEFAULT_RELEASE: GrantRelease = 'fixed-then-assets'

/** A grant made from its fields as an editor makes one, with the id its name makes. */
export function grantOfFields(fields: StoredFields): Grant {
  return grantOf(fields, recordIdOf(GRANT_RECORDS, slugOf(fields.grant)))
}

export function grantOf(fields: StoredFields, id: RecordId | null): Grant {
  const slug = slugOf(fields.grant)
  if (slug === '') refuse('no grant name')
  const received = requiredDate(fields, 'received')
  const amount = positiveMoney(fields, 'amount')
  const parts = partsOf(fields, amount)
  const period = optionalPeriod(fields, 'period_from', 'period_to')
  const release = fields.release === undefined ? DEFAULT_RELEASE : requiredChoice(fields, 'release', GRANT_RELEASES)
  if (release === 'fixed-then-assets' && parts === null) refuse('a fixed-then-assets release needs fixed_part and variable_part')
  if (release === 'straight-line' && period === null) refuse('a straight-line release needs period_from and period_to')
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

/** Both parts or neither, never negative, and together the whole grant. */
function partsOf(fields: StoredFields, amount: Grant['amount']): GrantParts | null {
  const fixed = optionalMoney(fields, 'fixed_part')
  const variable = optionalMoney(fields, 'variable_part')
  if (fixed === null && variable === null) return null
  if (fixed === null || variable === null) refuse('fixed_part and variable_part go together, and only one is filled')
  if (fixed < 0 || variable < 0) refuse('fixed_part and variable_part cannot be negative')
  const total = addMoney(fixed, variable)
  if (total !== amount) refuse(`fixed_part and variable_part add up to ${plainAmount(total)}, not the amount ${plainAmount(amount)}`)
  return { fixed, variable }
}

/** `whole`, a positive amount, or blank. */
function clawbackOf(fields: StoredFields, name: string): GrantClawback | null {
  const field = fields[name]
  if (field === undefined) return null
  if (slugOf(field) === 'whole') return 'whole'
  return field.money !== null && field.money > 0 ? field.money : refuse(`${name} "${field.text}" is neither whole nor an amount above zero`)
}

/** The grants. A name on more than one record leaves out every record of it, since its income would count twice. */
export function readGrants(read: RecordsRead<Grant>): Reading<Grant> {
  const twice = sharedKeys(read.records, (stored) => stored.record.slug)
  const problems: RecordProblem[] = [
    ...refusedProblems(read),
    ...read.records.filter((stored) => twice.has(stored.record.slug)).map((stored) => problemOf(stored, `"${stored.record.slug}" is listed on more than one row, so none of them counts`)),
  ]
  return { facts: read.records.map((stored) => stored.record).filter((grant) => !twice.has(grant.slug)), problems }
}
