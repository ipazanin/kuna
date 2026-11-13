import { words } from './words'
import { accountIntakes, intakeRefusal, landingRecords, mailOwned } from '../../imports/domain/accountIntake'
import type { IntakeRefusal, LandingRecord } from '../../imports/domain/accountIntake'
import { bookOf } from '../../workbook/application/investmentWriteGuards'
import type { InvestmentAccount } from '../../workbook/domain/investmentAccount'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import { today } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import type { FreshRecords, KindChange } from '../../../../shared/storage/domain/writeRules'

/** A record that lands on an account, as the kinds that move money or units hold it. */
export type LandingKind = { readonly date: CivilDate; readonly importKey: string | null } & ({ readonly account: RecordId } | { readonly from: RecordId; readonly to: RecordId })

function landingOf(record: LandingKind): LandingRecord {
  return { accounts: 'account' in record ? [record.account] : [record.from, record.to], date: record.date, importKey: record.importKey }
}

function nameOf(book: InvestmentBook, account: RecordId): string {
  return book.accounts.find((candidate) => candidate.id === account)?.name ?? ''
}

/** Why the write would put a record typed, copied or imported by hand on a day the mail fills an account. Undo puts back what was there. */
export function mailOwnedRefusals<R extends LandingKind>(change: KindChange<R>, after: FreshRecords): string[] {
  if (change.undoing) return []
  const { book } = bookOf(after)
  const intakes = accountIntakes(book)
  return change.edits.flatMap((edit) => {
    const record = edit.after !== null && 'record' in edit.after ? edit.after.record : undefined
    const owned = record === undefined ? null : mailOwned(intakes, landingOf(record))
    return owned === null || record === undefined ? [] : [words.mailOwnsDay(nameOf(book, owned.account), owned.startsOn, record.date)]
  })
}

/** The sentence of an intake refusal, short enough for the start day's field, for the account dialog and the write alike. */
export function intakeRefusalText(refusal: IntakeRefusal): string {
  return refusal.kind === 'filed-year' ? words.startInFiledYear(refusal.year, refusal.firstOpen) : words.startOverHandRows(refusal.startsOn)
}

/** Why the write would give the mail days it reaches into a filed tax year with, or days holding records by hand. */
export function accountIntakeRefusals(change: KindChange<InvestmentAccount>, fresh: FreshRecords, after: FreshRecords): string[] {
  if (change.undoing) return []
  const before = accountIntakes(bookOf(fresh).book)
  const { book } = bookOf(after)
  const later = accountIntakes(book)
  const records = landingRecords(book)
  return change.edits.flatMap((edit) => {
    const account = edit.after !== null && 'record' in edit.after ? edit.after.record : undefined
    const intake = account === undefined ? undefined : later.get(account.id)
    if (account === undefined || intake === undefined) return []
    const refusal = intakeRefusal(account.id, edit.before === null ? null : (before.get(account.id) ?? null), intake, records, today())
    return refusal === null ? [] : [`${account.name}: ${intakeRefusalText(refusal)}`]
  })
}
