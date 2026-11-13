import type { CivilDate } from '../../shared/calendar/civilDate'
import { dayLabel } from '../../shared/calendar/dayLabel'
import { language } from '../../shared/text/language'
import type { Translation } from '../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// The app is Imovina, and one thing it keeps is a stavka imovine. A typed value is a procjena.

export const en = {
  name: 'Assets',
  start: 'Start',
  pickFile: 'Pick your Assets file',
  setUpAfterLoans: 'Set up Loans before Assets, so an asset with a loan shows what is yours after the loan.',
  /** What every Assets form says and offers. */
  form: {
    aDate: (example: CivilDate) => `A date, such as ${example}`,
    amountPlaceholder: '0.00',
    note: 'Note',
    cancel: 'Cancel',
    notAdded: 'Not added',
    notSaved: 'Not saved',
    notDeleted: 'Not deleted',
  },
}

export const hr: Translation<typeof en> = {
  name: 'Imovina',
  start: 'Početak',
  pickFile: 'Odaberi datoteku imovine',
  setUpAfterLoans: 'Postavite Kredite prije Imovine, da imovina s kreditom pokaže što je vaše nakon kredita.',
  form: {
    aDate: (example) => `Datum, na primjer ${dayLabel(example)}`,
    amountPlaceholder: '0,00',
    note: 'Napomena',
    cancel: 'Odustani',
    notAdded: 'Nije dodano',
    notSaved: 'Nije spremljeno',
    notDeleted: 'Nije obrisano',
  },
}

export const words = language === 'hr' ? hr : en
