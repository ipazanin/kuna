import { language } from '../../../../shared/text/language'
import type { CroatianForms, EnglishForms, Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// A note under Kuna's sum ends the sentence "Ne uključuje …, ni …", so Croatian writes it in the accusative.

export const en = {
  purpose: 'Your flat, your car and the other things you own, with what each is worth today.',
  value: 'Assets value',
  withoutValue: (count: number): EnglishForms => ({ one: '1 asset without a value', other: `${count} assets without a value` }),
  withoutValueNote: (count: number): EnglishForms => ({ one: '1 asset without a value', other: `${count} assets without a value` }),
  indexNote: 'the DZS index, which did not load, so flats count at their valuation or the price paid',
  yoursAfterLoan: (amount: string, loan: string) => `${amount} yours after the ${loan}`,
  yoursAfterLoans: (amount: string) => `${amount} yours after their loans`,
  includesEstimates: (yours: string | null) => (yours === null ? 'Includes estimates' : `Includes estimates, ${yours}`),
}

export const hr: Translation<typeof en> = {
  purpose: 'Vaš stan, automobil i ostala imovina, s današnjom vrijednošću svake stavke.',
  value: 'Vrijednost imovine',
  withoutValue: (count): CroatianForms => ({ one: `${count} stavka imovine bez vrijednosti`, few: `${count} stavke imovine bez vrijednosti`, other: `${count} stavki imovine bez vrijednosti` }),
  withoutValueNote: (count): CroatianForms => ({ one: `${count} stavku imovine bez vrijednosti`, few: `${count} stavke imovine bez vrijednosti`, other: `${count} stavki imovine bez vrijednosti` }),
  indexNote: 'indeks DZS-a, koji se nije učitao, pa se stanovi računaju po procjeni ili plaćenoj cijeni',
  yoursAfterLoan: (amount, loan) => `${amount} vaše nakon kredita „${loan}”`,
  yoursAfterLoans: (amount) => `${amount} vaše nakon kredita na njima`,
  includesEstimates: (yours) => (yours === null ? 'Uključuje procjene' : `Uključuje procjene, ${yours}`),
}

export const words = language === 'hr' ? hr : en
