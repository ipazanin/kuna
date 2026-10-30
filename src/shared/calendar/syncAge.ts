import { dateFormat } from './dateFormat'
import { words } from './words'

const DAY_AND_MONTH = dateFormat({ day: 'numeric', month: 'short' })

const MINUTE = 60_000
const HOUR = 60 * MINUTE

/** How long ago a sync was, the way a person says it: "just now", "5 min ago", "3 h ago", "yesterday", or the day. */
export function syncAge(syncedAt: Date, now: Date): string {
  const elapsed = now.getTime() - syncedAt.getTime()
  if (elapsed < MINUTE) return words.syncAge.justNow
  if (elapsed < HOUR) return words.syncAge.minutesAgo(Math.floor(elapsed / MINUTE))
  if (syncedAt.toDateString() === now.toDateString()) return words.syncAge.hoursAgo(Math.floor(elapsed / HOUR))
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (syncedAt.toDateString() === yesterday.toDateString()) return words.syncAge.yesterday
  return words.syncAge.on(DAY_AND_MONTH(syncedAt))
}
