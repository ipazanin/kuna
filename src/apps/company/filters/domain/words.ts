import type { MonthKey } from '../../../../shared/calendar/monthKey'
import { monthName, shortMonthName } from '../../../../shared/calendar/monthLabel'
import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// Croatian names a month in full, since its short names read as words.

export const en = {
  /** The month the ledger starts in part of, and the month it is still filling. */
  inPart: (month: MonthKey) => `${shortMonthName(month)} in part`,
  soFar: (month: MonthKey) => `${shortMonthName(month)} so far`,
}

export const hr: Translation<typeof en> = {
  inPart: (month) => `${monthName(month)} djelomično`,
  soFar: (month) => `${monthName(month)} do danas`,
}

export const words = language === 'hr' ? hr : en
