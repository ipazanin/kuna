import { filledKey, labelWords } from '../../../../../../shared/storage/domain/recordCodec'
import type { RecordCodec } from '../../../../../../shared/storage/domain/recordCodec'
import { ibanListOf } from '../../../../workbook/domain/iban'
import { amountText, filledFields } from '../../../../../../shared/storage/domain/recordFields'
import { recordIdOf } from '../../../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../../../shared/storage/domain/recordId'
import { problemOf, refusedProblems } from '../../../../../../shared/storage/domain/recordsRead'
import type { Reading, RecordProblem, RecordsRead } from '../../../../../../shared/storage/domain/recordsRead'
import { sharedKeys } from '../../../../../../shared/storage/domain/sharedKeys'
import { booleanOf, keyedId, optionalDate, optionalMoney, refuse, requiredDate, slugOf, textOf, wholeNumberOf } from '../../../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../../../shared/storage/domain/storedFields'
import { findLocalUnit } from '../../ruleset/localUnits'
import { EMPLOYEE_RECORDS } from '../hrDooKinds'
import type { Employee } from './employees'
import { words } from '../words'

const EARLIEST_BIRTH_YEAR = 1900
const LATEST_BIRTH_YEAR = 2100

const MOST_DEPENDANTS = 20

/** An employee made from its fields as an editor makes one, with the id its name makes. */
export function employeeOfFields(fields: StoredFields): Employee {
  return employeeOf(fields, recordIdOf(EMPLOYEE_RECORDS, slugOf(fields.employee)))
}

/** A blank city is kept, since the row still names the person, and reading reports it. A city the ruleset does not know is refused, so the payroll never runs on it. */
export function employeeOf(fields: StoredFields, id: RecordId | null): Employee {
  const slug = slugOf(fields.employee)
  if (slug === '') refuse(words.reading.noEmployeeName)
  const residenceCity = textOf(fields.residence_city)
  const city = residenceCity === '' ? null : findLocalUnit(residenceCity).problem
  if (city !== null) refuse(`residence_city ${city}`)
  const from = requiredDate(fields, 'from')
  const to = optionalDate(fields, 'to')
  if (to !== null && to < from) refuse(words.reading.before('to', to, 'from', from))
  const agreedGross = optionalMoney(fields, 'agreed_gross')
  if (agreedGross !== null && agreedGross <= 0) refuse(words.reading.agreedGrossAboveZero)
  return {
    slug,
    name: textOf(fields.name),
    ibans: [...new Set(ibanListOf(textOf(fields.iban)))],
    residenceCity,
    pensionPillarTwo: flagOf(fields, 'pension_pillar_2'),
    dependants: wholeNumberIn(fields, 'dependants', 0, MOST_DEPENDANTS) ?? 0,
    birthYear: wholeNumberIn(fields, 'birth_year', EARLIEST_BIRTH_YEAR, LATEST_BIRTH_YEAR),
    agreedGross,
    from,
    to,
    director: flagOf(fields, 'director'),
    id: keyedId(id),
  }
}

/** TRUE or FALSE, blank for FALSE. */
function flagOf(fields: StoredFields, name: string): boolean {
  const field = fields[name]
  return field === undefined ? false : (booleanOf(field) ?? refuse(words.reading.notAFlag(name, field.text)))
}

/** A whole number from `least` to `most`, or null when blank. */
function wholeNumberIn(fields: StoredFields, name: string, least: number, most: number): number | null {
  const field = fields[name]
  if (field === undefined) return null
  const number = wholeNumberOf(field)
  return number !== null && number >= least && number <= most ? number : refuse(words.reading.notWholeBetween(name, field.text, least, most))
}

export const EMPLOYEE_CODEC: RecordCodec<Employee> = {
  kind: EMPLOYEE_RECORDS,
  key: (fields) => filledKey(slugOf(fields.employee)),
  label: (fields) => labelWords([textOf(fields.employee)]),
  make: employeeOf,
  fieldsOf: (employee) =>
    filledFields({
      employee: employee.slug,
      name: employee.name,
      iban: employee.ibans.join(', '),
      residence_city: employee.residenceCity,
      pension_pillar_2: employee.pensionPillarTwo ? true : null,
      dependants: employee.dependants === 0 ? null : String(employee.dependants),
      birth_year: employee.birthYear === null ? null : String(employee.birthYear),
      agreed_gross: employee.agreedGross === null ? null : amountText(employee.agreedGross),
      from: employee.from,
      to: employee.to,
      director: employee.director ? true : null,
    }),
}

/** The employees, and the one director among them, whom the pay scenarios, the forecast and Salaries read. */
export interface EmployeesReading extends Reading<Employee> {
  /** Null when no row is the director's, or when several are and so none counts. */
  readonly director: Employee | null
}

/**
 * The employees. A name on more than one record leaves out every record of it, and so does a
 * second director, since a person's pay would count twice or the owner's facts would be a guess.
 * An IBAN on two employees counts for neither, since a payment to it could be either's pay.
 */
export function readEmployees(read: RecordsRead<Employee>): EmployeesReading {
  const twice = sharedKeys(read.records, (stored) => stored.record.slug)
  const directors = read.records.filter((stored) => stored.record.director && !twice.has(stored.record.slug))
  const directorTwice = directors.length > 1
  const leftOut = (employee: Employee) => twice.has(employee.slug) || (directorTwice && employee.director)
  const kept = read.records.filter((stored) => !leftOut(stored.record))
  const sharedIbans = sharedKeys(
    kept.flatMap((stored) => stored.record.ibans),
    (iban) => iban,
  )
  const problems: RecordProblem[] = [
    ...refusedProblems(read),
    ...read.records.filter((stored) => twice.has(stored.record.slug)).map((stored) => problemOf(stored, words.reading.listedTwice(stored.record.slug))),
    ...(directorTwice ? directors.map((stored) => problemOf(stored, words.reading.directorTwice)) : []),
    ...kept.filter((stored) => stored.record.residenceCity === '').map((stored) => problemOf(stored, words.reading.noCity)),
    ...kept.flatMap((stored) => stored.record.ibans.filter((iban) => sharedIbans.has(iban)).map((iban) => problemOf(stored, words.reading.sharedIban(iban)))),
  ]
  const facts = kept.map((stored) => ({ ...stored.record, ibans: stored.record.ibans.filter((iban) => !sharedIbans.has(iban)) }))
  return { facts, problems, director: facts.find((employee) => employee.director) ?? null }
}
