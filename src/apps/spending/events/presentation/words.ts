import { language } from '../../../../shared/text/language'
import type { CroatianForms, EnglishForms, Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Dodaj, Obriši.
// An event is događaj, which is masculine, and an entry unos, which is masculine too.

export const en = {
  description: 'A stretch of days, such as a trip. Money spent on its days joins it by itself, it counts as Spending counts its months, and it changes no category or limit.',
  add: 'Add an event',
  empty: {
    title: 'No events yet',
    description: 'Add an event such as a trip to Prague with its first and last day, and what you spend on those days joins it.',
  },
  list: 'What each event counts',
  starts: (day: string) => `starts ${day}`,
  dayOf: (day: number, days: number) => `day\u00a0${day}\u00a0of\u00a0${days}`,
  endedYesterday: 'ended yesterday',
  ended: (days: number): EnglishForms => ({ one: `ended ${days} day ago`, other: `ended ${days} days ago` }),
  entries: (count: number): EnglishForms => ({ one: '1\u00a0entry', other: `${count}\u00a0entries` }),
  noEntries: 'no entries yet',
  change: (name: string) => `Change the event ${name}`,
  dialog: {
    addTitle: 'Add an event',
    changeTitle: 'Change the event',
    name: 'Name',
    from: 'First day',
    to: 'Last day',
    blank: 'Give the event a name',
    noDay: 'Pick a day',
    endsBefore: 'The last day cannot be before the first',
    help: 'Money spent on these days joins the event by itself.',
    add: 'Add',
    save: 'Save',
    delete: 'Delete',
    deleteHelp: (parts: string) => `Deleting it puts ${parts} put in it by hand back on their days. Their categories stay.`,
    parts: (count: number): EnglishForms => ({ one: '1 part', other: `${count} parts` }),
  },
  added: 'Event added',
  saved: 'Event saved',
  deleted: 'Event deleted',
}

export const hr: Translation<typeof en> = {
  description: 'Razdoblje dana, kao putovanje. Novac potrošen tih dana sâm mu se pridružuje, broji se kao što Potrošnja broji svoje mjesece i ne mijenja kategoriju ni ograničenje.',
  add: 'Dodaj događaj',
  empty: {
    title: 'Još nema događaja',
    description: 'Dodajte događaj kao put u Prag s prvim i zadnjim danom, pa mu se pridružuje ono što tih dana potrošite.',
  },
  list: 'Što broji svaki događaj',
  starts: (day) => `počinje ${day}`,
  dayOf: (day, days) => `dan\u00a0${day}\u00a0od\u00a0${days}`,
  endedYesterday: 'završio jučer',
  ended: (days): CroatianForms => ({ one: `završio prije ${days} dan`, few: `završio prije ${days} dana`, other: `završio prije ${days} dana` }),
  entries: (count): CroatianForms => ({ one: `${count}\u00a0unos`, few: `${count}\u00a0unosa`, other: `${count}\u00a0unosa` }),
  noEntries: 'još nema unosa',
  change: (name) => `Promijeni događaj ${name}`,
  dialog: {
    addTitle: 'Dodaj događaj',
    changeTitle: 'Promijeni događaj',
    name: 'Naziv',
    from: 'Prvi dan',
    to: 'Zadnji dan',
    blank: 'Upiši naziv',
    noDay: 'Odaberi dan',
    endsBefore: 'Zadnji dan ne može biti prije prvog',
    help: 'Novac potrošen tih dana sâm se pridružuje događaju.',
    add: 'Dodaj',
    save: 'Spremi',
    delete: 'Obriši',
    deleteHelp: (parts) => `Brisanjem se ručno stavljeni dijelovi (${parts}) vraćaju na svoje dane. Kategorije im ostaju.`,
    parts: (count): CroatianForms => ({ one: `${count} dio`, few: `${count} dijela`, other: `${count} dijelova` }),
  },
  added: 'Događaj dodan',
  saved: 'Događaj spremljen',
  deleted: 'Događaj obrisan',
}

export const words = language === 'hr' ? hr : en
