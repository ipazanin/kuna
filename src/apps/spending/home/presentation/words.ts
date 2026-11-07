import { language } from '../../../../shared/text/language'
import type { CroatianForms, EnglishForms, Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// A note under Kuna's sum ends the sentence "Ne uključuje …, ni …", so Croatian writes it in the accusative.

export const en = {
  purpose: 'Your accounts, what you spend and your monthly limits.',
  spentThisMonth: 'Spent this month',
  leftThisMonth: 'Left this month',
  toReview: (count: number): EnglishForms => ({ one: '1 row to review', other: `${count} rows to review` }),
  bankAndCash: 'Bank and cash',
  overdrawn: 'Overdrawn',
  across: (count: number): EnglishForms => ({ one: 'Across 1 account', other: `Across ${count} accounts` }),
  notConverted: (count: number): EnglishForms => ({
    one: '1 account in another currency not converted: the ECB rates did not load',
    other: `${count} accounts in another currency not converted: the ECB rates did not load`,
  }),
  notConvertedNote: (count: number): EnglishForms => ({
    one: '1 account in another currency, since the ECB rates did not load',
    other: `${count} accounts in another currency, since the ECB rates did not load`,
  }),
}

export const hr: Translation<typeof en> = {
  purpose: 'Vaši računi, potrošnja i mjesečna ograničenja.',
  spentThisMonth: 'Potrošeno ovaj mjesec',
  leftThisMonth: 'Preostalo ovaj mjesec',
  toReview: (count): CroatianForms => ({ one: `Za pregled: ${count}`, few: `Za pregled: ${count}`, other: `Za pregled: ${count}` }),
  bankAndCash: 'Banka i gotovina',
  overdrawn: 'U minusu',
  across: (count): CroatianForms => ({ one: `Na ${count} računu`, few: `Na ${count} računa`, other: `Na ${count} računa` }),
  notConverted: (count): CroatianForms => ({
    one: `${count} račun u drugoj valuti nije preračunat: tečajevi ESB-a nisu se učitali`,
    few: `${count} računa u drugoj valuti nisu preračunata: tečajevi ESB-a nisu se učitali`,
    other: `${count} računa u drugoj valuti nije preračunato: tečajevi ESB-a nisu se učitali`,
  }),
  notConvertedNote: (count): CroatianForms => ({
    one: `${count} račun u drugoj valuti, jer se tečajevi ESB-a nisu učitali`,
    few: `${count} računa u drugoj valuti, jer se tečajevi ESB-a nisu učitali`,
    other: `${count} računa u drugoj valuti, jer se tečajevi ESB-a nisu učitali`,
  }),
}

export const words = language === 'hr' ? hr : en
