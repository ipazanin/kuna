import { endingLinks } from '../domain/bankLinks'
import type { LinkedBook } from '../domain/bankLinks'
import { words } from './words'
import { bankSyncSetUp } from '../../workbook/domain/spendingSettings'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../shared/calendar/dayLabel'

/** What the home card says of each link that runs out soon or has. */
export function bankLinkLines(book: LinkedBook, day: CivilDate): readonly string[] {
  if (!bankSyncSetUp(book.settings)) return []
  return endingLinks(book.bankLinks, day).map(({ link, ended }) => (ended ? words.linkEnded(link.bank, dayLabel(link.endsOn)) : words.linkEnds(link.bank, dayLabel(link.endsOn))))
}
