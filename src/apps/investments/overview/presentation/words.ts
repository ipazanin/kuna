import type { RecordNoun } from '../../../../shared/storage/domain/recordKind'
import { capitalised } from '../../../../shared/text/capitalised'
import { language } from '../../../../shared/text/language'
import type { EnglishForms, Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// The Investments file is datoteka ulaganja in Croatian.

export const en = {
  title: 'Overview',
  description: 'What your investments are worth and what they earned.',
  empty: {
    title: 'No transactions yet',
    description: 'Kuna keeps every buy, sale, dividend, deposit and exchange of your brokers here, and works out what they are worth and what they earned.',
    onDrive: (name: string) => `Your Investments file is ready, kept on Google Drive as ${name}.`,
    inBrowser: 'Your Investments file is ready, kept in this browser.',
  },
  problems: {
    title: (count: number): EnglishForms => ({ one: 'A record in the Investments file is left out or doubted', other: `${count} records in the Investments file are left out or doubted` }),
    /** One problem: the record, named by its kind and label, and why. */
    line: (noun: RecordNoun, label: string, reason: string) => `${capitalised(noun.en.one)} "${label}": ${reason}`,
  },
}

export const hr: Translation<typeof en> = {
  title: 'Pregled',
  description: 'Koliko vrijede vaša ulaganja i koliko su zaradila.',
  empty: {
    title: 'Još nema transakcija',
    description: 'Kuna ovdje čuva svaku kupnju, prodaju, dividendu, uplatu i konverziju kod vaših brokera te izračunava vrijednost i zaradu vaših ulaganja.',
    onDrive: (name) => `Datoteka ulaganja je spremna i čuva se na Google Driveu kao ${name}.`,
    inBrowser: 'Datoteka ulaganja je spremna i čuva se u ovom pregledniku.',
  },
  problems: {
    title: (count) => ({
      one: `${count} zapis u datoteci ulaganja izostavljen je ili upitan`,
      few: `${count} zapisa u datoteci ulaganja izostavljena su ili upitna`,
      other: `${count} zapisa u datoteci ulaganja izostavljeno je ili upitno`,
    }),
    line: (noun, label, reason) => `${capitalised(noun.hr.one)} „${label}”: ${reason}`,
  },
}

export const words = language === 'hr' ? hr : en
