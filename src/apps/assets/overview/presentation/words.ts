import { language } from '../../../../shared/text/language'
import type { CroatianForms, EnglishForms, Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.

export const en = {
  title: 'Overview',
  description: 'What you own and what each thing is worth today.',
  addAsset: 'Add an asset',
  empty: {
    title: 'No assets yet',
    description:
      "Add your flat, your car or anything else you own. Kuna moves a flat's price with the official house price index and estimates a car from the customs table, which is not a market price. These are estimates, so add a valuation when you have one.",
    onDrive: (name: string) => `Your Assets file is ready, kept on Google Drive as ${name}.`,
    inBrowser: 'Your Assets file is ready, kept in this browser.',
  },
  setUp: {
    firstAsset: 'Add your first asset',
  },
  problems: {
    title: (count: number): EnglishForms => ({ one: 'A record in the Assets file is left out or doubted', other: `${count} records in the Assets file are left out or doubted` }),
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
    description:
      'Dodajte stan, automobil ili bilo što drugo što posjedujete. Kuna cijenu stana prati službenim indeksom cijena stambenih objekata, a automobil procjenjuje carinskom tablicom, koja nije tržišna cijena. To su procjene, pa dodajte procjenu vrijednosti kad je imate.',
    onDrive: (name) => `Datoteka imovine je spremna i čuva se na Google Driveu kao „${name}”.`,
    inBrowser: 'Datoteka imovine je spremna i čuva se u ovom pregledniku.',
  },
  setUp: {
    firstAsset: 'Dodaj svoju prvu imovinu',
  },
  problems: {
    title: (count): CroatianForms => ({
      one: `${count} zapis u datoteci imovine izostavljen je ili upitan`,
      few: `${count} zapisa u datoteci imovine izostavljena su ili upitna`,
      other: `${count} zapisa u datoteci imovine izostavljeno je ili upitno`,
    }),
  },
  card: {
    addValuation: 'Dodaj procjenu na njezinoj stranici',
    yours: 'Vaše nakon kredita',
  },
}

export const words = language === 'hr' ? hr : en
