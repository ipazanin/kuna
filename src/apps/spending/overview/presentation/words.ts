import { language } from '../../../../shared/text/language'
import type { CroatianForms, EnglishForms, Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.

export const en = {
  description: 'What you spent this month by group and against your limits, the months before, and your accounts.',
  empty: {
    title: 'Start with one account',
    description: 'The account you use most, with what it held on the first of this month. Then import a Revolut export on Import or type a few entries. The other accounts can wait.',
    /** The description while a bank link is offered, so it leads with the two ways to add the account. */
    descriptionWithBank: 'The account you use most. Link a bank and the bank sync brings its rows, or add it by hand with what it held on the first of this month. The other accounts can wait.',
    addAccount: 'Add an account',
    linkABank: 'Link a bank',
    addByHand: 'Add by hand',
    onDrive: (name: string) => `Your Spending file is ready, kept on Google Drive as ${name}.`,
    inBrowser: 'Your Spending file is ready, kept in this browser.',
  },
  setUp: {
    firstAccount: 'Add one account',
    firstEntries: 'Import a Revolut export, or type your first entries on Entries',
    importLink: 'Import',
  },
  problems: {
    title: (count: number): EnglishForms => ({ one: 'A record in the Spending file is left out or doubted', other: `${count} records in the Spending file are left out or doubted` }),
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
    title: 'Počni s jednim računom',
    description: 'Račun kojim se najviše služite i njegovo stanje prvog u mjesecu. Zatim u Uvozu uvezite izvoz iz Revoluta ili upišite nekoliko unosa. Ostali računi mogu pričekati.',
    descriptionWithBank:
      'Račun kojim se najviše služite. Povežite banku pa mu retke donosi sinkronizacija s bankom ili ga dodajte ručno s njegovim stanjem prvog u mjesecu. Ostali računi mogu pričekati.',
    addAccount: 'Dodaj račun',
    linkABank: 'Poveži banku',
    addByHand: 'Dodaj ručno',
    onDrive: (name) => `Datoteka potrošnje je spremna i čuva se na Google Driveu kao „${name}”.`,
    inBrowser: 'Datoteka potrošnje je spremna i čuva se u ovom pregledniku.',
  },
  setUp: {
    firstAccount: 'Dodaj jedan račun',
    firstEntries: 'Uvezi izvoz iz Revoluta ili upiši prve unose na stranici Unosi',
    importLink: 'Uvoz',
  },
  problems: {
    title: (count): CroatianForms => ({
      one: `${count} zapis u datoteci potrošnje izostavljen je ili upitan`,
      few: `${count} zapisa u datoteci potrošnje izostavljena su ili upitna`,
      other: `${count} zapisa u datoteci potrošnje izostavljeno je ili upitno`,
    }),
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
