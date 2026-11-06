import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// An entry is unos and an account račun, both masculine.

export const en = {
  add: 'Add an entry',
  noEntries: 'No entries yet',
  noEntriesDescription: 'Import a Revolut export on Import, or add what went out of an account or came in. It shows here by day.',
  needsAccount: 'Add an account first, then what goes out of it and comes in.',
  noMatch: 'No entries match these filters.',
  waitsOnReview: 'Waits on review',
  filters: {
    month: 'Month',
    account: 'Account',
    category: 'Category',
    allAccounts: 'All accounts',
    allCategories: 'All categories',
  },
  dialog: {
    addTitle: 'Add an entry',
    changeTitle: 'Change the entry',
    description: 'What went out of one of your accounts or came in, or moved from one of them to another.',
    kind: 'Kind of entry',
    kinds: { out: 'Money out', in: 'Money in', transfer: 'Between my accounts' },
    amountIn: (currency: string) => `Amount in ${currency}`,
    arrivedHelp: 'What reached the other account',
    anAmount: 'An amount above zero with at most two decimals',
    category: 'Category',
    pickCategory: 'Pick a category',
    account: 'Account',
    pickAccount: 'Pick an account',
    fromAccount: 'From account',
    toAccount: 'To account',
    otherAccount: 'Pick another account',
    beforeOpened: (date: CivilDate) => `Not before the account opened on ${dayLabel(date)}`,
    date: 'Date',
    payee: 'Payee or payer',
    add: 'Add',
    save: 'Save',
    delete: 'Delete',
    added: 'Entry added',
    saved: 'Entry saved',
    deleted: 'Entry deleted',
    comesBack: 'A statement brought this entry. If you delete it, the next export that covers its day brings it back.',
  },
}

export const hr: Translation<typeof en> = {
  add: 'Dodaj unos',
  noEntries: 'Još nema unosa',
  noEntriesDescription: 'Uvezite izvoz iz Revoluta u Uvozu ili dodajte što je otišlo s računa ili stiglo na njega. Prikazat će se ovdje po danima.',
  needsAccount: 'Najprije dodajte račun, a zatim što s njega odlazi i na njega stiže.',
  noMatch: 'Nijedan unos ne odgovara ovim filtrima.',
  waitsOnReview: 'Čeka pregled',
  filters: {
    month: 'Mjesec',
    account: 'Račun',
    category: 'Kategorija',
    allAccounts: 'Svi računi',
    allCategories: 'Sve kategorije',
  },
  dialog: {
    addTitle: 'Dodaj unos',
    changeTitle: 'Promijeni unos',
    description: 'Što je otišlo s jednog od vaših računa ili stiglo na njega, ili prešlo s jednog vašeg računa na drugi.',
    kind: 'Vrsta unosa',
    kinds: { out: 'Isplata', in: 'Uplata', transfer: 'Između mojih računa' },
    amountIn: (currency) => `Iznos u valuti ${currency}`,
    arrivedHelp: 'Iznos koji je stigao na drugi račun',
    anAmount: 'Iznos veći od nule s najviše dvije decimale',
    category: 'Kategorija',
    pickCategory: 'Odaberite kategoriju',
    account: 'Račun',
    pickAccount: 'Odaberite račun',
    fromAccount: 'S računa',
    toAccount: 'Na račun',
    otherAccount: 'Odaberite drugi račun',
    beforeOpened: (date) => `Ne prije otvaranja računa, ${dayLabel(date)}`,
    date: 'Datum',
    payee: 'Primatelj ili platitelj',
    add: 'Dodaj',
    save: 'Spremi',
    delete: 'Obriši',
    added: 'Unos je dodan',
    saved: 'Unos je spremljen',
    deleted: 'Unos je obrisan',
    comesBack: 'Ovaj je unos došao iz izvoda. Ako ga obrišete, vratit će ga sljedeći izvoz koji obuhvaća taj dan.',
  },
}

export const words = language === 'hr' ? hr : en
