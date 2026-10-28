/** How long changes may sit in this browser, in no exported file, before the app mentions it. */
const EXPORT_REMINDER_DAYS = 7

const DAY = 86_400_000

/** True once the oldest change not in an exported file is a week old or more. */
export function exportReminderDue(unexportedSince: string | null, now: Date): boolean {
  return unexportedSince !== null && now.getTime() - new Date(unexportedSince).getTime() >= EXPORT_REMINDER_DAYS * DAY
}
