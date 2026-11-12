import { language } from '../../../../shared/text/language'
import { withFullStop } from '../../../../shared/text/withFullStop'
import type { CroatianForms, EnglishForms, Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence.
// DZS is Državni zavod za statistiku, the statistics office, whose name Croatian declines as DZS-a.
// A count of months follows nakon or od, so Croatian writes it in the genitive: 1 mjeseca, 2 mjeseca, 5 mjeseci.

/** Whether a value kept as it is was a valuation you typed or the price you paid. */
type Base = 'valuation' | 'price'

export const en = {
  kinds: { home: 'Flat or house', car: 'Car', other: 'Other' },
  regions: { zagreb: 'City of Zagreb', adriatic: 'Adriatic', rest: 'Rest of Croatia' },
  quarter: (year: number, quarter: number) => `${year} Q${quarter}`,
  months: (count: number): EnglishForms => ({ one: '1 month', other: `${count} months` }),
  valuation: (date: string) => `Valuation of ${date}`,
  price: (date: string) => `Price paid on ${date}`,
  carried: (value: string, date: string, quarter: string, region: string) => `Estimate: ${value} of ${date}, carried to ${quarter} by the DZS index for the ${region}`,
  indexNotOut: (quarter: string, base: Base, date: string) => `The DZS index has no ${quarter} yet, so this is ${base === 'price' ? `the price paid on ${date}` : `the valuation of ${date}`}.`,
  indexNotReached: (first: string, base: Base, date: string) =>
    `The DZS index starts in ${first}, so it cannot carry ${base === 'price' ? `the price paid on ${date}` : `the valuation of ${date}`}. Add a valuation.`,
  indexFailed: 'The DZS index did not load, so flats show their valuation or the price paid.',
  indexDefinition: "The index follows the region's market, not your building.",
  customsNew: (share: string, months: string) => `Estimate by the customs table: ${share} of the price after ${months} from first registration`,
  customsUsed: (share: string, months: string, sharePaid: string, paidAfterMonths: string) =>
    `Estimate by the customs table: ${share} at ${months} from first registration, from the price paid at ${paidAfterMonths}, when the share was ${sharePaid}`,
  noValue: 'No value yet',
  waitingForIndex: 'Waiting for the DZS index',
}

export const hr: Translation<typeof en> = {
  kinds: { home: 'Stan ili kuća', car: 'Automobil', other: 'Ostalo' },
  regions: { zagreb: 'Grad Zagreb', adriatic: 'Jadran', rest: 'Ostatak Hrvatske' },
  quarter: (year, quarter) => `${quarter}. tromjesečje ${year}.`,
  months: (count): CroatianForms => ({ one: `${count} mjeseca`, few: `${count} mjeseca`, other: `${count} mjeseci` }),
  valuation: (date) => `Procjena od ${date}`,
  price: (date) => `Plaćena cijena ${date}`,
  carried: (value, date, quarter, region) => `Procjena: ${value} od ${date}, preračunato na ${quarter} indeksom DZS-a za područje ${region}`,
  indexNotOut: (quarter, base, date) => `DZS još nema indeks za ${quarter}, pa je ovo ${base === 'price' ? 'plaćena cijena' : 'procjena'} od ${withFullStop(date)}`,
  indexNotReached: (first, base, date) =>
    `Indeks DZS-a vodi se za ${first} i kasnije, pa ne može preračunati ${base === 'price' ? 'plaćenu cijenu' : 'procjenu'} od ${withFullStop(date)} Dodajte procjenu.`,
  indexFailed: 'Indeks DZS-a nije se učitao, pa stanovi pokazuju procjenu ili plaćenu cijenu.',
  indexDefinition: 'Indeks prati tržište područja, ne vašu zgradu.',
  customsNew: (share, months) => `Procjena prema carinskoj tablici: ${share} cijene nakon ${months} od prve registracije`,
  customsUsed: (share, months, sharePaid, paidAfterMonths) =>
    `Procjena prema carinskoj tablici: ${share} nakon ${months} od prve registracije, od plaćene cijene nakon ${paidAfterMonths}, kad je udio bio ${sharePaid}`,
  noValue: 'Još nema vrijednosti',
  waitingForIndex: 'Čeka se indeks DZS-a',
}

export const words = language === 'hr' ? hr : en
