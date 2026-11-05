import type { CivilDate } from '../../shared/calendar/civilDate'
import { dayLabel } from '../../shared/calendar/dayLabel'
import { language } from '../../shared/text/language'
import type { Translation } from '../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// The app is Potrošnja. An account is račun, an entry unos, a limit ograničenje. A receipt, later, is fiskalni račun.

export const en = {
  name: 'Spending',
  start: 'Start',
  pickFile: 'Pick your Spending file',
  /** What every Spending form says and offers. */
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
  name: 'Potrošnja',
  start: 'Početak',
  pickFile: 'Odaberite datoteku potrošnje',
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
