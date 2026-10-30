import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// A lot is partija in Croatian, the units bought on one day at one cost.

export const en = {
  saleBeyond: (sale: string, instrument: string, date: CivilDate) => `The sale "${sale}" would sell more of "${instrument}" than its account holds on ${date}.`,
  transferBeyond: (transfer: string, instrument: string, date: CivilDate) => `The transfer "${transfer}" would move more of "${instrument}" than its account holds on ${date}.`,
  splitEmpties: (split: string, instrument: string) => `The split "${split}" would leave a lot of "${instrument}" with no units.`,
}

export const hr: Translation<typeof en> = {
  saleBeyond: (sale, instrument, date) => `Prodaja „${sale}” prodala bi više instrumenta „${instrument}” nego što račun ima ${dayLabel(date)}.`,
  transferBeyond: (transfer, instrument, date) => `Prijenos „${transfer}” prenio bi više instrumenta „${instrument}” nego što račun ima ${dayLabel(date)}.`,
  splitEmpties: (split, instrument) => `Podjela „${split}” ostavila bi partiju instrumenta „${instrument}” bez ijedne jedinice.`,
}

export const words = language === 'hr' ? hr : en
