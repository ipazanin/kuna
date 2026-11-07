import { language } from '../../text/language'
import type { Translation } from '../../text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// Mail is pošta and one mail poruka. Filing an attachment saves it into its Drive folder, so it is spremiti.

export const en = {
  plan: {
    kinds: {
      'not-filed': 'Not filed',
      filed: 'Filed',
      correction: 'Correction',
      unchecked: 'Not compared',
      unmatched: 'Unmatched',
      already: 'Already there',
    },
    searchedFrom: (from: string, why: string) => `Searched from ${from}, ${why}`,
    searchedFromWhy: { newest: 'a week before the newest file in its folder', since: 'the mail-since day' },
    mail: (subject: string, day: string) => `“${subject}”, ${day}`,
    fromMail: (attachment: string) => `${attachment}, from `,
    correction: 'An older copy has other bytes. The app never replaces a file, so swap it by hand.',
    unchecked: 'An older copy is there, and Drive gives no SHA-256 for it, so the bytes were not compared.',
    noSyncYet: 'No sync on this page has looked at the mail yet.',
    syncToFile: 'Sync to file what is new.',
    noneOn: 'No kind of mail is on, so the last sync looked at none.',
  },
}

export const hr: Translation<typeof en> = {
  plan: {
    kinds: {
      'not-filed': 'Nije spremljeno',
      filed: 'Spremljeno',
      correction: 'Ispravak',
      unchecked: 'Nije uspoređeno',
      unmatched: 'Bez pravila',
      already: 'Već postoji',
    },
    searchedFrom: (from, why) => `Pretraženo od ${from}, ${why}`,
    searchedFromWhy: { newest: 'tjedan dana prije najnovije datoteke u mapi', since: 'dana iz postavke Pošta od' },
    mail: (subject, day) => `„${subject}”, ${day}`,
    fromMail: (attachment) => `${attachment}, iz poruke `,
    correction: 'Starija kopija ima drukčiji sadržaj. Aplikacija nikad ne zamjenjuje datoteku, pa je zamijenite ručno.',
    unchecked: 'Starija kopija postoji, a Drive za nju ne daje SHA-256, pa sadržaj nije uspoređen.',
    noSyncYet: 'Nijedna sinkronizacija na ovoj stranici još nije pregledala poštu.',
    syncToFile: 'Sinkronizirajte da se spremi ono što je novo.',
    noneOn: 'Nijedna vrsta pošte nije uključena, pa zadnja sinkronizacija nije pregledala nijednu.',
  },
}

export const words = language === 'hr' ? hr : en
