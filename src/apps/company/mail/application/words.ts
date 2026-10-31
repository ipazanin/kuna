import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// Mail is pošta and one mail poruka. Filing an attachment saves it into its Drive folder, so it is spremiti.

export const en = {
  rateLimited: 'Gmail asked us to slow down. Sync again in a minute.',
  searching: 'searching',
  filing: (position: number, of: number) => `filing ${position} of ${of}`,
  waitsFor: (name: string) => `It waits until ${name} is filed, so the next sync still searches back to that mail`,
  statements: {
    label: 'Bank statements',
    notCamt: 'It is not a camt.053 statement with a creation day and a number.',
  },
}

export const hr: Translation<typeof en> = {
  rateLimited: 'Gmail je zatražio da usporimo. Sinkronizirajte ponovno za minutu.',
  searching: 'pretražuje',
  filing: (position, of) => `sprema ${position} od ${of}`,
  waitsFor: (name) => `Čeka dok se ne spremi ${name}, pa sljedeća sinkronizacija i dalje traži unatrag do te poruke`,
  statements: {
    label: 'Bankovni izvodi',
    notCamt: 'Nije camt.053 izvod s danom izrade i brojem.',
  },
}

export const words = language === 'hr' ? hr : en
