import { negateMoney, plainAmount, subtractMoney, sumMoney } from '../../../shared/money/money'
import type { Money } from '../../../shared/money/money'
import { YEAR_END_STATEMENTS, yearEndLineDefinition } from '../domain/yearEnd'
import type { YearEndFigure, YearEndFigureKind, YearEndLine, YearEndLineDefinition } from '../domain/yearEnd'
import {
  dateOf,
  inTabOrder,
  isUnreadable,
  moneyOf,
  readRow,
  refuse,
  requiredChoice,
  requiredYear,
  slugListOf,
  slugOf,
  textOf,
  wholeNumberOf,
} from './cellReading'
import type { RowProblem, TabReading } from './cellReading'
import type { SheetRow } from './workbookSnapshot'

/**
 * The `year-end` tab, one row per year, statement and line. A key used twice is left out the
 * second time. A category a konto row names that the categories tab lacks is reported and kept.
 * Where the figures of a year do not add up, as income less expenses against profit before tax or
 * assets against equity and liabilities, the total's row is reported and every line kept, since the
 * package itself can be wrong.
 */
export function readYearEnd(rows: readonly SheetRow[], categorySlugs: ReadonlySet<string>): TabReading<YearEndLine> {
  const lines = readYearEndLines(rows, categorySlugs)
  return { facts: lines.facts, problems: [...lines.problems, ...tieProblems(lines.facts)] }
}

/** The lines and what is wrong with each row on its own, without the checks of the totals, which a package being typed in fails until its last line. */
export function readYearEndLines(rows: readonly SheetRow[], categorySlugs: ReadonlySet<string>): TabReading<YearEndLine> {
  const facts: YearEndLine[] = []
  const problems: RowProblem[] = []
  const seen = new Set<string>()
  for (const row of inTabOrder(rows)) {
    const line = readRow(() => readYearEndRow(row))
    if (isUnreadable(line)) {
      problems.push({ sheetRow: row.sheetRow, reason: line.unreadable })
      continue
    }
    const key = `${line.year} ${line.statement} ${line.line}`
    if (seen.has(key)) {
      problems.push({ sheetRow: row.sheetRow, reason: `${line.year} ${line.statement} ${line.line} is already listed above` })
      continue
    }
    if (line.statement !== 'konto' && row.cells.categories !== undefined) {
      problems.push({ sheetRow: row.sheetRow, reason: 'categories is read on konto rows only, so it is ignored here' })
    }
    const unknown = line.categories.filter((category) => !categorySlugs.has(category))
    if (unknown.length > 0) {
      problems.push({ sheetRow: row.sheetRow, reason: `${unknown.map((category) => `"${category}"`).join(', ')} ${unknown.length === 1 ? 'is' : 'are'} not on the categories tab` })
    }
    seen.add(key)
    facts.push(line)
  }
  return { facts, problems }
}

function readYearEndRow(row: SheetRow): YearEndLine {
  const { cells } = row
  const year = requiredYear(cells, 'year')
  const statement = requiredChoice(cells, 'statement', YEAR_END_STATEMENTS)
  const line = statement === 'konto' ? textOf(cells.line) : slugOf(cells.line)
  if (line === '') refuse(statement === 'konto' ? 'no konto number in line' : 'no line')
  const definition = statement === 'konto' ? null : yearEndLineDefinition(statement, line)
  if (statement !== 'konto' && definition === null) refuse(`"${line}" is not a line of ${statement}`)
  return {
    year,
    statement,
    line,
    label: textOf(cells.label),
    figure: figureOf(cells.amount, definition?.kind ?? 'money'),
    categories: statement === 'konto' ? slugListOf(cells.categories) : [],
    aop: textOf(cells.aop),
    source: textOf(cells.source),
    note: textOf(cells.note),
    sheetRow: row.sheetRow,
  }
}

function figureOf(cell: SheetRow['cells'][string] | undefined, kind: YearEndFigureKind): YearEndFigure {
  if (cell === undefined) refuse('no amount')
  switch (kind) {
    case 'money': {
      const amount = moneyOf(cell) ?? refuse(`amount "${textOf(cell)}" is not a number`)
      return { kind, amount }
    }
    case 'date': {
      const date = dateOf(cell) ?? refuse(`amount "${textOf(cell)}" is not a date cell, and this line is a date`)
      return { kind, date }
    }
    case 'rate': {
      if (typeof cell !== 'number' || cell < 0) refuse(`amount "${textOf(cell)}" is not a rate`)
      if (cell > 1) refuse(`amount ${cell} reads as ${cell * 100}%. Enter the rate as a percentage cell, such as 10%`)
      return { kind, basisPoints: Math.round(cell * 10_000) }
    }
    case 'count': {
      const count = wholeNumberOf(cell)
      if (count === null || count < 0) refuse(`amount "${textOf(cell)}" is not a whole number`)
      return { kind, count }
    }
  }
}

/** The checks the package's own figures should pass, as warnings on the total's row. */
function tieProblems(lines: readonly YearEndLine[]): RowProblem[] {
  const problems: RowProblem[] = []
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
        problems.push({ sheetRow: total.sheetRow, reason: `${year}: ${partsInWords} ${plainAmount(computed)}, but ${totalLine} is ${plainAmount(stated)}, ${apart} apart` })
      }
    }
    const expenses = side('expense')
    check('pl', 'profit-before-tax', [...side('income'), ...expenses.map(negateMoney)], 'income less expenses is')
    check('balance', 'total-assets', side('asset'), 'the asset lines add up to')
    check('balance', 'total-assets', side('equity-or-liability'), 'equity and liabilities add up to')
  }
  return problems
}
