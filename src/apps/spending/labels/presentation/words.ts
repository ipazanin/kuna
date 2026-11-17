import { language } from '../../../../shared/text/language'
import type { CroatianForms, EnglishForms, Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// A label is oznaka, which is feminine, and an entry unos, which is masculine.

export const en = {
  description:
    'A name that groups money across categories and months, such as a renovation or a new car. A stretch of days, such as a trip, is an event. A label counts as Spending counts its months, and changes no category.',
  add: 'Add a label',
  empty: {
    title: 'No labels yet',
    description: 'Add a label such as Renovation or New car, then select its entries on Entries and put it on them. A trip or another stretch of days is an event, on Events.',
    beforeItems:
      'Add a label such as Renovation or New car. Once the file is updated above, select its entries on Entries and put it on them. A trip or another stretch of days is an event, on Events.',
  },
  list: 'What each label counts',
  entries: (count: number): EnglishForms => ({ one: '1 entry', other: `${count} entries` }),
  newest: (day: string) => `newest ${day}`,
  noEntries: 'No entries yet',
  change: (name: string) => `Change the label ${name}`,
  dialog: {
    addTitle: 'Add a label',
    changeTitle: 'Change the label',
    name: 'Name',
    blank: 'Give the label a name',
    taken: 'Another label has this name',
    add: 'Add',
    save: 'Save',
    delete: 'Delete',
    deleteHelp: (entries: string) => `Deleting it takes it off ${entries}. Their categories stay.`,
  },
  added: 'Label added',
  saved: 'Label saved',
  deleted: 'Label deleted',
}

export const hr: Translation<typeof en> = {
  description:
    'Naziv koji grupira novac preko kategorija i mjeseci, kao obnova ili novi auto. Razdoblje dana, kao putovanje, događaj je. Oznaka se broji kao što Potrošnja broji svoje mjesece i ne mijenja kategoriju.',
  add: 'Dodaj oznaku',
  empty: {
    title: 'Još nema oznaka',
    description: 'Dodajte oznaku kao Obnova ili Novi auto, pa na Unosima odaberite njezine unose i stavite je na njih. Putovanje ili drugo razdoblje dana događaj je, na Događajima.',
    beforeItems:
      'Dodajte oznaku kao Obnova ili Novi auto. Kad ažurirate datoteku gore, na Unosima odaberite njezine unose i stavite je na njih. Putovanje ili drugo razdoblje dana događaj je, na Događajima.',
  },
  list: 'Što broji svaka oznaka',
  entries: (count): CroatianForms => ({ one: `${count} unos`, few: `${count} unosa`, other: `${count} unosa` }),
  newest: (day) => `zadnji ${day}`,
  noEntries: 'Još nema unosa',
  change: (name) => `Promijeni oznaku ${name}`,
  dialog: {
    addTitle: 'Dodaj oznaku',
    changeTitle: 'Promijeni oznaku',
    name: 'Naziv',
    blank: 'Upiši naziv',
    taken: 'Druga oznaka već ima taj naziv',
    add: 'Dodaj',
    save: 'Spremi',
    delete: 'Obriši',
    deleteHelp: (entries) => `Brisanjem se skida sa svih unosa koji je nose (${entries}). Kategorije im ostaju.`,
  },
  added: 'Oznaka dodana',
  saved: 'Oznaka spremljena',
  deleted: 'Oznaka obrisana',
}

export const words = language === 'hr' ? hr : en
