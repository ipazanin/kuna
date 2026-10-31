import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// A bank account is račun u banci, since račun alone also means an invoice. A month name takes za, since its accusative reads as written.

export const en = {
  /** The line over the stacked accounts. */
  total: 'All accounts',
  noMonths: 'No months to show.',
  /** The balance chart for a screen reader: which accounts, over which months, and the newest total. */
  description: (accounts: string, from: string, to: string) => `Month-end balance of ${accounts} from ${from} to ${to}, stacked, with the total as a line. `,
  atTheEnd: (month: string, total: string) => `At the end of ${month} the total was ${total}.`,
  soFar: (month: string, total: string) => `So far in ${month} the total was ${total}.`,
}

export const hr: Translation<typeof en> = {
  total: 'Svi računi u banci',
  noMonths: 'Nema mjeseci za prikaz.',
  description: (accounts, from, to) => `Stanje na kraju mjeseca za ${accounts}, ${from} – ${to}, naslagano, s ukupnim stanjem kao crtom. `,
  atTheEnd: (month, total) => `Za ${month} ukupno stanje na kraju mjeseca bilo je ${total}.`,
  soFar: (month, total) => `Za ${month} ukupno stanje dosad je ${total}.`,
}

export const words = language === 'hr' ? hr : en
