import type { CheckName } from '../../workbook/domain/checkSetting'
import { language } from '../../../../shared/text/language'
import type { EnglishForms, Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. A holding is pozicija in Croatian.

export const en = {
  title: 'Portfolio checks',
  subtitle: 'Where the portfolio leans more than a threshold allows',
  within: 'Within',
  over: 'Over',
  labels: {
    holding: 'Largest holding',
    currency: 'Largest currency',
    sector: 'Largest sector',
    country: 'Largest country or region',
    account: 'Largest account',
    cash: 'Cash',
    costs: 'Costs of the last 12 months',
    'target-gap': 'Gap to the target mix',
  } satisfies Record<CheckName, string>,
  ofValue: (name: string, share: string, bound: string) => `${name} is ${share} of the value, ${bound}`,
  groupOfValue: (name: string, share: string, bound: string) => `${name}: ${share} of the value, ${bound}`,
  groupOfHoldings: (name: string, share: string, bound: string) => `${name}: ${share} of the holdings, ${bound}`,
  costs: (share: string, bound: string) => `The costs were ${share} of the average value, ${bound}`,
  gap: (name: string, points: string, bound: string) => `${name}: ${points} points from the target, ${bound}`,
  overLimit: (limit: string) => `over ${limit}`,
  withinLimit: (limit: string) => `within ${limit}`,
  percent: (limit: string) => `${limit}%`,
  points: (limit: string): EnglishForms => ({ one: `${limit} point`, other: `${limit} points` }),
  overCount: (count: number): EnglishForms => ({ one: `${count} check over its threshold`, other: `${count} checks over their thresholds` }),
  allWithin: 'Every check is within its threshold',
  thresholds: 'Change the thresholds',
  allOff: 'Every check is switched off.',
  nothingYet: 'Nothing to check yet.',
  facts: 'Fetched facts',
  factsMissing: 'Missing',
  factProblems: (count: number): EnglishForms => ({ one: `A vendor sent nothing usable for ${count} holding`, other: `Vendors sent nothing usable for ${count} holdings` }),
}

export const hr: Translation<typeof en> = {
  title: 'Provjere portfelja',
  subtitle: 'Gdje je portfelj nagnut više nego što prag dopušta',
  within: 'U granici',
  over: 'Iznad praga',
  labels: {
    holding: 'Najveća pozicija',
    currency: 'Najveća valuta',
    sector: 'Najveći sektor',
    country: 'Najveća država ili regija',
    account: 'Najveći račun',
    cash: 'Novac',
    costs: 'Troškovi u zadnjih 12 mjeseci',
    'target-gap': 'Odstupanje od ciljne raspodjele',
  },
  ofValue: (name, share, bound) => `${name} čini ${share} vrijednosti, ${bound}`,
  groupOfValue: (name, share, bound) => `${name}: ${share} vrijednosti, ${bound}`,
  groupOfHoldings: (name, share, bound) => `${name}: ${share} vrijednosti pozicija, ${bound}`,
  costs: (share, bound) => `Troškovi su iznosili ${share} prosječne vrijednosti, ${bound}`,
  gap: (name, points, bound) => `${name}: ${points} postotnih bodova od cilja, ${bound}`,
  overLimit: (limit) => `iznad ${limit}`,
  withinLimit: (limit) => `u granici od ${limit}`,
  percent: (limit) => `${limit}\u00a0%`,
  points: (limit) => ({ one: `${limit} postotnog boda`, few: `${limit} postotna boda`, other: `${limit} postotnih bodova` }),
  overCount: (count) => ({ one: `${count} provjera iznad praga`, few: `${count} provjere iznad praga`, other: `${count} provjera iznad praga` }),
  allWithin: 'Sve su provjere u granici',
  thresholds: 'Promijeni pragove',
  allOff: 'Sve su provjere isključene.',
  nothingYet: 'Još nema ničega za provjeru.',
  facts: 'Dohvaćeni podaci',
  factsMissing: 'Nedostaje',
  factProblems: (count) => ({
    one: `Izvor nije poslao ništa upotrebljivo za ${count} poziciju`,
    few: `Izvori nisu poslali ništa upotrebljivo za ${count} pozicije`,
    other: `Izvori nisu poslali ništa upotrebljivo za ${count} pozicija`,
  }),
}

export const words = language === 'hr' ? hr : en
