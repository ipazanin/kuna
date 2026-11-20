import { language } from '../../text/language'
import type { Translation } from '../../text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Mail is pošta and one mail poruka.

export const en = {
  plan: {
    searchedFrom: (from: string, why: string) => `Searched from ${from}, ${why}`,
    mail: (subject: string, day: string) => `“${subject}”, ${day}`,
    noSyncYet: 'No sync on this page has looked at the mail yet.',
  },
}

export const hr: Translation<typeof en> = {
  plan: {
    searchedFrom: (from, why) => `Pretraženo od ${from}, ${why}`,
    mail: (subject, day) => `„${subject}”, ${day}`,
    noSyncYet: 'Nijedna sinkronizacija na ovoj stranici još nije pregledala poštu.',
  },
}

export const words = language === 'hr' ? hr : en
