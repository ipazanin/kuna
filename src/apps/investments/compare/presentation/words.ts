import type { IndexFundSymbol } from '../domain/indexFunds'
import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'

// A ticker's name or symbol leads its line before a colon in Croatian, so no word has to agree with it.

export const en = {
  button: 'Compare with',
  description: "Both lines then show the change since the chart's first day.",
  searchLabel: 'Symbol or name',
  searchHelp: 'Only listings a price source gives free closes for are shown.',
  funds: 'Indices and gold',
  fundNames: { SPY: 'S&P 500 (SPY)', DIA: 'Dow Jones (DIA)', QQQ: 'Nasdaq-100 (QQQ)', ONEQ: 'Nasdaq Composite (ONEQ)', GLD: 'Gold (GLD)' } satisfies Record<IndexFundSymbol, string>,
  fundsInEuros: "Each is a fund that tracks its index or the price of gold, in dollars turned into euros at each day's ECB rate, without the dividends it pays out.",
  fundsAsQuoted: 'Each is a fund that tracks its index or the price of gold, in dollars, without the dividends it pays out.',
  since: (day: string) => `Change since ${day}`,
  sinceAsQuoted: (day: string) => `Change since ${day}, each line as quoted.`,
  inEuros: (name: string) => `${name} in euros at the day's ECB rate, on the first day, each month end and the last day.`,
  fetching: 'Fetching its closes',
  remove: (name: string) => `Remove ${name}`,
  noCloseThen: (name: string, day: string) => `No close of ${name} for ${day}, so it has no line.`,
  noRateThen: (name: string, currency: string, day: string) => `No ECB rate of ${currency} for ${day}, so ${name} has no line in euros.`,
  pickAgain: (symbol: string) => `Search for ${symbol} again to fetch its closes.`,
  chartDescription: (from: string, to: string, ours: string, ourChange: string, theirs: string, theirChange: string) =>
    `From ${from} to ${to}, ${ours} changed ${ourChange} and ${theirs} ${theirChange}.`,
}

export const hr: Translation<typeof en> = {
  button: 'Usporedi s',
  description: 'Obje linije tada prikazuju promjenu od prvog dana grafikona.',
  searchLabel: 'Simbol ili naziv',
  searchHelp: 'Prikazane su samo kotacije za koje izvor cijena daje besplatne zaključne cijene.',
  funds: 'Indeksi i zlato',
  fundNames: { SPY: 'S&P 500 (SPY)', DIA: 'Dow Jones (DIA)', QQQ: 'Nasdaq-100 (QQQ)', ONEQ: 'Nasdaq Composite (ONEQ)', GLD: 'Zlato (GLD)' },
  fundsInEuros: 'Svaki je fond koji prati svoj indeks ili cijenu zlata, u dolarima preračunatima u eure po ECB-ovu tečaju dana, bez dividendi koje isplaćuje.',
  fundsAsQuoted: 'Svaki je fond koji prati svoj indeks ili cijenu zlata, u dolarima, bez dividendi koje isplaćuje.',
  since: (day) => `Promjena od ${day}`,
  sinceAsQuoted: (day) => `Promjena od ${day}, svaka linija kako kotira.`,
  inEuros: (name) => `${name} u eurima po ECB-ovu tečaju dana, prvog dana, na kraju svakog mjeseca i zadnjeg dana.`,
  fetching: 'Dohvaćaju se cijene',
  remove: (name) => `Ukloni ${name}`,
  noCloseThen: (name, day) => `${name}: nema zaključne cijene za ${day}, pa nema ni linije.`,
  noRateThen: (name, currency, day) => `${name}: nema ECB-ova tečaja valute ${currency} za ${day}, pa nema ni linije u eurima.`,
  pickAgain: (symbol) => `${symbol}: potražite ga ponovno da se dohvate cijene.`,
  chartDescription: (from, to, ours, ourChange, theirs, theirChange) => `Od ${from} do ${to}: ${ours} ${ourChange}, ${theirs} ${theirChange}.`,
}

export const words = language === 'hr' ? hr : en
