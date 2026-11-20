import { words } from './readingWords'
import type { LeftOut } from '../domain/leftOut'
import type { Account } from '../../workbook/domain/account'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { plural } from '../../../../shared/text/translation'

/** Why a dry run left rows out, as a sentence that names their account. */
export function leftOutLine(leftOut: LeftOut, accounts: readonly Pick<Account, 'id' | 'name'>[]): string {
  const name = (account: RecordId): string => accounts.find((candidate) => candidate.id === account)?.name ?? ''
  switch (leftOut.kind) {
    case 'before-opening':
      return plural(words.leftOut.beforeOpening(leftOut.count, name(leftOut.account), dayLabel(leftOut.openedOn)), leftOut.count)
    case 'not-taken':
      return plural(words.leftOut.notTaken(leftOut.count, name(leftOut.account)), leftOut.count)
    case 'outside-days':
      return plural(words.leftOut.outsideDays(leftOut.count, dayLabel(leftOut.days.from), dayLabel(leftOut.days.to)), leftOut.count)
    case 'covered-by-file':
      return plural(words.leftOut.coveredByFile(leftOut.count, name(leftOut.account), dayLabel(leftOut.lastFileDay)), leftOut.count)
    case 'covered-by-sync':
      return plural(words.leftOut.coveredBySync(leftOut.count, name(leftOut.account), dayLabel(leftOut.firstSyncDay)), leftOut.count)
  }
}
