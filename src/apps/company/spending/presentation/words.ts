import { capitalised } from '../../../../shared/text/capitalised'
import { language } from '../../../../shared/text/language'
import { plural } from '../../../../shared/text/translation'
import type { EnglishForms, Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// A counterparty is partner and a ledger row stavka. A refund is povrat novca, a reimbursement povrat troškova.

export const en = {
  breakdown: {
    definition: (costs: string) => `${capitalised(costs)} by category. A refund in a cost category lowers its bar. Transfers and reimbursements are not costs, so they are left out.`,
    periodBefore: 'Period before',
    moneyBack: 'Money back',
    nothingLeft: 'Nothing left the company in this period',
    topPayee: (payee: string, paid: string, count: number): EnglishForms => ({
      one: `Top: ${payee}, ${paid}, of ${count} counterparty`,
      other: `Top: ${payee}, ${paid}, of ${count} counterparties`,
    }),
    monthly: 'Monthly',
    oneOff: 'One-off',
    noEarlierPeriod: 'No earlier period to compare',
    against: (period: string) => `Against ${period}`,
    payees: 'Who the company paid most',
    payeesSubtitle: 'Money out only, grouped by IBAN or name.',
    nothingLeftSentence: 'Nothing left the company in this period.',
    counterparty: 'Counterparty',
    last12Months: 'The last 12 months',
    rows: 'Rows',
    paid: 'Paid',
    openRows: (name: string) => `${name}, open the rows`,
  },
  costs: {
    title: 'Cost by category',
    nothingSpent: 'Nothing was spent in this period',
    nothingSpentSentence: 'Nothing was spent in this period.',
    summary: (count: number, largest: string, amount: string): EnglishForms => ({
      one: `${count} category, the largest ${largest} at ${amount}`,
      other: `${count} categories, the largest ${largest} at ${amount}`,
    }),
    new: 'new',
    before: (amount: string) => `, before ${amount}`,
  },
  strip: (paid: number, months: number) => `Paid in ${paid} of the last ${months} months`,
  payee: {
    byCategory: (payee: string, parts: string) => `${payee} by category: ${parts}`,
    noCategory: 'No category',
    rows: (count: number): EnglishForms => ({ one: `${count} row`, other: `${count} rows` }),
  },
}

export const hr: Translation<typeof en> = {
  breakdown: {
    definition: (costs) => `${capitalised(costs)} po kategorijama. Povrat novca u kategoriji troška skraćuje njezin stupac. Prijenosi i povrati troškova nisu troškovi, pa su izostavljeni.`,
    periodBefore: 'Prethodno razdoblje',
    moneyBack: 'Povrat novca',
    nothingLeft: 'U ovom razdoblju iz tvrtke nije izašao novac',
    topPayee: (payee, paid, count) => ({
      one: `Najviše: ${payee}, ${paid}, od ${count} partnera`,
      few: `Najviše: ${payee}, ${paid}, od ${count} partnera`,
      other: `Najviše: ${payee}, ${paid}, od ${count} partnera`,
    }),
    monthly: 'Mjesečno',
    oneOff: 'Jednokratno',
    noEarlierPeriod: 'Nema ranijeg razdoblja za usporedbu',
    against: (period) => `U odnosu na ${period}`,
    payees: 'Kome je tvrtka najviše platila',
    payeesSubtitle: 'Samo isplate, grupirane po IBAN-u ili nazivu.',
    nothingLeftSentence: 'U ovom razdoblju iz tvrtke nije izašao novac.',
    counterparty: 'Partner',
    last12Months: 'Zadnjih 12 mjeseci',
    rows: 'Stavke',
    paid: 'Plaćeno',
    openRows: (name) => `${name}, otvori stavke`,
  },
  costs: {
    title: 'Troškovi po kategorijama',
    nothingSpent: 'U ovom razdoblju ništa nije potrošeno',
    nothingSpentSentence: 'U ovom razdoblju ništa nije potrošeno.',
    summary: (count, largest, amount) => ({
      one: `${count} kategorija, najveća je ${largest} s ${amount}`,
      few: `${count} kategorije, najveća je ${largest} s ${amount}`,
      other: `${count} kategorija, najveća je ${largest} s ${amount}`,
    }),
    new: 'novo',
    before: (amount) => `, prije ${amount}`,
  },
  strip: (paid, months) => `Plaćeno u ${paid} od ${plural({ one: `zadnjeg ${months} mjeseca`, few: `zadnja ${months} mjeseca`, other: `zadnjih ${months} mjeseci` }, months)}`,
  payee: {
    byCategory: (payee, parts) => `${payee} po kategorijama: ${parts}`,
    noCategory: 'Bez kategorije',
    rows: (count) => ({ one: `${count} stavka`, few: `${count} stavke`, other: `${count} stavki` }),
  },
}

export const words = language === 'hr' ? hr : en
