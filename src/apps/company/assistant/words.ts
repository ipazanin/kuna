import { language } from '../../../shared/text/language'
import type { Translation } from '../../../shared/text/translation'
import { en as transactionsEnglish, hr as transactionsCroatian } from '../transactions/presentation/words'

/** The words on the screens a guide names, passed in so a guide calls each thing what the screen calls it. */
export interface GuideLabels {
  readonly transactions: string
  readonly review: string
  readonly suggest: string
  readonly ask: string
  readonly recategorise: string
  readonly makeRule: string
  readonly settings: string
  readonly categoryRules: string
}

/** The words on the screens an automation names, passed in so it calls each thing what the screen calls it. */
export interface AutomationLabels {
  readonly settings: string
  readonly general: string
  readonly mail: string
  readonly review: string
}

export const en = {
  automations: {
    statementsFromMail: {
      title: 'Bank statements filed from mail',
      what: (labels: AutomationLabels) =>
        `Each sync looks in Gmail for the statement mail of your bank, saves its attachments into the statements folder in Drive, and files the new statements into the ledger. Rows no rule decides wait on ${labels.review}. It is set up on ${labels.settings}, ${labels.general}, on the ${labels.mail} card.`,
    },
    statementsOnSync: {
      title: 'New statements read on sync',
      what: (labels: AutomationLabels) =>
        `Each sync reads the camt statements in your statements folder that the books lack, with no file to import by hand. Rows no rule decides wait on ${labels.review}. It is set up on ${labels.settings}, ${labels.general}, by naming the folder and turning on filing new statements on sync.`,
    },
  },
  reads: {
    ledgerRow: 'One row of a bank statement in the ledger, with its category once it is filed.',
    splitPart: 'The parts of every ledger row: how much of the payment counts in which category. A row not split is one part.',
    category: 'The categories rows are filed in, each with its bucket in profit and loss.',
    account: "The company's own bank accounts.",
    rule: 'What files a bank row by itself, tried in order.',
    client: 'The clients the company invoices.',
    invoice: 'The invoices on the register, each to a client.',
    billingItem: 'What is to be invoiced and when, from the billing plan.',
    setting: "The settings that say how the company's figures and invoices read.",
  },
  reports: {
    month: {
      title: "a month's income and operating cost",
      about:
        "A month's income under the label on screen, its operating cost while owner pay is shown apart from it, and how many rows wait on To review. Taxes hold the taxes on pay, so they are in the owner pay report.",
    },
    profit: {
      title: "a month's taxes, owner pay and profit",
      about:
        "A month's taxes, owner pay, whole cost, what is left and what the owner earns, under the labels on screen, with each category of pay and of the taxes on pay. It holds pay, so it stays on this device while Anonymise is on and the company has an employee.",
    },
    categories: { title: 'income and cost by category', about: 'What each category counted in a month, the month before and the change. Pay and the taxes on pay are left out.' },
    balances: { title: 'the account balances', about: "Each account's balance at the end of a day, and all of them together." },
    receivables: { title: 'what clients owe', about: 'What the invoices still have unpaid on a day, how much of it is late, and how late.' },
  },
  guides: {
    setUp: {
      title: 'Set up Company with the chat',
      body: [
        'Have ready the court register extract, an issued invoice and a bank statement. Each goes to the AI company as text cell by cell, as a PDF or as a photo, a camt.053 statement included.',
        'The cards, in this order:',
        '1. The settings: company_name, the currency, the number style, owner_pay_module and the invoice issuer fields the extract or the invoice prints.',
        '2. The accounts.',
        '3. Each new category, on a card of its own, with its tax class.',
        '4. The rules.',
        '5. The import, which holds only its rows, in parts of 150 rows.',
        'The tax class and VAT treatment of a category are proposed one at a time and decided by the person. Payroll stays out.',
      ].join('\n'),
    },
    review: {
      title: 'Sort the rows waiting for review',
      body: (labels: GuideLabels) =>
        [
          `Rows no rule decides wait on ${labels.transactions}, ${labels.review}. Open one to see its counterparty, description, amount and what the rules say about it.`,
          `1. To have the chat suggest categories, press ${labels.suggest} on that tab. The chat opens about the rows waiting and asks for categories by itself. It proposes a card that files the rows it is sure of and asks about the rest. Nothing changes until you accept the card.`,
          `2. To ask about one row, open it and press ${labels.ask}.`,
          `3. Or pick a category yourself with ${labels.recategorise} on the row.`,
          `4. The toast after a recategorise offers ${labels.makeRule}, so the same kind of row is sorted on its own next time. Every rule is listed on ${labels.settings}, ${labels.categoryRules}.`,
        ].join('\n'),
    },
  },
  settings: {
    mailDrafts: 'Whether an invoice made on this device also saves a Gmail draft with the PDF attached. Nothing is ever sent. Turning it on for books on Drive asks Google to allow Gmail drafts.',
  },
  quickActions: {
    sort: { label: 'Sort what is waiting', prompt: transactionsEnglish.review.suggestCategoriesTask },
    month: { label: 'How did this month go?', prompt: "How do this month's income, cost and profit compare with last month?" },
    rules: { label: 'Check my rules', prompt: 'Read my category rules and the rows they file, and propose fixing any rule that files rows wrongly.' },
  },
}

