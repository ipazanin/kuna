import type { MonthKey } from './monthKey'
import { monthName, shortMonthName } from './monthLabel'
import { language } from '../text/language'
import type { Translation } from '../text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// Croatian names a month in full, since its short names read as words.

export const en = {
  syncAge: {
    justNow: 'just now',
    minutesAgo: (minutes: number) => `${minutes} min ago`,
    hoursAgo: (hours: number) => `${hours} h ago`,
    yesterday: 'yesterday',
    on: (day: string) => `on ${day}`,
  },
  period: {
    /** The month the ledger starts in part of, and the month it is still filling. */
    inPart: (month: MonthKey) => `${shortMonthName(month)} in part`,
    soFar: (month: MonthKey) => `${shortMonthName(month)} so far`,
  },
}

export const hr: Translation<typeof en> = {
  syncAge: {
    justNow: 'upravo',
    minutesAgo: (minutes) => `prije ${minutes} min`,
    hoursAgo: (hours) => `prije ${hours} h`,
    yesterday: 'jučer',
    on: (day) => day,
  },
  period: {
    inPart: (month) => `${monthName(month)} djelomično`,
    soFar: (month) => `${monthName(month)} do danas`,
  },
}

export const words = language === 'hr' ? hr : en
