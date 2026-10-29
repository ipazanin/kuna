import { intlLocale } from '../text/language'

const DAY_AND_MONTH = new Intl.DateTimeFormat(intlLocale, { day: 'numeric', month: 'short' })

const MINUTE = 60_000
const HOUR = 60 * MINUTE

/** How long ago a sync was, the way a person says it: "just now", "5 min ago", "3 h ago", "yesterday", or the day. */
export function syncAge(syncedAt: Date, now: Date): string {
  const elapsed = now.getTime() - syncedAt.getTime()
  if (elapsed < MINUTE) return 'just now'
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)} min ago`
  if (syncedAt.toDateString() === now.toDateString()) return `${Math.floor(elapsed / HOUR)} h ago`
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (syncedAt.toDateString() === yesterday.toDateString()) return 'yesterday'
  return `on ${DAY_AND_MONTH.format(syncedAt)}`
}