export const hr: Translation<typeof en> = {
  automations: {
    statementsFromMail: {
      title: 'Izvodi banke iz pošte',
      what: (labels) =>
        `Svaka sinkronizacija u Gmailu traži poštu s izvodima vaše banke, sprema privitke u mapu izvoda na Driveu i upisuje nove izvode u evidenciju. Retci koje nijedno pravilo ne razvrsta čekaju na kartici ${labels.review}. Postavlja se na zaslonu ${labels.settings}, na kartici ${labels.general}, u kartici ${labels.mail}.`,
    },
    statementsOnSync: {
      title: 'Novi izvodi pri sinkronizaciji',
      what: (labels) =>
        `Svaka sinkronizacija čita camt izvode iz vaše mape izvoda koji još nisu u knjigama, bez ručnog uvoza datoteke. Retci koje nijedno pravilo ne razvrsta čekaju na kartici ${labels.review}. Postavlja se na zaslonu ${labels.settings}, na kartici ${labels.general}, tako da navedete mapu i uključite spremanje novih izvoda pri sinkronizaciji.`,
    },
  },
  reads: {
    ledgerRow: 'Jedan redak izvoda banke u evidenciji, s kategorijom kad je razvrstan.',
    splitPart: 'Dijelovi svakog retka evidencije: koliki dio plaćanja ide u koju kategoriju. Redak koji nije podijeljen je jedan dio.',
    category: 'Kategorije u koje se razvrstavaju retci, svaka sa svojom skupinom u računu dobiti i gubitka.',
    account: 'Bankovni računi tvrtke.',
    rule: 'Ono što sâmo razvrstava bankovni redak, redom kojim se pravila isprobavaju.',
    client: 'Klijenti kojima tvrtka izdaje račune.',
    invoice: 'Računi u knjizi računa, svaki jednom klijentu.',
    billingItem: 'Što treba fakturirati i kada, iz plana fakturiranja.',
    setting: 'Postavke koje određuju kako se čitaju iznosi i računi tvrtke.',
  },
  reports: {
    month: {
      title: 'prihodi i poslovni troškovi mjeseca',
      about:
        'Prihodi u mjesecu pod nazivom sa zaslona, poslovni troškovi dok je plaća vlasnika prikazana odvojeno od njih te koliko redaka čeka provjeru. Porezi sadrže poreze na plaću, pa su u izvještaju o plaći vlasnika.',
    },
    profit: {
      title: 'porezi, plaća vlasnika i dobit mjeseca',
      about:
        'Porezi, plaća vlasnika, ukupni trošak, ono što ostaje i koliko vlasnik zarađuje u mjesecu, pod nazivima sa zaslona, sa svakom kategorijom plaće i poreza na plaću. Sadrži plaću, pa ostaje na ovom uređaju dok je uključena anonimizacija i tvrtka ima zaposlenika.',
    },
    categories: { title: 'prihodi i troškovi po kategorijama', about: 'Koliko je svaka kategorija brojala u mjesecu, u mjesecu prije i razlika. Plaća i porezi na plaću nisu uključeni.' },
    balances: { title: 'stanja računa', about: 'Stanje svakog računa na kraju dana i svih zajedno.' },
    receivables: { title: 'što klijenti duguju', about: 'Što je na dan još neplaćeno po računima, koliko od toga kasni i koliko.' },
  },
  guides: {
    setUp: {
      title: 'Postavi Tvrtku kroz razgovor',
      body: [
        'Pripremite izvadak iz sudskog registra, jedan izdani račun i bankovni izvod. Svaki ide AI tvrtki kao tekst ćeliju po ćeliju, kao PDF ili kao fotografija, i izvod camt.053.',
        'Kartice, ovim redom:',
        '1. Postavke: company_name, valuta, zapis brojeva, owner_pay_module i podaci izdavatelja računa koje ispisuje izvadak ili račun.',
        '2. Računi.',
        '3. Svaka nova kategorija, na svojoj kartici, s poreznim razredom.',
        '4. Pravila.',
        '5. Uvoz, koji drži samo svoje retke, u dijelovima od 150 redaka.',
        'Porezni razred i PDV kategorije predlažu se jedan po jedan, a odlučuje osoba. Plaće ostaju izvan.',
      ].join('\n'),
    },
    review: {
      title: 'Razvrstaj retke koji čekaju provjeru',
      body: (labels) =>
        [
          `Retci koje nijedno pravilo ne razvrsta čekaju na zaslonu ${labels.transactions}, na kartici ${labels.review}. Otvorite redak da vidite partnera, opis, iznos i što pravila kažu o njemu.`,
          `1. Da vam razgovor predloži kategorije, pritisnite ${labels.suggest} na toj kartici. Razgovor se otvara o retcima koji čekaju i sam traži kategorije. Predlaže karticu koja razvrstava retke u koje je siguran i pita za ostale. Ništa se ne mijenja dok ne prihvatite karticu.`,
          `2. Da pitate o jednom retku, otvorite ga i pritisnite ${labels.ask}.`,
          `3. Ili sami odaberite kategoriju gumbom ${labels.recategorise} na retku.`,
          `4. Poruka nakon promjene kategorije nudi ${labels.makeRule}, pa se ista vrsta retka sljedeći put razvrsta sama. Sva pravila navedena su na zaslonu ${labels.settings}, na kartici ${labels.categoryRules}.`,
        ].join('\n'),
    },
  },
  settings: {
    mailDrafts: 'Sprema li račun izrađen na ovom uređaju i skicu u Gmailu s priloženim PDF-om. Ništa se nikad ne šalje. Kad se uključi za knjige na Driveu, Google traži dopuštenje za skice u Gmailu.',
  },
  quickActions: {
    sort: { label: 'Razvrstaj ono što čeka', prompt: transactionsCroatian.review.suggestCategoriesTask },
    month: { label: 'Kako je prošao ovaj mjesec?', prompt: 'Kako se prihodi, troškovi i dobit ovog mjeseca uspoređuju s prošlim mjesecom?' },
    rules: { label: 'Provjeri moja pravila', prompt: 'Pročitaj moja pravila za kategorije i retke koje razvrstavaju te predloži ispravak pravila koje pogrešno razvrstava.' },
  },
}

export const words = language === 'hr' ? hr : en
