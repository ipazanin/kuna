import { words } from './words'
import { keysHeldTwice } from '../../imports/domain/importKeys'
import { accountSources, landingOf, landingRecords, landsAnew, mailOwned, sourcesRefusal } from '../../imports/domain/accountIntake'
import type { LandingKind } from '../../imports/domain/accountIntake'
import { firstUnfiledDay } from '../../tax/domain/taxDeadlines'
import { bookOf } from '../../workbook/application/investmentWriteGuards'
import { BY_HAND_SOURCES } from '../../workbook/domain/investmentAccount'
import type { InvestmentAccount } from '../../workbook/domain/investmentAccount'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import { today } from '../../../../shared/calendar/civilDate'
import type { PeriodsChangeRefusal } from '../../../../shared/app/accountSource'
import { yearOf } from '../../../../shared/calendar/civilDate'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import type { FreshRecords, KindChange } from '../../../../shared/storage/domain/writeRules'

function nameOf(book: InvestmentBook, account: RecordId): string {
  return book.accounts.find((candidate) => candidate.id === account)?.name ?? ''
}

/** Why the write would add a record typed, copied or imported by hand on a day an account takes from another source, or move one there. Undo puts back what was there. */
export function mailOwnedRefusals<R extends LandingKind>(change: KindChange<R>, after: FreshRecords): string[] {
  if (change.undoing) return []
  const { book } = bookOf(after)
  const sources = accountSources(book)
  return change.edits.flatMap((edit) => {
    const record = edit.after !== null && 'record' in edit.after ? edit.after.record : undefined
    if (record === undefined) return []
    const before = edit.before !== null && 'record' in edit.before ? landingOf(edit.before.record) : null
    const landing = landingOf(record)
    const owned = landsAnew(before, landing) ? mailOwned(sources, landing) : null
    return owned === null ? [] : [words.mailOwnsAccount(nameOf(book, owned))]
  })
}

/**
 * Why the write would give a record an import key another record holds, which books one row of a file twice. A second device
 * that imports the same report, or an Accept on an older copy, is refused here and finds the row in Kuna at its next read.
 */
export function importKeyRefusals<R extends { readonly id: RecordId; readonly importKeys: readonly string[] }>(change: KindChange<R>, after: FreshRecords): string[] {
  const added = change.edits.flatMap((edit) => {
    const record = edit.after !== null && 'record' in edit.after ? edit.after.record : undefined
    const before = edit.before !== null && 'record' in edit.before ? edit.before.record.importKeys : []
    return record === undefined ? [] : [{ record, before }]
  })
  if (added.every(({ record, before }) => record.importKeys.every((key) => before.includes(key)))) return []
  const { book } = bookOf(after)
  return added.some(({ record, before }) => keysHeldTwice(book, record, before).length > 0) ? [words.importKeyHeld] : []
}

/** The sentence of a refused change of periods, short enough for the field under them, for the account dialog and the write alike. */
export function sourcesRefusalText(refusal: PeriodsChangeRefusal, undoing: boolean): string {
  if (refusal.kind === 'filed') return words.startInFiledYear(yearOf(refusal.day ?? refusal.firstOpen), refusal.firstOpen)
  return undoing ? words.undoAfterHandover : words.rowsOfAnotherSource(refusal.count)
}

/**
 * Why the write would give an account's days to another source over a filed tax year, or leave a record there the new source
 * would not take. A write that gives days away carries those records out with it, so only a change written some other way is
 * refused, and so is an Undo after the new source brought a record on the handed days.
 */
export function accountSourcesRefusals(change: KindChange<InvestmentAccount>, fresh: FreshRecords, after: FreshRecords): string[] {
  const earlier = bookOf(fresh).book
  const before = accountSources(earlier)
  const { book } = bookOf(after)
  const later = accountSources(book)
  const there = new Set(landingRecords(earlier).map((record) => record.id))
  const records = landingRecords(book)
  const kept = records.filter((record) => there.has(record.id))
  const back = records.filter((record) => !there.has(record.id))
  const firstOpen = change.undoing ? null : firstUnfiledDay(today())
  return change.edits.flatMap((edit) => {
    const account = edit.after !== null && 'record' in edit.after ? edit.after.record : undefined
    const periods = account === undefined ? undefined : later.get(account.id)
    if (account === undefined || periods === undefined) return []
    // A new account counts as kept by hand before, so only the days it gives a source besides by hand are checked.
    const was = edit.before === null ? BY_HAND_SOURCES : (before.get(account.id) ?? BY_HAND_SOURCES)
    const refusal = sourcesRefusal(account.id, was, periods, { kept, back }, firstOpen)
    return refusal === null ? [] : [`${account.name}: ${sourcesRefusalText(refusal, change.undoing)}`]
  })
}
