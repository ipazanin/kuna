import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// A limit is ograničenje, which is neuter.

export const en = {
  description:
    'A monthly limit in euros on a group or one of its categories, or a yearly cost each month sets money aside for. What a month leaves unspent carries into the next, and an overspent month lowers the next.',
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
    limitOrSetAside: 'Limit or set aside',
    carriedIn: 'Carried in',
    /** What carried in, under the category on a screen too narrow for its column. */
    carriedInAmount: (amount: string) => `Carried in ${amount}`,
    available: 'Available',
    spent: 'Spent',
    left: 'Left',
    /** The foot under the Left column, which sums the monthly limits only, since a yearly cost's money is set aside. */
    leftInAll: 'Left on monthly limits',
    /** Under a yearly cost's name: what falls due and when, and what the month sets aside. */
    dueIn: (amount: string, month: string) => `${amount} due in ${month}`,
    dueNow: (amount: string) => `${amount} due this month`,
    paidFromSetAside: 'Paid from the money set aside',
    setAsideAmount: (amount: string) => `${amount} set aside this month`,
    setAsideInAll: 'Set aside for yearly costs',
    change: (name: string) => `Change the limit on ${name}`,
  },
  dialog: {
    title: 'Set a limit',
    changeTitle: 'Change the limit',
    description: 'What you mean to spend at most each month, in euros.',
    category: 'Group or category',
    aCategory: 'Pick a group or a category',
    amount: 'Monthly limit',
    yearlyAmount: 'Amount each year',
    anAmount: 'An amount above zero with at most two decimals',
    every: 'How often',
    everyMonth: 'Every month',
    onceAYear: 'Once a year',
    yearlyDescription: 'A cost due once a year, such as car insurance. Each month sets a share aside, so the month it is due holds all of it.',
    from: 'From',
    fromHelp: 'The limit holds from this month on, until you change or end it.',
    due: 'Due in',
    dueHelp: (amount: string, month: string) => `Sets aside ${amount} in ${month}, then what is still missing spread over the months to the due month.`,
    save: 'Save',
    end: 'End limit',
    set: 'Limit set',
    ended: 'Limit ended',
  },
}

export const hr: Translation<typeof en> = {
  description:
    'Mjesečno ograničenje u eurima na skupinu ili neku od njezinih kategorija, ili godišnji trošak za koji svaki mjesec odvaja novac. Ono što mjesec ne potroši prenosi se u sljedeći, a prekoračenje umanjuje sljedeći mjesec.',
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
    limitOrSetAside: 'Ograničenje ili odvojeno',
    carriedIn: 'Preneseno',
    carriedInAmount: (amount) => `Preneseno ${amount}`,
    available: 'Raspoloživo',
    spent: 'Potrošeno',
    left: 'Preostalo',
    leftInAll: 'Preostalo na mjesečnim ograničenjima',
    dueIn: (amount, month) => `${amount} dospijeva u mjesecu ${month}`,
    dueNow: (amount) => `${amount} dospijeva ovaj mjesec`,
    paidFromSetAside: 'Plaćeno iz odvojenog novca',
    setAsideAmount: (amount) => `${amount} odvojeno ovaj mjesec`,
    setAsideInAll: 'Odvojeno za godišnje troškove',
    change: (name) => `Promijeni ograničenje za „${name}”`,
  },
  dialog: {
    title: 'Postavi ograničenje',
    changeTitle: 'Promijeni ograničenje',
    description: 'Koliko najviše želite potrošiti svaki mjesec, u eurima.',
    category: 'Skupina ili kategorija',
    aCategory: 'Odaberi skupinu ili kategoriju',
    amount: 'Mjesečno ograničenje',
    yearlyAmount: 'Iznos svake godine',
    anAmount: 'Iznos veći od nule s najviše dvije decimale',
    every: 'Koliko često',
    everyMonth: 'Svaki mjesec',
    onceAYear: 'Jednom godišnje',
    yearlyDescription: 'Trošak koji dospijeva jednom godišnje, kao osiguranje auta. Svaki mjesec odvaja dio, pa mjesec dospijeća ima cijeli iznos.',
    from: 'Od',
    fromHelp: 'Ograničenje vrijedi od ovog mjeseca dok ga ne promijenite ili završite.',
    due: 'Dospijeva u',
    dueHelp: (amount, month) => `U mjesecu ${month} odvaja ${amount}, a zatim ono što još nedostaje raspoređuje na mjesece do dospijeća.`,
    save: 'Spremi',
    end: 'Završi ograničenje',
    set: 'Ograničenje je postavljeno',
    ended: 'Ograničenje je završeno',
  },
}

export const words = language === 'hr' ? hr : en
