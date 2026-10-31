import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// A lot is partija in Croatian, the units bought on one day at one cost.

export const en = {
  saleBeyond: (instrument: string, date: CivilDate) => `The sale of "${instrument}" on ${dayLabel(date)} would sell more than its account holds that day.`,
  transferBeyond: (instrument: string, date: CivilDate) => `The transfer of "${instrument}" on ${dayLabel(date)} would move more units than its account holds that day.`,
  splitEmpties: (instrument: string, date: CivilDate) => `The split of "${instrument}" on ${dayLabel(date)} would leave a lot with no units.`,
}

export const hr: Translation<typeof en> = {
  saleBeyond: (instrument, date) => `Prodaja instrumenta „${instrument}” ${dayLabel(date)} prodala bi više nego što račun toga dana ima.`,
  transferBeyond: (instrument, date) => `Prijenos instrumenta „${instrument}” ${dayLabel(date)} prenio bi više jedinica nego što račun toga dana ima.`,
  splitEmpties: (instrument, date) => `Podjela instrumenta „${instrument}” ${dayLabel(date)} ostavila bi partiju bez ijedne jedinice.`,
}

export const words = language === 'hr' ? hr : en
