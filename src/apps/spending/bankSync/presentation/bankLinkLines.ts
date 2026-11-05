import { endingLinks } from '../domain/bankLinks'
import { words } from './words'
import type { SpendingSettings } from '../../workbook/domain/spendingSettings'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../shared/calendar/dayLabel'

/** What the home card says of each link that runs out soon or has. */
export function bankLinkLines(settings: SpendingSettings, day: CivilDate): readonly string[] {
  if (settings.bankSyncDeployment === '') return []
  return endingLinks(settings, day).map(({ bank, endsOn, ended }) => (ended ? words.linkEnded(words.banks[bank], dayLabel(endsOn)) : words.linkEnds(words.banks[bank], dayLabel(endsOn))))
}
