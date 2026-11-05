import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// A limit is ograničenje, which is neuter.

export const en = {
  description: 'A monthly limit in euros on a group or one of its categories. What a month leaves unspent carries into the next, and an overspent month lowers the next.',
  setLimit: 'Set a limit',
  month: 'Month',
  overBy: (amount: string) => `Over by ${amount}`,
  empty: {
    title: 'No limits yet',
    description: 'Set a monthly limit on a group such as Food, or on one of its categories.',
  },
  table: {
    label: (month: string) => `Limits in ${month}`,
    category: 'Category',
    monthlyLimit: 'Monthly limit',
    carriedIn: 'Carried in',
    /** What carried in, under the category on a screen too narrow for its column. */
    carriedInAmount: (amount: string) => `Carried in ${amount}`,
    available: 'Available',
    spent: 'Spent',
    left: 'Left',
    inAll: 'In all',
    change: (name: string) => `Change the limit on ${name}`,
  },
  dialog: {
    title: 'Set a limit',
    changeTitle: 'Change the limit',
    description: 'What you mean to spend at most each month, in euros.',
    category: 'Group or category',
    aCategory: 'Pick a group or a category',
    amount: 'Monthly limit',
    anAmount: 'An amount above zero with at most two decimals',
    from: 'From',
    fromHelp: 'The limit holds from this month on, until you change or end it.',
    save: 'Save',
    end: 'End limit',
    set: 'Limit set',
    ended: 'Limit ended',
  },
}

export const hr: Translation<typeof en> = {
  description: 'Mjesečno ograničenje u eurima na skupinu ili neku od njezinih kategorija. Ono što mjesec ne potroši prenosi se u sljedeći, a prekoračenje umanjuje sljedeći mjesec.',
  setLimit: 'Postavi ograničenje',
  month: 'Mjesec',
  overBy: (amount) => `Prekoračeno za ${amount}`,
  empty: {
    title: 'Još nema ograničenja',
    description: 'Postavite mjesečno ograničenje na skupinu kao što je Hrana ili na neku od njezinih kategorija.',
  },
  table: {
    label: (month) => `Ograničenja za ${month}`,
    category: 'Kategorija',
    monthlyLimit: 'Mjesečno ograničenje',
    carriedIn: 'Preneseno',
    carriedInAmount: (amount) => `Preneseno ${amount}`,
    available: 'Raspoloživo',
    spent: 'Potrošeno',
    left: 'Preostalo',
    inAll: 'Ukupno',
    change: (name) => `Promijeni ograničenje za „${name}”`,
  },
  dialog: {
    title: 'Postavi ograničenje',
    changeTitle: 'Promijeni ograničenje',
    description: 'Koliko najviše želite potrošiti svaki mjesec, u eurima.',
    category: 'Skupina ili kategorija',
    aCategory: 'Odaberite skupinu ili kategoriju',
    amount: 'Mjesečno ograničenje',
    anAmount: 'Iznos veći od nule s najviše dvije decimale',
    from: 'Od',
    fromHelp: 'Ograničenje vrijedi od ovog mjeseca dok ga ne promijenite ili završite.',
    save: 'Spremi',
    end: 'Završi ograničenje',
    set: 'Ograničenje je postavljeno',
    ended: 'Ograničenje je završeno',
  },
}

export const words = language === 'hr' ? hr : en
