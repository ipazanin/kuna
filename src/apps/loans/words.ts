import type { CivilDate } from '../../shared/calendar/civilDate'
import { dayLabel } from '../../shared/calendar/dayLabel'
import { language } from '../../shared/text/language'
import type { Translation } from '../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// The app is Krediti: a bank loan is kredit, a loan between people pozajmica and a bank loan's equal monthly payment anuitet.

export const en = {
  name: 'Loans',
  start: 'Start',
  pickFile: 'Pick your Loans file',
  /** What every Loans form says and offers. */
  form: {
    aDate: (example: CivilDate) => `A date, such as ${example}`,
    anAmount: 'An amount above zero with at most two decimals',
    amountPlaceholder: '0.00',
    note: 'Note',
    cancel: 'Cancel',
    notAdded: 'Not added',
    notSaved: 'Not saved',
    notDeleted: 'Not deleted',
  },
}

export const hr: Translation<typeof en> = {
  name: 'Krediti',
  start: 'Početak',
  pickFile: 'Odaberite datoteku kredita',
  form: {
    aDate: (example) => `Datum, na primjer ${dayLabel(example)}`,
    anAmount: 'Iznos veći od nule s najviše dvije decimale',
    amountPlaceholder: '0,00',
    note: 'Napomena',
    cancel: 'Odustani',
    notAdded: 'Nije dodano',
    notSaved: 'Nije spremljeno',
    notDeleted: 'Nije obrisano',
  },
}

export const words = language === 'hr' ? hr : en
