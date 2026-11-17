import { words } from './words'
import { accountIntakes, intakeRefusal, landingOf, landingRecords, landsAnew, mailOwned } from '../../imports/domain/accountIntake'
import type { LandingKind } from '../../imports/domain/accountIntake'
import { bookOf } from '../../workbook/application/investmentWriteGuards'
import type { InvestmentAccount } from '../../workbook/domain/investmentAccount'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import { today } from '../../../../shared/calendar/civilDate'
import type { StartDayRefusal } from '../../../../shared/app/accountSource'
import { yearOf } from '../../../../shared/calendar/civilDate'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import type { FreshRecords, KindChange } from '../../../../shared/storage/domain/writeRules'

function nameOf(book: InvestmentBook, account: RecordId): string {
  return book.accounts.find((candidate) => candidate.id === account)?.name ?? ''
}

/** Why the write would add a record typed, copied or imported by hand to an account the mail fills, or move one onto it. Undo puts back what was there. */
export function mailOwnedRefusals<R extends LandingKind>(change: KindChange<R>, after: FreshRecords): string[] {
  if (change.undoing) return []
  const { book } = bookOf(after)
  const intakes = accountIntakes(book)
  return change.edits.flatMap((edit) => {
    const record = edit.after !== null && 'record' in edit.after ? edit.after.record : undefined
    if (record === undefined) return []
    const before = edit.before !== null && 'record' in edit.before ? landingOf(edit.before.record) : null
    const landing = landingOf(record)
    const owned = landsAnew(before, landing) ? mailOwned(intakes, landing) : null
    return owned === null ? [] : [words.mailOwnsAccount(nameOf(book, owned))]
  })
}

/** The sentence of an intake refusal, short enough for the start day's field, for the account dialog and the write alike. */
export function intakeRefusalText(refusal: StartDayRefusal): string {
  return refusal.kind === 'filed' ? words.startInFiledYear(yearOf(refusal.startsOn), refusal.firstOpen) : words.startOverHandRows(refusal.startsOn)
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
