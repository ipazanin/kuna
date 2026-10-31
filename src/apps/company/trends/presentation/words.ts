import { capitalised } from '../../../../shared/text/capitalised'
import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'
import { monthCase } from '../../../../shared/calendar/monthCase'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// Net stays neto. A month name takes za or uključujući, since its accusative reads as written.

export const en = {
  /** The hatched month still filling up, in a chart's legend. */
  monthSoFar: 'Month so far',
  noMonths: 'No months to show.',
  /** The net line of the income and costs chart. */
  net: 'Net',
  rollingNet3: 'Net, 3-month average',
  profitAndLoss: {
    span: (from: string, to: string, netLine: string) => `Income and costs by month from ${from} to ${to}, with ${netLine} as a line.`,
    best: (month: string, net: string) => `Best month ${month} with a net of ${net}.`,
    weakest: (month: string, net: string) => `Weakest month ${month} with a net of ${net}.`,
    running: (month: string) => `${month} is still running and is not counted in any average.`,
  },
  cumulativeNet: 'Cumulative net',
  cumulativeDescription: (net: string, month: string) => `Cumulative net since the ledger began, ${net} by ${month}.`,
  average3: '3-month average',
  average12: '12-month average',
  notEnoughMonths: 'Not enough complete months for a rolling average yet.',
  rollingDescription: (month: string, average3: string, average12: string | null) =>
    `Average net per month. In ${month} the 3-month average was ${average3}` + (average12 === null ? '.' : ` and the 12-month average ${average12}.`),
  overTime: {
    byMonth: 'Income and costs by month',
    byMonthSubtitle: 'Every month of the ledger. Drag the slider under the chart to change the period.',
    byMonthDefinition: (income: string, costs: string) => `${income} above zero, ${costs} below it. Click a legend entry to hide or show it, and a bar to open its rows.`,
    rolling: 'Rolling net',
    rollingSubtitle: 'Average net per month over the 3 and the 12 months up to each month',
    rollingDefinition: 'A rolling average only counts complete months, so it starts once enough of them exist and stops before the month in progress.',
    cumulativeSubtitle: 'Running total since the ledger began',
    noMonthsInPeriod: 'No months in the period',
    cumulativeSummary: (net: string, month: string) => `${net} since the ledger began, by ${month}`,
  },
}

export const hr: Translation<typeof en> = {
  monthSoFar: 'Tekući mjesec',
  noMonths: 'Nema mjeseci za prikaz.',
  net: 'Neto',
  rollingNet3: 'Neto, prosjek 3 mjeseca',
  profitAndLoss: {
    span: (from, to, netLine) => `Prihodi i troškovi po mjesecima, ${from} – ${to}, a crta je ${netLine}.`,
    best: (month, net) => `Najbolji mjesec je ${month}, s neto iznosom ${net}.`,
    weakest: (month, net) => `Najslabiji mjesec je ${month}, s neto iznosom ${net}.`,
    running: (month) => `${capitalised(month)} još traje i ne ulazi ni u jedan prosjek.`,
  },
  cumulativeNet: 'Kumulativni neto',
  cumulativeDescription: (net, month) => `Kumulativni neto od početka evidencije, uključujući ${month}, iznosi ${net}.`,
  average3: 'Prosjek 3 mjeseca',
  average12: 'Prosjek 12 mjeseci',
  notEnoughMonths: 'Još nema dovoljno cijelih mjeseci za pomični prosjek.',
  rollingDescription: (month, average3, average12) =>
    `Prosječni mjesečni neto. Za ${monthCase(month, 'accusative')} prosjek 3 mjeseca iznosi ${average3}` + (average12 === null ? '.' : `, a prosjek 12 mjeseci ${average12}.`),
  overTime: {
    byMonth: 'Prihodi i troškovi po mjesecima',
    byMonthSubtitle: 'Svaki mjesec evidencije. Povucite klizač ispod grafikona da promijenite razdoblje.',
    byMonthDefinition: (income, costs) => `${income} iznad nule, ${costs} ispod nje. Kliknite stavku legende da je sakrijete ili prikažete, a stupac da otvorite njegove stavke.`,
    rolling: 'Pomični neto',
    rollingSubtitle: 'Prosječni mjesečni neto kroz 3 i kroz 12 mjeseci do svakog mjeseca',
    rollingDefinition: 'Pomični prosjek broji samo cijele mjesece, pa počinje kad ih ima dovoljno i staje prije tekućeg mjeseca.',
    cumulativeSubtitle: 'Zbroj od početka evidencije',
    noMonthsInPeriod: 'U razdoblju nema mjeseci',
    cumulativeSummary: (net, month) => `${net} od početka evidencije, uključujući ${month}`,
  },
}

export const words = language === 'hr' ? hr : en
