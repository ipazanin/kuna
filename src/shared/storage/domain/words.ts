import { capitalised } from '../../text/capitalised'
import { language } from '../../text/language'
import type { Translation } from '../../text/translation'
import type { CroatianNoun, RecordNoun } from './recordKind'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// A field keeps its name as the file stores it, such as first_instalment, since that is what the file shows.

/** The Croatian word that agrees with a noun of this gender, such as novi, nova or novo. */
export function agreeing(noun: CroatianNoun, masculine: string, feminine: string, neuter: string): string {
  return noun.gender === 'masculine' ? masculine : noun.gender === 'feminine' ? feminine : neuter
}

export const en = {
  /** What names a record that gives nothing to name it by. */
  unnamed: 'unnamed',
  /** "the invoice "1-1-26"", or "an invoice" for a record nothing names yet. */
  named: (noun: RecordNoun, label: string | null) => (label === null ? `${noun.en.article} ${noun.en.one}` : `the ${noun.en.one} "${label}"`),
  /** The same, starting a sentence. */
  namedFirst: (noun: RecordNoun, label: string | null) => capitalised(en.named(noun, label)),
  reasons: {
    notADateCell: (name: string, text: string) => `${name} "${text}" is not a date cell`,
    noDate: (name: string) => `no ${name} date`,
    goTogether: (first: string, second: string) => `${first} and ${second} go together, and only one is filled`,
    before: (laterName: string, later: string, earlierName: string, earlier: string) => `${laterName} ${later} is before ${earlierName} ${earlier}`,
    notANumber: (name: string, text: string) => `${name} "${text}" is not a number`,
    /** A blank field, named as the reader names what it holds. */
    none: (name: string, what: string) => `no ${what === '' ? name : what}`,
    notAboveZero: (name: string) => `${name} must be more than zero`,
    notAYear: (name: string, text: string) => `${name} "${text}" is not a year`,
    notAChoice: (word: string, name: string, what: string, choices: string) => `"${word}" is not a ${what === '' ? name : what}. Use ${choices}`,
    noId: 'no id, so it is left out. Give it an id in the workbook that no other row holds, or delete the row and add it in the app',
    sharedId: 'the same id as another row, so it is left out. Give the copied row an id of its own in the workbook, or delete it and add it in the app',
  },
}

export const hr: Translation<typeof en> = {
  unnamed: 'bez naziva',
  named: (noun, label) => (label === null ? noun.hr.one : `${noun.hr.one} „${label}”`),
  namedFirst: (noun, label) => capitalised(hr.named(noun, label)),
  reasons: {
    notADateCell: (name, text) => `${name} „${text}” nije ćelija s datumom`,
    noDate: (name) => `nema datuma ${name}`,
    goTogether: (first, second) => `${first} i ${second} idu zajedno, a popunjeno je samo jedno`,
    before: (laterName, later, earlierName, earlier) => `${laterName} ${later} je prije ${earlierName} ${earlier}`,
    notANumber: (name, text) => `${name} „${text}” nije broj`,
    none: (name) => `polje ${name} je prazno`,
    notAboveZero: (name) => `polje ${name} mora biti veće od nule`,
    notAYear: (name, text) => `${name} „${text}” nije godina`,
    notAChoice: (word, name, _what, choices) => `„${word}” nije dopuštena vrijednost polja ${name}. Upotrijebite ${choices}`,
    noId: 'nema id-a, pa je redak izostavljen. U datoteci mu dajte id koji nema nijedan drugi redak ili obrišite redak i dodajte ga u aplikaciji',
    sharedId: 'ima isti id kao drugi redak, pa je redak izostavljen. U datoteci kopiranom retku dajte vlastiti id ili ga obrišite i dodajte u aplikaciji',
  },
}

export const words = language === 'hr' ? hr : en
