import { capitalised } from '../../../../shared/text/capitalised'
import { language } from '../../../../shared/text/language'
import type { RecordNoun } from '../../../../shared/storage/domain/recordKind'
import type { CroatianForms, EnglishForms, Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.

export const en = {
  title: 'Overview',
  description: 'What you own and what each thing is worth today.',
  addAsset: 'Add an asset',
  empty: {
    title: 'No assets yet',
    description: "Add your flat, your car or anything else you own. Kuna carries a flat's price by the house price index and estimates a car by the customs table.",
    onDrive: (name: string) => `Your Assets file is ready, kept on Google Drive as ${name}.`,
    inBrowser: 'Your Assets file is ready, kept in this browser.',
  },
  problems: {
    title: (count: number): EnglishForms => ({ one: 'A record in the Assets file is left out or doubted', other: `${count} records in the Assets file are left out or doubted` }),
    /** One problem: the record, named by its kind and label, and why. */
    line: (noun: RecordNoun, label: string, reason: string) => `${capitalised(noun.en.one)} "${label}": ${reason}`,
  },
  card: {
    addValuation: 'Add a valuation on its page',
    yours: 'Yours after the loan',
  },
}

export const hr: Translation<typeof en> = {
  title: 'Pregled',
  description: 'Što posjedujete i koliko danas vrijedi svaka stavka.',
  addAsset: 'Dodaj imovinu',
  empty: {
    title: 'Još nema imovine',
    description: 'Dodajte stan, automobil ili bilo što drugo što posjedujete. Kuna cijenu stana preračunava indeksom cijena stambenih objekata, a automobil procjenjuje carinskom tablicom.',
    onDrive: (name) => `Datoteka imovine je spremna i čuva se na Google Driveu kao „${name}”.`,
    inBrowser: 'Datoteka imovine je spremna i čuva se u ovom pregledniku.',
  },
  problems: {
    title: (count): CroatianForms => ({
      one: `${count} zapis u datoteci imovine izostavljen je ili upitan`,
      few: `${count} zapisa u datoteci imovine izostavljena su ili upitna`,
      other: `${count} zapisa u datoteci imovine izostavljeno je ili upitno`,
    }),
    line: (noun, label, reason) => `${capitalised(noun.hr.one)} „${label}”: ${reason}`,
  },
  card: {
    addValuation: 'Dodajte procjenu na njezinoj stranici',
    yours: 'Vaše nakon kredita',
  },
}

export const words = language === 'hr' ? hr : en
