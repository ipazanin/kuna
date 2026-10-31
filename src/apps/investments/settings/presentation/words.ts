import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// The Investments file is datoteka ulaganja in Croatian.

export const en = {
  title: 'Settings',
  description: 'Where the Investments file is kept, with its export and the switch to another place, your accounts, and where the prices come from.',
  books: 'Investments books',
  localTitle: 'Investments file',
  export: 'Export',
  switchStorage: 'Switch storage',
  accounts: {
    title: 'Accounts',
    subtitle: 'Each account at a broker, which holds units and cash',
    none: 'No account yet. One is added with the first transaction too.',
    add: 'Add account',
    change: (name: string) => `Change ${name}`,
  },
  accountDialog: {
    addTitle: 'Add an account',
    changeTitle: 'Change an account',
    description: 'An account at a broker. Its trades, income and cash name it.',
    name: 'Name',
    nameHelp: 'Such as the broker and what the account is for',
    note: 'Note',
    nameError: 'A name',
    add: 'Add account',
    save: 'Save',
    delete: 'Delete',
    cancel: 'Cancel',
    added: 'Account added',
    saved: 'Account saved',
    deleted: 'Account deleted',
    notAdded: 'Not added',
    notSaved: 'Not saved',
    notDeleted: 'Not deleted',
  },
}

export const hr: Translation<typeof en> = {
  title: 'Postavke',
  description: 'Gdje se čuva datoteka ulaganja, s izvozom i premještanjem na drugo mjesto, vaši računi te odakle dolaze cijene.',
  books: 'Datoteka ulaganja',
  localTitle: 'Datoteka ulaganja',
  export: 'Izvezi',
  switchStorage: 'Promijeni mjesto',
  accounts: {
    title: 'Računi',
    subtitle: 'Svaki račun kod brokera, na kojem su jedinice i novac',
    none: 'Još nema računa. Račun se dodaje i s prvom transakcijom.',
    add: 'Dodaj račun',
    change: (name) => `Promijeni ${name}`,
  },
  accountDialog: {
    addTitle: 'Dodaj račun',
    changeTitle: 'Promijeni račun',
    description: 'Račun kod brokera. Na njega se pozivaju njegove transakcije, prihodi i novac.',
    name: 'Naziv',
    nameHelp: 'Na primjer broker i za što je račun',
    note: 'Napomena',
    nameError: 'Upišite naziv',
    add: 'Dodaj račun',
    save: 'Spremi',
    delete: 'Obriši',
    cancel: 'Odustani',
    added: 'Račun dodan',
    saved: 'Račun spremljen',
    deleted: 'Račun obrisan',
    notAdded: 'Nije dodano',
    notSaved: 'Nije spremljeno',
    notDeleted: 'Nije obrisano',
  },
}

export const words = language === 'hr' ? hr : en
