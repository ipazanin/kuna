import { language } from '../../../../shared/text/language'
import type { CroatianForms, EnglishForms, Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// A label is oznaka, which is feminine, and a part of a ledger row dio stavke, which is masculine.

export const en = {
  title: 'Labels',
  description:
    'A name that groups parts of ledger rows across categories and months, such as a conference or an office fit-out. Each label shows its result, income less costs, or only its costs when it has no income, as the cash screens count profit and loss, and changes no category.',
  add: 'Add a label',
  empty: {
    title: 'No labels yet',
    description: 'Add a label such as Berlin 2027 or Office fit-out, then pick its rows on Transactions and put it on them.',
    beforeItems: 'Once the books are updated above, add a label such as Berlin 2027 or Office fit-out, then pick its rows on Transactions and put it on them.',
  },
  list: 'What each label counts',
  parts: (count: number): EnglishForms => ({ one: '1 part', other: `${count} parts` }),
  newest: (day: string) => `newest ${day}`,
  noParts: 'No rows yet',
  change: (name: string) => `Change the label ${name}`,
  deleteHelp: (parts: string) => `Deleting it takes it off ${parts}. Their categories stay.`,
  added: 'Label added',
  saved: 'Label saved',
  deleted: 'Label deleted',
  notAdded: 'Not added',
  notSaved: 'Not saved',
  notDeleted: 'Not deleted',
}

export const hr: Translation<typeof en> = {
  title: 'Oznake',
  description:
    'Naziv koji grupira dijelove stavki evidencije preko kategorija i mjeseci, kao konferencija ili uređenje ureda. Svaka oznaka prikazuje svoj rezultat, prihod umanjen za troškove, ili samo troškove kad nema prihoda, kako ih broje gotovinski prikazi, i ne mijenja kategoriju.',
  add: 'Dodaj oznaku',
  empty: {
    title: 'Još nema oznaka',
    description: 'Dodajte oznaku kao Berlin 2027 ili Uređenje ureda, pa u Transakcijama odaberite njezine stavke i stavite je na njih.',
    beforeItems: 'Kad ažurirate knjige gore, dodajte oznaku kao Berlin 2027 ili Uređenje ureda, pa u Transakcijama odaberite njezine stavke i stavite je na njih.',
  },
  list: 'Što broji svaka oznaka',
  parts: (count): CroatianForms => ({ one: `${count} dio`, few: `${count} dijela`, other: `${count} dijelova` }),
  newest: (day) => `zadnji ${day}`,
  noParts: 'Još nema stavki',
  change: (name) => `Promijeni oznaku „${name}”`,
  deleteHelp: (parts) => `Brisanjem se skida sa svih dijelova koji je nose (${parts}). Kategorije im ostaju.`,
  added: 'Oznaka dodana',
  saved: 'Oznaka spremljena',
  deleted: 'Oznaka obrisana',
  notAdded: 'Nije dodano',
  notSaved: 'Nije spremljeno',
  notDeleted: 'Nije obrisano',
}

export const words = language === 'hr' ? hr : en
