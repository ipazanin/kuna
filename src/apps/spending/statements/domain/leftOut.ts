import { isBankSyncKey } from './statementRows'
import type { StatementRow } from './statementRows'
import type { SourceDays } from './sourceDays'
import type { Account } from '../../workbook/domain/account'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { DateRange } from '../../../../shared/calendar/dateRange'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/**
 * Rows a dry run leaves out, counted per account: before the account opened, on an account its bank link fills that takes no
 * statement file, outside the days the person named, and on days the other of a file and the bank sync covers.
 */
export type LeftOut =
  | { readonly kind: 'before-opening'; readonly account: RecordId; readonly count: number; readonly openedOn: CivilDate }
  | { readonly kind: 'not-taken'; readonly account: RecordId; readonly count: number }
  | { readonly kind: 'outside-days'; readonly count: number; readonly days: DateRange }
  | { readonly kind: 'covered-by-file'; readonly account: RecordId; readonly count: number; readonly lastFileDay: CivilDate }
  | { readonly kind: 'covered-by-sync'; readonly account: RecordId; readonly count: number; readonly firstSyncDay: CivilDate }

/** The rows of each account, in the order their accounts first come. */
function byAccount(rows: readonly StatementRow[]): ReadonlyMap<RecordId, number> {
  const counts = new Map<RecordId, number>()
  for (const row of rows) counts.set(row.account, (counts.get(row.account) ?? 0) + 1)
  return counts
}

/** What a dry run left out and why, from the rows of each outcome that leaves a row out. */
export function leftOutOf(
  rows: {
    readonly beforeOpening: readonly StatementRow[]
    readonly notTaken: readonly StatementRow[]
    readonly outsideDays: readonly StatementRow[]
    readonly otherSource: readonly StatementRow[]
  },
  accounts: ReadonlyMap<RecordId, Pick<Account, 'openedOn'>>,
  days: DateRange | undefined,
  sourceDays: ReadonlyMap<RecordId, SourceDays>,
): readonly LeftOut[] {
  const otherSource = [...byAccount(rows.otherSource)].map(([account, count]): LeftOut => {
    const { lastFileDay, firstSyncDay } = sourceDays.get(account)!
    const bySync = isBankSyncKey(rows.otherSource.find((row) => row.account === account)!.importKey)
    return bySync ? { kind: 'covered-by-file', account, count, lastFileDay: lastFileDay! } : { kind: 'covered-by-sync', account, count, firstSyncDay: firstSyncDay! }
  })
  return [
    ...[...byAccount(rows.beforeOpening)].map(([account, count]): LeftOut => ({ kind: 'before-opening', account, count, openedOn: accounts.get(account)!.openedOn })),
    ...[...byAccount(rows.notTaken)].map(([account, count]): LeftOut => ({ kind: 'not-taken', account, count })),
    ...(rows.outsideDays.length === 0 || days === undefined ? [] : [{ kind: 'outside-days', count: rows.outsideDays.length, days } as const]),
    ...otherSource,
  ]
}
