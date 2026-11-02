import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'

// A ticker's symbol leads its line before a colon in Croatian, so no word has to agree with it.

export const en = {
  button: 'Compare with',
  description: "Both lines then show the change since the chart's first day.",
  searchLabel: 'Symbol or name',
  searchHelp: 'Only listings a price source gives free closes for are shown.',
  since: (day: string) => `Change since ${day}`,
  sinceAsQuoted: (day: string) => `Change since ${day}, each line as quoted.`,
  inEuros: (symbol: string) => `${symbol} in euros at the day's ECB rate, on the first day, each month end and the last day.`,
  fetching: 'Fetching its closes',
  remove: (symbol: string) => `Remove ${symbol}`,
  noCloseThen: (symbol: string, day: string) => `No close of ${symbol} for ${day}, so it has no line.`,
  noRateThen: (symbol: string, currency: string, day: string) => `No ECB rate of ${currency} for ${day}, so ${symbol} has no line in euros.`,
  pickAgain: (symbol: string) => `Search for ${symbol} again to fetch its closes.`,
  chartDescription: (from: string, to: string, ours: string, ourChange: string, theirs: string, theirChange: string) =>
    `From ${from} to ${to}, ${ours} changed ${ourChange} and ${theirs} ${theirChange}.`,
}

export const hr: Translation<typeof en> = {
  button: 'Usporedi s',
  description: 'Obje linije tada prikazuju promjenu od prvog dana grafikona.',
  searchLabel: 'Simbol ili naziv',
  searchHelp: 'Prikazane su samo kotacije za koje izvor cijena daje besplatne zaključne cijene.',
  since: (day) => `Promjena od ${day}`,
  sinceAsQuoted: (day) => `Promjena od ${day}, svaka linija kako kotira.`,
  inEuros: (symbol) => `${symbol} u eurima po ECB-ovu tečaju dana, prvog dana, na kraju svakog mjeseca i zadnjeg dana.`,
  fetching: 'Dohvaćaju se cijene',
  remove: (symbol) => `Ukloni ${symbol}`,
  noCloseThen: (symbol, day) => `${symbol}: nema zaključne cijene za ${day}, pa nema ni linije.`,
  noRateThen: (symbol, currency, day) => `${symbol}: nema ECB-ova tečaja valute ${currency} za ${day}, pa nema ni linije u eurima.`,
  pickAgain: (symbol) => `${symbol}: potražite ga ponovno da se dohvate cijene.`,
  chartDescription: (from, to, ours, ourChange, theirs, theirChange) => `Od ${from} do ${to}: ${ours} ${ourChange}, ${theirs} ${theirChange}.`,
}

export const words = language === 'hr' ? hr : en
