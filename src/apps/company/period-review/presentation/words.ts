import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import type { MonthKey } from '../../../../shared/calendar/monthKey'
import { monthLabel, monthName, shortMonthName } from '../../../../shared/calendar/monthLabel'
import { withFullStop } from '../../../../shared/text/withFullStop'
import { language } from '../../../../shared/text/language'
import type { EnglishForms, Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// A Croatian year takes its full stop, as in 2026. and Q3 2026. Croatian names a month in full, since its short names read as words.

export const en = {
  /** The compared period as a column heading. */
  period: {
    year: (year: number) => String(year),
    quarter: (quarter: number, year: number) => `Q${quarter} ${year}`,
    custom: (from: CivilDate, to: CivilDate) => `${dayLabel(from)} to ${dayLabel(to)}`,
  },
  /** "Jan – Sep 2026" within a year, "Jun 2025 – Feb 2026" across one. */
  monthSpan: (from: MonthKey, to: MonthKey, sameYear: boolean) => `${sameYear ? shortMonthName(from) : monthLabel(from)} – ${monthLabel(to)}`,
  /** What is compared when the ledger leaves out part of either period. */
  coverage: {
    countsOnly: (period: string, months: string) => `${period} counts ${months} only`,
    nothingEarlier: (countsOnly: string) => `${countsOnly}, and the ledger holds nothing earlier to compare.`,
    noCompleteMonth: (prior: string) => `the ledger holds no complete month of ${prior}`,
    hasOnly: (prior: string, months: string) => `${prior} has ${months} of those months only`,
    noChange: (held: string) => `${held}, so no change is shown.`,
    bothNoChange: (countsOnly: string, held: string) => `${countsOnly}, and ${held}, so no change is shown.`,
    sameMonths: (countsOnly: string, prior: string) => `${countsOnly}, set against the same months of ${prior}.`,
  },
  costs: 'Costs',
  outside: 'Outside profit and loss',
  noCategorisedRows: 'No categorised rows in this period',
  noCategorisedRowsSentence: 'No categorised rows in this period.',
  categoriesSummary: (count: number, sections: string): EnglishForms => ({ one: `${count} category, under ${sections}`, other: `${count} categories, under ${sections}` }),
  profitAndLoss: 'Profit and loss',
  against: (period: string) => `Against ${period}`,
  noEarlierPeriod: 'No earlier period to compare',
  line: 'Line',
  priorPeriod: 'Prior period',
  change: 'Change',
  noData: 'No data',
  openRows: (line: string, period: string) => `${line}, ${period}, open the rows`,
  byCategory: 'By category',
  biggestFirst: 'Biggest changes first.',
  family: 'Family',
  outsideNote: 'Outside profit and loss: reimbursements and other financing settle costs counted above, so they are listed here and left out of both directions.',
}

export const hr: Translation<typeof en> = {
  period: {
    year: (year) => `${year}.`,
    quarter: (quarter, year) => `Q${quarter} ${year}.`,
    custom: (from, to) => `${dayLabel(from)} – ${dayLabel(to)}`,
  },
  monthSpan: (from, to, sameYear) => `${sameYear ? monthName(from) : monthLabel(from)} – ${monthLabel(to)}`,
  coverage: {
    countsOnly: (period, months) => `${period} broji samo ${months}`,
    nothingEarlier: (countsOnly) => `${countsOnly}, a evidencija nema ništa ranije za usporedbu.`,
    noCompleteMonth: (prior) => `evidencija nema nijedan cijeli mjesec razdoblja ${prior}`,
    hasOnly: (prior, months) => `${prior} ima samo ${months} od tih mjeseci`,
    noChange: (held) => `${held}, pa se promjena ne prikazuje.`,
    bothNoChange: (countsOnly, held) => `${countsOnly}, a ${held}, pa se promjena ne prikazuje.`,
    sameMonths: (countsOnly, prior) => withFullStop(`${countsOnly}, u odnosu na iste mjesece razdoblja ${prior}`),
  },
  costs: 'Troškovi',
  outside: 'Izvan računa dobiti i gubitka',
  noCategorisedRows: 'U ovom razdoblju nema razvrstanih stavki',
  noCategorisedRowsSentence: 'U ovom razdoblju nema razvrstanih stavki.',
  categoriesSummary: (count, sections) => ({ one: `${count} kategorija: ${sections}`, few: `${count} kategorije: ${sections}`, other: `${count} kategorija: ${sections}` }),
  profitAndLoss: 'Račun dobiti i gubitka',
  against: (period) => `U odnosu na ${period}`,
  noEarlierPeriod: 'Nema ranijeg razdoblja za usporedbu',
  line: 'Pozicija',
  priorPeriod: 'Prethodno razdoblje',
  change: 'Promjena',
  noData: 'Nema podataka',
  openRows: (line, period) => `${line}, ${period}, otvori stavke`,
  byCategory: 'Po kategorijama',
  biggestFirst: 'Najprije najveće promjene.',
  family: 'Grupa',
  outsideNote: 'Izvan računa dobiti i gubitka: povrati troškova i ostalo financiranje podmiruju troškove koji su već ubrojeni iznad, pa su navedeni ovdje i ne ulaze ni u prihode ni u troškove.',
}

export const words = language === 'hr' ? hr : en
