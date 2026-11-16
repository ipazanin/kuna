import { language } from '../../../../shared/text/language'
import type { CroatianForms, EnglishForms, Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence.
// A payee you pay is primatelj and one who pays you platitelj, both masculine. An entry is unos, which is masculine.

export const en = {
  description: 'Whom your money goes to and who pays you, counted as Overview counts: money between your accounts, savings, the company and loans leaves no figure here.',
  period: { label: 'Period', month: 'This month', year: 'Last 12 months', all: 'All time' },
  paid: {
    title: 'Money out',
    none: 'No money out to a payee in this period.',
    others: (count: number): EnglishForms => ({ one: '1 other payee', other: `${count} other payees` }),
  },
  received: {
    title: 'Money in',
    none: 'No money in from a payer in this period.',
    others: (count: number): EnglishForms => ({ one: '1 other payer', other: `${count} other payers` }),
  },
  all: { title: 'All payees', subtitle: 'Each with the IBANs their bank rows carry', find: 'Find a payee by name or IBAN', none: 'No payee in this period.', unmatched: 'No payee matches.' },
  entries: (count: number): EnglishForms => ({ one: '1 entry', other: `${count} entries` }),
  newest: (day: string) => `newest ${day}`,
  person: 'Person',
  newPayee: (name: string) => `New payee: ${name}`,
  filledFromPayee: "Filled from this payee's last entries",
  empty: {
    title: 'No payees yet',
    description: 'An entry filed under a spending or an income category names a payee. Add one on Entries, or bring a statement, and its payee shows here.',
  },
}

export const hr: Translation<typeof en> = {
  description: 'Kome odlazi vaš novac i tko vam plaća, brojeno kao u Pregledu: novac među vašim računima, štednja, tvrtka i zajmovi se ovdje ne broje.',
  period: { label: 'Razdoblje', month: 'Ovaj mjesec', year: 'Zadnjih 12 mjeseci', all: 'Sve' },
  paid: {
    title: 'Isplate',
    none: 'U ovom razdoblju nema isplata primatelju.',
    others: (count): CroatianForms => ({ one: `Još ${count} primatelj`, few: `Još ${count} primatelja`, other: `Još ${count} primatelja` }),
  },
  received: {
    title: 'Uplate',
    none: 'U ovom razdoblju nema uplata od platitelja.',
    others: (count): CroatianForms => ({ one: `Još ${count} platitelj`, few: `Još ${count} platitelja`, other: `Još ${count} platitelja` }),
  },
  all: {
    title: 'Svi primatelji i platitelji',
    subtitle: 'Svaki s IBAN-ima koje nose njegovi bankovni redovi',
    find: 'Pretraži po nazivu ili IBAN-u',
    none: 'U ovom razdoblju nema primatelja ni platitelja.',
    unmatched: 'Nitko ne odgovara.',
  },
  entries: (count): CroatianForms => ({ one: `${count} unos`, few: `${count} unosa`, other: `${count} unosa` }),
  newest: (day) => `zadnji ${day}`,
  person: 'Osoba',
  newPayee: (name) => `Novi: ${name}`,
  filledFromPayee: 'Prema zadnjim unosima ovog primatelja ili platitelja',
  empty: {
    title: 'Još nema primatelja ni platitelja',
    description: 'Unos pod kategorijom potrošnje ili prihoda imenuje primatelja ili platitelja. Dodajte ga u Unosima ili donesite izvod, i pojavit će se ovdje.',
  },
}

export const words = language === 'hr' ? hr : en
