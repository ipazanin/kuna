import type { BankLink } from './bankLink'
import { daysBetween } from '../../calendar/civilDate'
import type { CivilDate } from '../../calendar/civilDate'

/** How long before a link runs out the home card starts to say so. */
const ENDING_DAYS = 14

/** How often the step asks a bank by itself. Enable Banking says many banks allow four background fetches a day and says to retry after six hours. */
const FETCH_INTERVAL_MS = 6 * 3_600_000

export interface EndingLink {
  readonly link: BankLink
  /** True once the day has passed, so the link no longer reads. */
  readonly ended: boolean
}

/** Each link that runs out within 14 days or already has. */
export function endingLinks(links: readonly BankLink[], day: CivilDate): readonly EndingLink[] {
  return links.flatMap((link) => (daysBetween(day, link.endsOn) > ENDING_DAYS ? [] : [{ link, ended: link.endsOn < day }]))
}

/** The links still good on the day. */
export function liveLinks(links: readonly BankLink[], day: CivilDate): readonly BankLink[] {
  return links.filter((link) => link.endsOn >= day)
}

/** The links any device sharing the file asked within the last six hours, which the step leaves alone. */
export function heldLinks(links: readonly BankLink[], now: number): readonly BankLink[] {
  return links.filter((link) => link.fetchedAt !== null && now - link.fetchedAt < FETCH_INTERVAL_MS)
}
