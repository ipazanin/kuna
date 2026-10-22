import { addMoney, plainAmount } from '../../../shared/money/money'
import { GRANT_RELEASES } from '../domain/grants'
import type { Grant, GrantClawback, GrantParts, GrantRelease } from '../domain/grants'
import { sharedKeys } from '../domain/sharedKeys'
import {
  isUnreadable,
  moneyOf,
  optionalDate,
  optionalMoney,
  optionalPeriod,
  positiveMoney,
  readRow,
  refuse,
  requiredChoice,
  requiredDate,
  slugOf,
  tabReading,
  textOf,
} from './cellReading'
import type { RowProblem, TabReading } from './cellReading'
import { readRecordId } from './tabRecords'
import type { SheetRow } from './workbookSnapshot'

const DEFAULT_RELEASE: GrantRelease = 'fixed-then-assets'

/** The `grants` tab. A name on more than one row leaves out every row of it, since its income would count twice. */
export function readGrants(rows: readonly SheetRow[]): TabReading<Grant> {
  const read: { readonly row: SheetRow; readonly grant: Grant }[] = []
  const problems: RowProblem[] = []
  for (const row of rows) {
    const grant = readRow(() => readGrantRow(row))
    if (isUnreadable(grant)) {
      problems.push({ sheetRow: row.sheetRow, reason: grant.unreadable })
    } else {
      read.push({ row, grant })
    }
  }
  const twice = sharedKeys(
    read.map(({ grant }) => grant),
    (grant) => grant.slug,
  )
  for (const { row, grant } of read.filter((candidate) => twice.has(candidate.grant.slug))) {
    problems.push({ sheetRow: row.sheetRow, reason: `"${grant.slug}" is listed on more than one row, so none of them counts` })
  }
  return tabReading(
    'grants',
    rows,
    read.map(({ grant }) => grant).filter((grant) => !twice.has(grant.slug)),
    problems,
  )
}

function readGrantRow(row: SheetRow): Grant {
  const { cells } = row
  const slug = slugOf(cells.grant)
  if (slug === '') refuse('no grant name')
  const received = requiredDate(cells, 'received')
  const amount = positiveMoney(cells, 'amount')
  const parts = partsOf(cells, amount)
  const period = optionalPeriod(cells, 'period_from', 'period_to')
  const release = cells.release === undefined ? DEFAULT_RELEASE : requiredChoice(cells, 'release', GRANT_RELEASES)
  if (release === 'fixed-then-assets' && parts === null) refuse('a fixed-then-assets release needs fixed_part and variable_part')
  if (release === 'straight-line' && period === null) refuse('a straight-line release needs period_from and period_to')
  return {
    slug,
    received,
    amount,
    parts,
    period,
    release,
    clawbackFirstYear: clawbackOf(cells, 'clawback_year1'),
    clawbackSecondYear: clawbackOf(cells, 'clawback_year2'),
    employmentRequiredUntil: optionalDate(cells, 'employment_required_until'),
    note: textOf(cells.note),
    id: readRecordId('grants', cells),
  }
}

/** Both parts or neither, never negative, and together the whole grant. */
function partsOf(cells: SheetRow['cells'], amount: Grant['amount']): GrantParts | null {
  const fixed = optionalMoney(cells, 'fixed_part')
  const variable = optionalMoney(cells, 'variable_part')
  if (fixed === null && variable === null) return null
  if (fixed === null || variable === null) refuse('fixed_part and variable_part go together, and only one is filled')
  if (fixed < 0 || variable < 0) refuse('fixed_part and variable_part cannot be negative')
  const total = addMoney(fixed, variable)
  if (total !== amount) refuse(`fixed_part and variable_part add up to ${plainAmount(total)}, not the amount ${plainAmount(amount)}`)
  return { fixed, variable }
}

/** `whole`, a positive amount, or blank. */
function clawbackOf(cells: SheetRow['cells'], column: string): GrantClawback | null {
  const cell = cells[column]
  if (cell === undefined) return null
  if (slugOf(cell) === 'whole') return 'whole'
  const amount = moneyOf(cell)
  return amount !== null && amount > 0 ? amount : refuse(`${column} "${textOf(cell)}" is neither whole nor an amount above zero`)
}
