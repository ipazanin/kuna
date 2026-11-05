import { capitalised } from '../../../../shared/text/capitalised'
import { language } from '../../../../shared/text/language'
import type { RecordNoun } from '../../../../shared/storage/domain/recordKind'
import type { CroatianForms, EnglishForms, Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.

export const en = {
  description: 'What you spent this month by group and against your limits, the months before, and your accounts.',
  empty: {
    title: 'No entries yet',
    description: 'Add your bank accounts and your cash on Accounts, then type what comes in and goes out.',
    addAccount: 'Add an account',
    onDrive: (name: string) => `Your Spending file is ready, kept on Google Drive as ${name}.`,
    inBrowser: 'Your Spending file is ready, kept in this browser.',
  },
  problems: {
    title: (count: number): EnglishForms => ({ one: 'A record in the Spending file is left out or doubted', other: `${count} records in the Spending file are left out or doubted` }),
    /** One problem: the record, named by its kind and label, and why. */
    line: (noun: RecordNoun, label: string, reason: string) => `${capitalised(noun.en.one)} "${label}": ${reason}`,
  },
  tiles: {
    savingsRateDefinition: 'Income less spending, over income.',
    noIncome: 'No income this month yet',
  },
  donut: {
    title: 'Spending by group',
    groupTitle: (group: string) => `${group} by category`,
    totalLabel: 'spent this month',
    description: (month: string, total: string, parts: string) => `Spending in ${month}, ${total} in all: ${parts}.`,
    part: (name: string, amount: string) => `${name} ${amount}`,
    otherGroups: 'Other groups',
    otherCategories: 'Other categories',
    allGroups: 'All groups',
    opensChildren: 'its categories',
    opensEntries: 'its entries',
    nothing: 'Nothing spent this month yet',
    nothingNote: 'Entries in a spending category show here by group.',
  },
  limits: {
    title: 'Limits this month',
    meter: (category: string, spent: string, available: string) => `${category}: ${spent} spent of ${available} available`,
    spentOf: (spent: string, available: string) => `${spent} of ${available}`,
    meterAfterDebt: (category: string, spent: string, debt: string) => `${category}: ${spent} spent, after ${debt} carried in over the limit`,
    spentAfterDebt: (spent: string, debt: string) => `${spent} spent, after ${debt} carried in over the limit`,
    left: (amount: string) => `${amount} left`,
    allLimits: 'All limits',
  },
  months: {
    title: 'Twelve months by group',
    subtitle: 'What you spent each month, by group.',
  },
  flow: {
    title: 'Income, spending and saved to investments',
    subtitle: 'Each month, with the share of income not spent.',
  },
  accounts: {
    title: 'Accounts',
    account: 'Account',
    balance: 'Balance',
    inEuros: 'In euros',
    allAccounts: 'All accounts',
  },
}

export const hr: Translation<typeof en> = {
  description: 'Što ste ovaj mjesec potrošili po skupinama i prema ograničenjima, prethodni mjeseci i vaši računi.',
  empty: {
    title: 'Još nema unosa',
    description: 'Dodajte bankovne račune i gotovinu na stranici Računi, a zatim unosite što dolazi i odlazi.',
    addAccount: 'Dodaj račun',
    onDrive: (name) => `Datoteka potrošnje je spremna i čuva se na Google Driveu kao „${name}”.`,
    inBrowser: 'Datoteka potrošnje je spremna i čuva se u ovom pregledniku.',
  },
  problems: {
    title: (count): CroatianForms => ({
      one: `${count} zapis u datoteci potrošnje izostavljen je ili upitan`,
      few: `${count} zapisa u datoteci potrošnje izostavljena su ili upitna`,
      other: `${count} zapisa u datoteci potrošnje izostavljeno je ili upitno`,
    }),
    line: (noun, label, reason) => `${capitalised(noun.hr.one)} „${label}”: ${reason}`,
  },
  tiles: {
    savingsRateDefinition: 'Prihodi umanjeni za potrošnju, podijeljeni s prihodima.',
    noIncome: 'Ovaj mjesec još nema prihoda',
  },
  donut: {
    title: 'Potrošnja po skupinama',
    groupTitle: (group) => `${group} po kategorijama`,
    totalLabel: 'potrošeno ovaj mjesec',
    description: (month, total, parts) => `Potrošnja u mjesecu ${month}, ukupno ${total}: ${parts}.`,
    part: (name, amount) => `${name} ${amount}`,
    otherGroups: 'Ostale skupine',
    otherCategories: 'Ostale kategorije',
    allGroups: 'Sve skupine',
    opensChildren: 'njezine kategorije',
    opensEntries: 'njezine unose',
    nothing: 'Ovaj mjesec još ništa nije potrošeno',
    nothingNote: 'Unosi u kategorijama potrošnje prikazuju se ovdje po skupinama.',
  },
  limits: {
    title: 'Ograničenja ovaj mjesec',
    meter: (category, spent, available) => `${category}: potrošeno ${spent} od raspoloživih ${available}`,
    spentOf: (spent, available) => `${spent} od ${available}`,
    meterAfterDebt: (category, spent, debt) => `${category}: potrošeno ${spent}, uz ${debt} prenesenog prekoračenja`,
    spentAfterDebt: (spent, debt) => `Potrošeno ${spent}, uz ${debt} prenesenog prekoračenja`,
    left: (amount) => `Preostalo ${amount}`,
    allLimits: 'Sva ograničenja',
  },
  months: {
    title: 'Dvanaest mjeseci po skupinama',
    subtitle: 'Potrošnja svakog mjeseca, po skupinama.',
  },
  flow: {
    title: 'Prihodi, potrošnja i prijenos u ulaganja',
    subtitle: 'Za svaki mjesec, s udjelom prihoda koji nije potrošen.',
  },
  accounts: {
    title: 'Računi',
    account: 'Račun',
    balance: 'Stanje',
    inEuros: 'U eurima',
    allAccounts: 'Svi računi',
  },
}

export const words = language === 'hr' ? hr : en
