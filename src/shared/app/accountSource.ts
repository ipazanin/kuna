import type { CivilDate } from '../calendar/civilDate'

/**
 * The one way an account's rows come in, chosen when it is added: a bank link fetches them, mail brings a provider's reports,
 * and by hand covers typing, the chat and files. Each app offers the ones it has and keeps the account's start day itself.
 */
export const ACCOUNT_SOURCES = ['bank-link', 'mail', 'by-hand'] as const

export type AccountSource = (typeof ACCOUNT_SOURCES)[number]

/**
 * Whether a row a person types, copies or imports may go on an account on a day. An account kept by hand, which has no
 * start day, takes such rows on every day. An automated source owns the account's rows from its start day on, so rows by
 * hand go only on the days before it.
 */
export function takesRowByHand(source: AccountSource, startDay: CivilDate | null, day: CivilDate): boolean {
  return source === 'by-hand' || startDay === null || day < startDay
}
