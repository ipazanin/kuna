import type { StatementRow } from './statementRows'
import { originOf } from '../../entries/domain/bankRows'
import { sourceOfDay } from '../../workbook/domain/account'
import type { Account, SpendingPeriod, SpendingSource } from '../../workbook/domain/account'
import { periodsOver } from '../../../../shared/app/accountSource'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { DateRange } from '../../../../shared/calendar/dateRange'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/**
 * Rows a dry run leaves out: before the account opened, per account, outside the days the person named, and on days another
 * source fills, per account and that source. The statement file's rows on such days come with the periods that give those days
 * to the file, which the import may write with them.
 */
export type LeftOut =
  | { readonly kind: 'before-opening'; readonly account: RecordId; readonly count: number; readonly openedOn: CivilDate }
  | {
      readonly kind: 'not-taken'
      readonly account: RecordId
      readonly count: number
      readonly source: SpendingSource
      readonly days: DateRange
      /** The account's periods with the days of these rows given to the statement file, or null for rows of another origin. */
      readonly offer: readonly SpendingPeriod[] | null
    }
  | { readonly kind: 'outside-days'; readonly count: number; readonly days: DateRange }

/** The rows of each account, in the order their accounts first come. */
function byAccount(rows: readonly StatementRow[]): ReadonlyMap<RecordId, number> {
  const counts = new Map<RecordId, number>()
  for (const row of rows) counts.set(row.account, (counts.get(row.account) ?? 0) + 1)
  return counts
}

/** The rows not taken, grouped by account, the source of their days and their origin, in the order they first come. */
function notTakenOf(rows: readonly StatementRow[], accounts: ReadonlyMap<RecordId, Pick<Account, 'sources'>>): readonly LeftOut[] {
  const groups = new Map<string, StatementRow[]>()
  for (const row of rows) {
    const account = accounts.get(row.account)
    if (account === undefined) continue
    const key = `${row.account} ${sourceOfDay(account, row.date)} ${originOf(row)}`
    groups.set(key, [...(groups.get(key) ?? []), row])
  }
  return [...groups.values()].map((group): LeftOut => {
    const first = group[0]!
    const account = accounts.get(first.account)!
    const dates = group.map((row) => row.date).sort()
    const days = { from: dates[0]!, to: dates[dates.length - 1]! }
    const offer = originOf(first) === 'provider-file' ? periodsOver(account.sources, 'provider-file', days.from, days.to) : null
    return { kind: 'not-taken', account: first.account, count: group.length, source: sourceOfDay(account, first.date), days, offer }
  })
}

/** What a dry run left out and why, from the rows of each outcome that leaves a row out. */
export function leftOutOf(
  rows: { readonly beforeOpening: readonly StatementRow[]; readonly notTaken: readonly StatementRow[]; readonly outsideDays: readonly StatementRow[] },
  accounts: ReadonlyMap<RecordId, Pick<Account, 'openedOn' | 'sources'>>,
  days: DateRange | undefined,
): readonly LeftOut[] {
  return [
    ...[...byAccount(rows.beforeOpening)].map(([account, count]): LeftOut => ({ kind: 'before-opening', account, count, openedOn: accounts.get(account)!.openedOn })),
    ...notTakenOf(rows.notTaken, accounts),
    ...(rows.outsideDays.length === 0 || days === undefined ? [] : [{ kind: 'outside-days', count: rows.outsideDays.length, days } as const]),
  ]
}
