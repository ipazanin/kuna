import { negateMoney, plainAmount, subtractMoney, sumMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import { newRecordId, recordIdOf } from '../../../../features/workbook/domain/recordId'
import type { RecordId } from '../../../../features/workbook/domain/recordId'
import { SHARED_ID_REASON, idSharing, problemOf, refusedProblems } from '../../../../features/workbook/domain/recordsRead'
import type { ReadRecord, Reading, RecordsRead } from '../../../../features/workbook/domain/recordsRead'
import { sharedKeys } from '../../../../features/workbook/domain/sharedKeys'
import { ownId, refuse, requiredChoice, requiredYear, slugListOf, slugOf, textOf, wholeNumberOf } from '../../../../features/workbook/domain/storedFields'
import type { StoredField, StoredFields } from '../../../../features/workbook/domain/storedFields'
import type { RecordProblem } from '../../../../features/workbook/domain/workbook'
import { YEAR_END_RECORDS } from '../hrDooKinds'
import { YEAR_END_STATEMENTS, yearEndLineDefinition } from './yearEnd'
import type { YearEndFigure, YearEndFigureKind, YearEndLine, YearEndLineDefinition } from './yearEnd'

/** A year-end line made from its fields as an editor makes one, keeping the id it was stored with, or with one of its own. */
export function yearEndLineOfFields(fields: StoredFields, storedId: RecordId | null): YearEndLine {
  return yearEndLineOf(fields, storedId ?? recordIdOf(YEAR_END_RECORDS, newRecordId()))
}

export function yearEndLineOf(fields: StoredFields, id: RecordId | null): YearEndLine {
  const year = requiredYear(fields, 'year')
  const statement = requiredChoice(fields, 'statement', YEAR_END_STATEMENTS)
  const line = statement === 'konto' ? textOf(fields.line) : slugOf(fields.line)
  if (line === '') refuse(statement === 'konto' ? 'no konto number in line' : 'no line')
  const definition = statement === 'konto' ? null : yearEndLineDefinition(statement, line)
  if (statement !== 'konto' && definition === null) refuse(`"${line}" is not a line of ${statement}`)
  return {
    year,
    statement,
    line,
    label: textOf(fields.label),
    figure: figureOf(fields.amount, definition?.kind ?? 'money'),
    categories: statement === 'konto' ? slugListOf(fields.categories) : [],
    aop: textOf(fields.aop),
    source: textOf(fields.source),
    note: textOf(fields.note),
    id: ownId(id),
  }
}

function figureOf(field: StoredField | undefined, kind: YearEndFigureKind): YearEndFigure {
  if (field === undefined) refuse('no amount')
  switch (kind) {
    case 'money': {
      const amount = field.money ?? refuse(`amount "${field.text}" is not a number`)
      return { kind, amount }
    }
    case 'date': {
      const date = field.date ?? refuse(`amount "${field.text}" is not a date cell, and this line is a date`)
      return { kind, date }
    }
    case 'rate': {
      const rate = field.number
      if (rate === null || rate < 0) refuse(`amount "${field.text}" is not a rate`)
      if (rate > 1) refuse(`amount ${rate} reads as ${rate * 100}%. Enter the rate as a percentage cell, such as 10%`)
      return { kind, basisPoints: Math.round(rate * 10_000) }
    }
    case 'count': {
      const count = wholeNumberOf(field)
      if (count === null || count < 0) refuse(`amount "${field.text}" is not a whole number`)
      return { kind, count }
    }
  }
}

/**
 * The accountant's figures, one record per year, statement and line. A key on more than one record
 * leaves out every record of it. A category a konto line names that the categories tab lacks is
 * reported and kept. Where the figures of a year do not add up, as income less expenses against
 * profit before tax or assets against equity and liabilities, the total's record is reported and
 * every line kept, since the package itself can be wrong.
 */
export function readYearEnd(read: RecordsRead<YearEndLine>, categorySlugs: ReadonlySet<string>): Reading<YearEndLine> {
  const lines = yearEndLines(read, categorySlugs)
  return { facts: lines.kept.map((stored) => stored.record), problems: [...lines.problems, ...tieProblems(lines.kept)] }
}

/** The lines and what is wrong with each on its own, without the checks of the totals, which a package being typed in fails until its last line. */
export function readYearEndLines(read: RecordsRead<YearEndLine>, categorySlugs: ReadonlySet<string>): Reading<YearEndLine> {
  const lines = yearEndLines(read, categorySlugs)
  return { facts: lines.kept.map((stored) => stored.record), problems: lines.problems }
}

function yearEndLines(read: RecordsRead<YearEndLine>, categorySlugs: ReadonlySet<string>): { readonly kept: readonly ReadRecord<YearEndLine>[]; readonly problems: readonly RecordProblem[] } {
  const sharesId = idSharing(read)
  const problems: RecordProblem[] = [...refusedProblems(read), ...read.records.filter(sharesId).map((stored) => problemOf(stored, SHARED_ID_REASON))]
  const unshared = read.records.filter((stored) => !sharesId(stored))
  const keyOf = (line: YearEndLine): string => `${line.year} ${line.statement} ${line.line}`
  const twice = sharedKeys(
    unshared.map((stored) => stored.record),
    keyOf,
  )
  const kept: ReadRecord<YearEndLine>[] = []
  for (const stored of unshared) {
    const line = stored.record
    if (twice.has(keyOf(line))) {
      problems.push(problemOf(stored, `${keyOf(line)} is listed on more than one row, so none of them counts`))
      continue
    }
    if (line.statement !== 'konto' && stored.fields.categories !== undefined) {
      problems.push(problemOf(stored, 'categories is read on konto rows only, so it is ignored here'))
    }
    const unknown = line.categories.filter((category) => !categorySlugs.has(category))
    if (unknown.length > 0) {
      problems.push(problemOf(stored, `${unknown.map((category) => `"${category}"`).join(', ')} ${unknown.length === 1 ? 'is' : 'are'} not on the categories tab`))
    }
    kept.push(stored)
  }
  return { kept, problems }
}

/** The checks the package's own figures should pass, as warnings on the total's record. */
function tieProblems(kept: readonly ReadRecord<YearEndLine>[]): RecordProblem[] {
  const problems: RecordProblem[] = []
  const lines = kept.map((stored) => stored.record)
  for (const year of [...new Set(lines.map((line) => line.year))]) {
    const ofYear = lines.filter((line) => line.year === year)
    const side = (tie: NonNullable<YearEndLineDefinition['tie']>): Money[] =>
      ofYear.flatMap((line) => (line.figure.kind === 'money' && yearEndLineDefinition(line.statement, line.line)?.tie === tie ? [line.figure.amount] : []))
    const check = (statement: YearEndLine['statement'], totalLine: string, parts: readonly Money[], partsInWords: string): void => {
      const total = ofYear.find((line) => line.statement === statement && line.line === totalLine)
      if (total?.figure.kind !== 'money' || parts.length === 0) return
      const computed = sumMoney(parts)
      const stated = total.figure.amount
      if (computed !== stated) {
        const apart = plainAmount(Math.abs(subtractMoney(computed, stated)) as Money)
        problems.push(problemOf(kept.find((stored) => stored.record === total)!, `${year}: ${partsInWords} ${plainAmount(computed)}, but ${totalLine} is ${plainAmount(stated)}, ${apart} apart`))
      }
    }
    const expenses = side('expense')
    check('pl', 'profit-before-tax', [...side('income'), ...expenses.map(negateMoney)], 'income less expenses is')
    check('balance', 'total-assets', side('asset'), 'the asset lines add up to')
    check('balance', 'total-assets', side('equity-or-liability'), 'equity and liabilities add up to')
  }
  return problems
}
