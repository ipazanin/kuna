import { capitalised } from '../../../../shared/text/capitalised'
import { language } from '../../../../shared/text/language'
import type { RecordNoun } from '../../../../shared/storage/domain/recordKind'
import type { EnglishForms, Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// The Overview counts bank loans and loans between people together, kredit i pozajmica in Croatian.

export const en = {
  title: 'Overview',
  description: 'Every loan you keep: what is owed and what comes next.',
  addBankLoan: 'Add bank loan',
  addInformalLoan: 'Add informal loan',
  empty: {
    title: 'No loans yet',
    description: 'Add a bank loan from its contract and Kuna works out its plan, its subsidy and what is still owed. Or keep an informal loan between people.',
    onDrive: (name: string) => `Your Loans file is ready, kept on Google Drive as ${name}.`,
    inBrowser: 'Your Loans file is ready, kept in this browser.',
  },
  problems: {
    title: (count: number): EnglishForms => ({ one: 'A record in the Loans file is left out or doubted', other: `${count} records in the Loans file are left out or doubted` }),
    /** One problem: the record, named by its kind and label, and why. */
    line: (noun: RecordNoun, label: string, reason: string) => `${capitalised(noun.en.one)} "${label}": ${reason}`,
  },
  tiles: {
    owedInAll: 'Owed in all',
    onLoans: (count: number): EnglishForms => ({ one: 'on 1 loan', other: `on ${count} loans` }),
    owedToYou: (count: number, amount: string): EnglishForms => ({ one: `on 1 loan, and ${amount} is owed to you`, other: `on ${count} loans, and ${amount} is owed to you` }),
    nextPayment: 'Next payment',
    nextOn: (day: string, name: string) => `On ${day}, ${name}`,
    interestIn: (year: number) => `Interest in ${year}`,
    subsidiesPay: (amount: string) => `subsidies pay ${amount} of it`,
    interestDefinition: "The bank's interest on this year's instalments of every bank loan. A subsidy pays an instalment's interest first.",
    paidOff: 'Bank loans paid off',
    noEndDate: 'Informal loans have no end date',
  },
  card: {
    bankLoan: 'Bank loan',
    informalLoan: 'Informal loan',
    subsidised: 'Subsidised',
    owedToday: 'owed today',
    youOwe: 'You owe',
    owedToYou: 'Owed to you',
    youOweName: (name: string) => (name === '' ? 'you owe' : `you owe ${name}`),
    nameOwesYou: (name: string) => (name === '' ? 'owed to you' : `${name} owes you`),
    noPlan: 'Kuna cannot work out its plan yet. Open it to add the rate from its first instalment.',
    paidBack: (percent: number, principal: string) => `${percent}% of ${principal} paid back`,
    toGo: (amount: string) => `${amount} to go`,
    nextPayment: 'Next payment',
    nextOf: (day: string, payment: string) => `${day}, of ${payment}`,
    subsidyEnds: 'Subsidy ends',
    subsidyThen: (amount: string) => `then ${amount} a month`,
    paidOff: 'Paid off',
    instalmentsLeft: (count: number): EnglishForms => ({ one: '1 instalment left', other: `${count} instalments left` }),
    lastMovement: 'Last movement',
    movement: (kind: string, amount: string) => `${kind} ${amount}`,
    noMovement: 'None yet',
    since: 'Since',
    noInterest: 'No interest, no fixed plan',
  },
}

export const hr: Translation<typeof en> = {
  title: 'Pregled',
  description: 'Svi vaši krediti i pozajmice: koliko dugujete i što slijedi.',
  addBankLoan: 'Dodaj kredit',
  addInformalLoan: 'Dodaj pozajmicu',
  empty: {
    title: 'Još nema kredita ni pozajmica',
    description: 'Dodajte kredit iz ugovora i Kuna će izračunati otplatni plan, subvenciju i preostali dug. Ili vodite pozajmicu među ljudima.',
    onDrive: (name) => `Datoteka kredita je spremna i čuva se na Google Driveu kao ${name}.`,
    inBrowser: 'Datoteka kredita je spremna i čuva se u ovom pregledniku.',
  },
  problems: {
    title: (count) => ({
      one: `${count} zapis u datoteci kredita izostavljen je ili upitan`,
      few: `${count} zapisa u datoteci kredita izostavljena su ili upitna`,
      other: `${count} zapisa u datoteci kredita izostavljeno je ili upitno`,
    }),
    line: (noun, label, reason) => `${capitalised(noun.hr.one)} „${label}”: ${reason}`,
  },
  tiles: {
    owedInAll: 'Ukupno dugujete',
    onLoans: (count) => ({ one: `${count} kredit ili pozajmica`, few: `${count} kredita ili pozajmice`, other: `${count} kredita ili pozajmica` }),
    owedToYou: (count, amount) => ({
      one: `${count} kredit ili pozajmica, a vama se duguje ${amount}`,
      few: `${count} kredita ili pozajmice, a vama se duguje ${amount}`,
      other: `${count} kredita ili pozajmica, a vama se duguje ${amount}`,
    }),
    nextPayment: 'Sljedeća uplata',
    nextOn: (day, name) => `Dana ${day}, ${name}`,
    interestIn: (year) => `Kamata u ${year}.`,
    subsidiesPay: (amount) => `od toga subvencije plaćaju ${amount}`,
    interestDefinition: 'Kamata banke na ovogodišnje anuitete svih kredita. Subvencija najprije plaća kamatu anuiteta.',
    paidOff: 'Svi krediti otplaćeni',
    noEndDate: 'Pozajmice nemaju datum završetka',
  },
  card: {
    bankLoan: 'Kredit',
    informalLoan: 'Pozajmica',
    subsidised: 'Subvencioniran',
    owedToday: 'dug danas',
    youOwe: 'Dugujete',
    owedToYou: 'Duguje vam se',
    youOweName: (name) => (name === '' ? 'dugujete' : `dugujete: ${name}`),
    nameOwesYou: (name) => (name === '' ? 'duguje vam se' : `${name} vam duguje`),
    noPlan: 'Kuna još ne može izračunati otplatni plan. Otvorite kredit i dodajte kamatnu stopu od prvog anuiteta.',
    paidBack: (percent, principal) => `otplaćeno ${percent} % od ${principal}`,
    toGo: (amount) => `još ${amount}`,
    nextPayment: 'Sljedeća uplata',
    nextOf: (day, payment) => `${day}, od ukupno ${payment}`,
    subsidyEnds: 'Subvencija završava',
    subsidyThen: (amount) => `zatim ${amount} mjesečno`,
    paidOff: 'Otplaćen',
    instalmentsLeft: (count) => ({ one: `još ${count} anuitet`, few: `još ${count} anuiteta`, other: `još ${count} anuiteta` }),
    lastMovement: 'Zadnja promjena',
    movement: (kind, amount) => `${kind} ${amount}`,
    noMovement: 'Još nema',
    since: 'Od',
    noInterest: 'Bez kamate i otplatnog plana',
  },
}

export const words = language === 'hr' ? hr : en
