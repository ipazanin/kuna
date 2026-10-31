import type { MonthKey } from '../../../../shared/calendar/monthKey'
import { monthName, shortMonthName } from '../../../../shared/calendar/monthLabel'
import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// A bucket is skupina, a family grupa and a counterparty partner. Croatian names a month in full, since its short names read as words.

export const en = {
  /** The month the ledger starts in part of, and the month it is still filling. */
  inPart: (month: MonthKey) => `${shortMonthName(month)} in part`,
  soFar: (month: MonthKey) => `${shortMonthName(month)} so far`,
  chips: {
    bucket: 'Bucket',
    family: 'Family',
    category: 'Category',
    counterparty: 'Counterparty',
    everyOwnerAdvance: 'Every owner advance',
    text: (text: string) => `Text: “${text}”`,
    atMost: (amount: string) => `at most ${amount}`,
    atLeast: (amount: string) => `at least ${amount}`,
    between: (min: string, max: string) => `${min} to ${max}`,
    amount: (bounds: string) => `Amount: ${bounds}`,
    needsReview: 'Needs review',
  },
}

export const hr: Translation<typeof en> = {
  inPart: (month) => `${monthName(month)} djelomično`,
  soFar: (month) => `${monthName(month)} do danas`,
  chips: {
    bucket: 'Skupina',
    family: 'Grupa',
    category: 'Kategorija',
    counterparty: 'Partner',
    everyOwnerAdvance: 'Svi predujmovi vlasnika',
    text: (text) => `Tekst: „${text}”`,
    atMost: (amount) => `najviše ${amount}`,
    atLeast: (amount) => `najmanje ${amount}`,
    between: (min, max) => `od ${min} do ${max}`,
    amount: (bounds) => `Iznos: ${bounds}`,
    needsReview: 'Čeka provjeru',
  },
}

export const words = language === 'hr' ? hr : en
