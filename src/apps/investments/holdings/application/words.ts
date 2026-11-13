import type { CurrencyCode } from '../../../../shared/money/currencyCode'
import type { Mix } from '../../workbook/domain/mixGroup'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'
import { withFullStop } from '../../../../shared/text/withFullStop'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// A lot is partija in Croatian, the units bought on one day at one cost.

export const en = {
  saleBeyond: (instrument: string, date: CivilDate) => `The sale of "${instrument}" on ${dayLabel(date)} would sell more than its account holds that day.`,
  transferBeyond: (instrument: string, date: CivilDate) => `The transfer of "${instrument}" on ${dayLabel(date)} would move more units than its account holds that day.`,
  splitEmpties: (instrument: string, date: CivilDate) => `The split of "${instrument}" on ${dayLabel(date)} would leave a lot with no units.`,
  quoteCurrencyKept: (instrument: string, currency: CurrencyCode) => `"${instrument}" stays quoted in ${currency} while records name it, since they are all in that currency.`,
  byMix: { sector: 'by sector', currency: 'by currency', country: 'by country', class: 'by class', account: 'by account' } satisfies Record<Mix, string>,
  targetsOfTwoMixes: (added: string, kept: string) => `Targets are set for one mix at a time, so targets ${added} cannot stay beside targets ${kept}.`,
  mailOwnsDay: (account: string, startsOn: CivilDate, date: CivilDate) =>
    `IBKR report by mail brings the rows of "${account}" from ${dayLabel(startsOn)}, so it brings the row of ${dayLabel(date)} too. Rows typed or imported go on earlier days.`,
  startInFiledYear: (year: number, firstOpen: CivilDate) => `${year} is a filed tax year. Pick ${dayLabel(firstOpen)} or later.`,
  startOverHandRows: (startsOn: CivilDate) => `It has rows by hand from ${dayLabel(startsOn)}. Pick a later day.`,
}

export const hr: Translation<typeof en> = {
  saleBeyond: (instrument, date) => `Prodaja instrumenta „${instrument}” ${dayLabel(date)} prodala bi više nego što račun toga dana ima.`,
  transferBeyond: (instrument, date) => `Prijenos instrumenta „${instrument}” ${dayLabel(date)} prenio bi više jedinica nego što račun toga dana ima.`,
  splitEmpties: (instrument, date) => `Podjela instrumenta „${instrument}” ${dayLabel(date)} ostavila bi partiju bez ijedne jedinice.`,
  quoteCurrencyKept: (instrument, currency) => `„${instrument}” i dalje kotira u ${currency} dok ga zapisi navode, jer su svi u toj valuti.`,
  byMix: { sector: 'po sektoru', currency: 'po valuti', country: 'po državi', class: 'po klasi', account: 'po računu' },
  targetsOfTwoMixes: (added, kept) => `Ciljevi se postavljaju za jednu raspodjelu odjednom, pa ciljevi ${added} ne mogu stajati uz ciljeve ${kept}.`,
  mailOwnsDay: (account, startsOn, date) =>
    `${withFullStop(`Izvješće IBKR-a poštom donosi retke računa „${account}” od ${dayLabel(startsOn)}, pa donosi i redak od ${dayLabel(date)}`)} Upisani i uvezeni retci idu na ranije dane.`,
  startInFiledYear: (year, firstOpen) => withFullStop(`Porez za ${year}. je prijavljen. Odaberite od ${dayLabel(firstOpen)}`),
  startOverHandRows: (startsOn) => `${withFullStop(`Ima ručne retke od ${dayLabel(startsOn)}`)} Odaberite kasniji dan.`,
}

export const words = language === 'hr' ? hr : en
