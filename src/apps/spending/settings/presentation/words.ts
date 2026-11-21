import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.

export const en = {
  description: 'Your quick adds, the bank sync, receipts, the assistant, and where the Spending file is kept, with its export and the switch to another place.',
  tabs: { label: 'Parts of the settings', general: 'General', quickAdd: 'Quick add', bankSync: 'Bank sync', receipts: 'Receipts', assistant: 'Assistant' },
  books: 'Spending file',
  localTitle: 'Spending file',
  export: 'Export',
  switchStorage: 'Switch storage',
  recipes: {
    title: 'Statement recipes',
    subtitle: "How Import reads a bank's statement file. Import reads Revolut's export with no recipe of yours.",
    formats: { table: 'Spreadsheet or CSV', xml: 'XML' },
    caption: (bank: string, format: string) => `${bank} · ${format}`,
    delete: 'Delete',
    deleteNamed: (name: string) => `Delete ${name}`,
    add: 'Add recipe',
    deleted: 'Recipe deleted',
    notDeleted: 'Not deleted',
  },
}

export const hr: Translation<typeof en> = {
  description: 'Vaši brzi unosi, sinkronizacija s bankom, fiskalni računi, asistent te gdje se čuva datoteka potrošnje, s izvozom i premještanjem na drugo mjesto.',
  tabs: { label: 'Dijelovi postavki', general: 'Općenito', quickAdd: 'Brzi unos', bankSync: 'Banke', receipts: 'Fiskalni računi', assistant: 'Asistent' },
  books: 'Datoteka potrošnje',
  localTitle: 'Datoteka potrošnje',
  export: 'Izvezi',
  switchStorage: 'Promijeni mjesto',
  recipes: {
    title: 'Recepti za izvode',
    subtitle: 'Kako Uvoz čita datoteku izvoda banke. Uvoz čita Revolutov izvoz i bez vašeg recepta.',
    formats: { table: 'Tablica ili CSV', xml: 'XML' },
    caption: (bank, format) => `${bank} · ${format}`,
    delete: 'Obriši',
    deleteNamed: (name) => `Obriši ${name}`,
    add: 'Dodaj recept',
    deleted: 'Recept je obrisan',
    notDeleted: 'Nije obrisano',
  },
}

export const words = language === 'hr' ? hr : en
