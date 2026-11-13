import { en as linkEn, hr as linkHr } from '../links/presentation/words'
import { language } from '../../../shared/text/language'
import type { CroatianForms, EnglishForms, Translation } from '../../../shared/text/translation'
import { en as statementsEnglish, hr as statementsCroatian } from '../statements/presentation/words'
import { en as workbookEn, hr as workbookHr } from '../workbook/domain/words'

/** The words on the screens a guide names, passed in so a guide calls each thing what the screen calls it. */
export interface GuideLabels {
  readonly entries: string
  readonly review: string
  readonly import: string
  readonly always: string
  readonly settings: string
  readonly rules: string
  readonly bankSync: string
  readonly limits: string
  readonly general: string
  readonly deployment: string
  readonly addReceipt: string
}

export const en = {
  automations: {
    bankSync: {
      title: 'Bank sync',
      what: (labels: GuideLabels) =>
        `While a bank is linked, every sync brings its new booked rows from OTP or Revolut into ${labels.entries}, ${labels.review}, with no file to upload. It is set up on ${labels.settings}, ${labels.bankSync}.`,
    },
  },
  settings: {
    bankSyncDeployment: `${workbookEn.settingLabels.deployment}, the bank sync script's API executable deployment. Blank leaves the whole sync off.`,
    bankLink: (bank: string) => `The day the approval for ${bank} runs out, set by linking the bank.`,
  },
  proposals: {
    ibanRule: (iban: string) => `Files every row from this IBAN: ${iban}`,
    withdrawalTo: (account: string) => `Cash taken out, into ${account}`,
    withdrawalByCurrency: 'Cash taken out, into the cash account in the same currency',
    rowsLeftOut: (count: number): EnglishForms => ({ one: '1 row of the statement is left out.', other: `${count} rows of the statement are left out.` }),
    fields: {
      name: 'Name',
      kind: 'Type',
      parent: 'Group',
      bank: 'Bank',
      currency: 'Currency',
      opening: 'Opening',
      openedOn: 'Opened',
      iban: 'IBAN',
      counterpartyIban: 'IBAN',
      account: 'Account',
      date: 'Date',
      amount: 'Amount',
      payee: 'Payee',
      category: 'Category',
      note: 'Note',
      link: linkEn.label,
      from: 'From',
      condition: 'Looks for',
      closed: 'Closed',
      rowsFrom: 'Rows',
      hidden: 'Hidden',
      key: 'Setting',
      value: 'Value',
      colour: 'Colour',
      order: 'Place',
      merchant: 'Merchant',
      merchantOib: "Merchant's OIB",
      buyerOib: "Buyer's OIB",
      issuedOn: 'Issued',
      issuedTime: 'Time',
      total: 'Total',
      jir: 'JIR',
      zki: 'ZKI',
      readBy: 'Read by',
      latitude: 'Latitude',
      longitude: 'Longitude',
      printed: 'Printed',
      text: 'Note',
      withdrawal: 'Where the money goes',
    },
  },
  receipts: {
    keepNoAccess: 'Kuna cannot reach Drive on this device now, so nothing was kept or saved. Add the receipt on Entries after a sync.',
    photoStays: 'The photo stays in the Receipts folder on Drive after Undo.',
    otherDay: (entry: string, receipt: string) => `The entry is from ${entry} and the receipt from ${receipt}`,
    otherAmount: (entry: string, receipt: string) => `The entry is ${entry} and the receipt ${receipt}, so a Difference line makes up the rest`,
    replacesSplit: (parts: string) => `The receipt's lines replace your split: ${parts}`,
    waits: (account: string) => `The bank fills ${account} and has not brought this payment yet, so the receipt waits on To review and goes on the bank's row when it comes.`,
  },
  startingAccount: {
    thisDevice: 'This device',
    field: 'New entries start on',
    changedSince: 'The account new entries start on changed in this browser since the card was made, so nothing was set.',
  },
  quickActions: {
    sort: { label: 'Sort what is waiting', prompt: statementsEnglish.review.suggestCategoriesTask },
    rules: { label: 'Check my rules', prompt: 'Read my rules and rows, and propose fixing or deleting any rule that files rows wrongly.' },
    higher: { label: 'Why was this month higher?', prompt: 'Why was my spending this month higher or lower than last month?' },
  },
  reads: {
    transaction: 'Money in or out of one account: each row of a statement and each typed entry.',
    account: 'Your own accounts, one per currency.',
    category: 'Groups and their categories.',
    budget: 'Monthly limits on spending categories.',
    rule: 'What files a bank row by itself.',
    receipt: "Fiscal receipts and the entry each split. A receipt for a card payment the bank has not brought yet has no entry and waits on its account until the bank's row comes.",
    waitingReceipt: "Receipts with no entry yet, waiting for the bank's row of their payment, which To review lists. They count nowhere until then.",
    line: 'The parts of every entry. A whole entry is one part, and one a receipt or a person split has its lines or parts. The figures count the parts.',
    waiting: 'The rows waiting on To review for a category, which count nowhere until filed.',
    linkInstalment: (loan: string, due: string) => `the instalment of the bank loan ${loan} due ${due}, in Loans`,
    linkInformalLoan: (name: string) => `the informal loan ${name}, in Loans`,
    linkGone: 'a record Loans no longer has',
    linkUnknown: 'a record of Loans, which cannot be read now',
    linkNotSetUp: 'a record of Loans, but Loans is not set up',
    bankSync: 'Whether the bank sync can bring a new account its rows, which needs a bank sync deployment saved on Settings, Bank sync.',
    bankAccount:
      "Each currency of each account the linked banks gave at this page's last bank sync, against your Spending accounts, as Settings, Bank sync lists them. A new sync or a reload changes them, and after a reload no rows are held.",
  },
  reports: {
    month: { title: "a month's totals", about: "A month's spending, income, money saved and savings rate, as the Overview shows them." },
    categories: { title: 'spending by category', about: 'What each group and category counted in a month, the month before and the change, for asking why a month was higher.' },
    limits: { title: 'the monthly limits', about: 'Each limited category in a month: its limit, what carried in, what it spent and what is left.' },
    balances: { title: 'the account balances', about: 'What each account holds at the end of a day, and all of them in euros.' },
  },
  guides: {
    setUp: {
      label: 'Set up Spending',
      title: 'Set up Spending with the chat',
      body: [
        'Have a statement of each account ready. Every statement, a Revolut export included, goes to the AI company as text cell by cell, as a PDF or as a photo.',
        'The cards, in this order:',
        '1. The accounts, on one card, each with the opening balance, the day the statement prints and whether its rows come from a linked bank or by hand. A linked bank needs the IBAN and a bank sync deployment saved on Settings, Bank sync.',
        '2. Each new category, on a card of its own.',
        '3. The rules and the import together, in parts of 150 rows.',
        'Linking a bank stays with the person, on Settings, Bank sync. Limits wait until a month of entries is in.',
      ].join('\n'),
    },
    rules: {
      title: 'Set up rules for your bank',
      body: (labels: GuideLabels) =>
        [
          'A rule files a statement row by itself. It looks at the payee, or at the IBAN on the other side, so it works the same for every bank that brings rows into Kuna.',
          `1. Bring in some rows, through ${labels.entries}, ${labels.import} or ${labels.settings}, ${labels.bankSync}. Rows no rule files wait on ${labels.entries}, ${labels.review}.`,
          `2. On ${labels.review}, pick a category for a row and choose ${labels.always}. Kuna shows how many rows the rule files before you save it.`,
          `3. Every rule is listed on ${labels.settings}, ${labels.rules}, where you can delete one.`,
          'A row you filed yourself stays as it is, whatever a rule says.',
        ].join('\n'),
    },
    import: {
      title: 'Import a statement',
      body: (labels: GuideLabels) =>
        [
          `On ${labels.entries}, ${labels.import}, drop a Revolut export, as its .xlsx or .csv file. Other banks have no file reader here yet, and their rows come through the bank sync.`,
          "In the chat, attach any bank's file, the Revolut export included, or paste a statement or attach it as a PDF or photo. Its rows go to the AI company, which copies them as printed. Kuna checks that they add up when the statement prints its balances, and asks about rows that look like ones it has.",
          'Kuna first shows what the file would do, and writes nothing until you import it. An import can be undone from the message that follows it.',
          `Rows no rule files then wait on ${labels.review}.`,
        ].join('\n'),
    },
    bankSync: {
      title: 'Link a bank',
      body: (labels: GuideLabels) =>
        [
          `The bank sync brings booked rows from OTP and Revolut through a script of your own, into the same review as a statement. It lives on ${labels.settings}, ${labels.bankSync}.`,
          `1. Deploy the script and save its ${labels.deployment} there. Without it the sync stays off.`,
          '2. Link each bank. Its approval runs out on a date the card shows, and then you link it again.',
          "3. After a sync, Bank accounts there lists every account the banks give. Add each, update it, keep yours or leave it out there, or ask the chat, which can also fix an opening the bank's balance disagrees with.",
        ].join('\n'),
    },
    limits: {
      title: 'Set a monthly limit',
      body: (labels: GuideLabels) =>
        `On ${labels.limits}, set a monthly limit in euros on a group such as Food, or on one of its categories. What a month leaves unspent carries into the next, and an overspent month lowers the next.`,
    },
    categories: {
      title: 'Change your categories',
      body: (labels: GuideLabels) => `Groups and categories are on ${labels.settings}, ${labels.general}. A hidden category keeps its entries.`,
    },
    receipts: {
      title: 'Add a receipt with the chat',
      body: (labels: GuideLabels) =>
        [
          `Attach a photo of a fiscal receipt in the chat, or take one from ${labels.entries}, ${labels.addReceipt}, or with the camera on an entry, which tags that entry. The chat copies its lines, and Kuna reads the QR code's date and total itself.`,
          '1. With an entry tagged, the card puts the receipt on it. Otherwise the chat asks Kuna which payments the receipt may be, with match_records and kind receipt.',
          '2. With one payment ready, the card puts the receipt on it. When several may be, the chat asks you which one. Any other payment you name goes too, and the card warns when its day or amount differ.',
          "3. When none is, the chat asks whether you paid in cash. Cash becomes a new entry on your cash account in euros, and the chat asks which one when you keep several. With none, it asks how much cash you had before paying, and the card adds a cash account with that opening from the receipt's day, so its balance is right from the start. A card payment on an account the bank fills waits on To review until the bank's row comes, and then goes on it.",
          '4. A receipt on an entry you split by hand replaces your parts with its lines, and the card lists the parts that go.',
          "5. A receipt whose buyer is your company files every line under For the company. Kuna knows the company by the OIB on Company's billing and invoice terms, so set it there. Without Company on this device, Kuna recognises no receipt as the company's.",
        ].join('\n'),
    },
  },
}

export const hr: Translation<typeof en> = {
  automations: {
    bankSync: {
      title: 'Sinkronizacija s bankom',
      what: (labels) =>
        `Dok je banka povezana, svaka sinkronizacija donosi nove proknjižene retke iz OTP-a ili Revoluta na zaslon ${labels.entries}, na karticu ${labels.review}, bez datoteke za učitavanje. Postavlja se na zaslonu ${labels.settings}, na kartici ${labels.bankSync}.`,
    },
  },
  settings: {
    bankSyncDeployment: `${workbookHr.settingLabels.deployment}. Ako je prazno, sinkronizacija je isključena.`,
    bankLink: (bank) => `Datum isteka odobrenja za ${bank}. Postavlja se povezivanjem banke.`,
  },
  proposals: {
    ibanRule: (iban) => `Razvrstava svaki redak s ovog IBAN-a: ${iban}`,
    withdrawalTo: (account) => `Podignuta gotovina, na račun ${account}`,
    withdrawalByCurrency: 'Podignuta gotovina, na račun gotovine u istoj valuti',
    rowsLeftOut: (count): CroatianForms => ({
      one: `Izostavljen je ${count} redak izvoda.`,
      few: `Izostavljena su ${count} retka izvoda.`,
      other: `Izostavljeno je ${count} redaka izvoda.`,
    }),
    fields: {
      name: 'Naziv',
      kind: 'Vrsta',
      parent: 'Skupina',
      bank: 'Banka',
      currency: 'Valuta',
      opening: 'Početno stanje',
      openedOn: 'Otvoren',
      iban: 'IBAN',
      counterpartyIban: 'IBAN',
      account: 'Račun',
      date: 'Datum',
      amount: 'Iznos',
      payee: 'Primatelj',
      category: 'Kategorija',
      note: 'Bilješka',
      link: linkHr.label,
      from: 'Od',
      condition: 'Uvjet',
      closed: 'Zatvoren',
      rowsFrom: 'Retci',
      hidden: 'Skrivena',
      key: 'Postavka',
      value: 'Vrijednost',
      colour: 'Boja',
      order: 'Mjesto',
      merchant: 'Trgovac',
      merchantOib: 'OIB trgovca',
      buyerOib: 'OIB kupca',
      issuedOn: 'Izdan',
      issuedTime: 'Vrijeme',
      total: 'Ukupno',
      jir: 'JIR',
      zki: 'ZKI',
      readBy: 'Pročitao',
      latitude: 'Geografska širina',
      longitude: 'Geografska dužina',
      printed: 'Ispisano',
      text: 'Bilješka',
      withdrawal: 'Kamo ide novac',
    },
  },
  receipts: {
    keepNoAccess: 'Kuna sada na ovom uređaju ne može doći do Drivea, pa ništa nije spremljeno. Dodajte fiskalni račun na zaslonu Unosi nakon sinkronizacije.',
    photoStays: 'Fotografija ostaje u mapi Receipts na Driveu i nakon poništavanja.',
    otherDay: (entry, receipt) => `Unos je od ${entry}, a fiskalni račun od ${receipt}`,
    otherAmount: (entry, receipt) => `Unos iznosi ${entry}, a fiskalni račun ${receipt}, pa ostatak pokriva stavka Razlika`,
    replacesSplit: (parts) => `Stavke fiskalnog računa zamjenjuju vašu podjelu: ${parts}`,
    waits: (account) => `Račun ${account} puni banka, a ovo plaćanje još nije stiglo, pa fiskalni račun čeka pod Za pregled i ide na redak iz banke kad stigne.`,
  },
  startingAccount: {
    thisDevice: 'Ovaj uređaj',
    field: 'Novi unosi počinju na',
    changedSince: 'Račun na kojem počinju novi unosi promijenio se u ovom pregledniku otkako je kartica napravljena, pa ništa nije postavljeno.',
  },
  quickActions: {
    sort: { label: 'Razvrstaj ono što čeka', prompt: statementsCroatian.review.suggestCategoriesTask },
    rules: { label: 'Provjeri moja pravila', prompt: 'Pročitaj moja pravila i retke te predloži ispravak ili brisanje pravila koje pogrešno razvrstava.' },
    higher: { label: 'Zašto je ovaj mjesec viši?', prompt: 'Zašto mi je potrošnja ovaj mjesec viša ili niža nego prošli mjesec?' },
  },
  reads: {
    transaction: 'Novac koji ulazi na račun ili izlazi s njega: svaki redak izvoda i svaki upisani unos.',
    account: 'Vaši računi, po jedan za svaku valutu.',
    category: 'Skupine i njihove kategorije.',
    budget: 'Mjesečna ograničenja na kategorije potrošnje.',
    rule: 'Ono što sâmo razvrstava bankovni redak.',
    receipt: 'Fiskalni računi i unos koji je svaki podijelio. Fiskalni račun za plaćanje karticom koje banka još nije donijela nema unos i čeka na svom računu dok ne stigne redak iz banke.',
    waitingReceipt: 'Fiskalni računi još bez unosa, koji čekaju redak iz banke za svoje plaćanje i navedeni su pod Za pregled. Do tada se ne broje nigdje.',
    line: 'Dijelovi svakog unosa. Cijeli unos je jedan dio, a unos podijeljen fiskalnim računom ili ručno ima svoje stavke ili dijelove. Iznosi broje dijelove.',
    waiting: 'Retci koji pod Za pregled čekaju kategoriju i ne broje se nigdje dok se ne razvrstaju.',
    linkInstalment: (loan, due) => `rata kredita ${loan} s dospijećem ${due}, u Kreditima`,
    linkInformalLoan: (name) => `pozajmica ${name}, u Kreditima`,
    linkGone: 'zapis kojeg Krediti više nemaju',
    linkUnknown: 'zapis iz Kredita koji se sada ne može pročitati',
    linkNotSetUp: 'zapis iz Kredita, ali Krediti nisu postavljeni',
    bankSync: 'Može li sinkronizacija s bankom donositi retke novom računu, za što treba spremiti implementaciju sinkronizacije u Postavkama, na kartici Banke.',
    bankAccount:
      'Svaka valuta svakog računa koji su povezane banke dale pri zadnjoj sinkronizaciji na ovoj stranici, uz vaše račune u Potrošnji, kako ih navodi Postavke, Sinkronizacija s bankom. Nova sinkronizacija ili ponovno učitavanje ih mijenja, a nakon ponovnog učitavanja nijedan redak nije zadržan.',
  },
  reports: {
    month: { title: 'zbroj mjeseca', about: 'Potrošnja, prihodi, ušteđeni novac i stopa štednje u mjesecu, kako ih prikazuje Pregled.' },
    categories: { title: 'potrošnja po kategorijama', about: 'Koliko je svaka skupina i kategorija brojala u mjesecu, u mjesecu prije i razlika, za pitanja zašto je mjesec bio viši.' },
    limits: { title: 'mjesečna ograničenja', about: 'Svaka ograničena kategorija u mjesecu: ograničenje, preneseno, potrošeno i preostalo.' },
    balances: { title: 'stanja računa', about: 'Koliko svaki račun ima na kraju dana i svi zajedno u eurima.' },
  },
  guides: {
    setUp: {
      label: 'Postavi Potrošnju',
      title: 'Postavi Potrošnju kroz razgovor',
      body: [
        'Pripremite izvod svakog računa. Svaki izvod, i izvoz iz Revoluta, ide AI tvrtki kao tekst ćeliju po ćeliju, kao PDF ili kao fotografija.',
        'Kartice, ovim redom:',
        '1. Računi, na jednoj kartici, svaki s početnim stanjem, danom koje izvod ispisuje i načinom na koji mu dolaze retci, iz povezane banke ili ručno. Za povezanu banku potrebni su IBAN i spremljena implementacija sinkronizacije u Postavkama, na kartici Banke.',
        '2. Svaka nova kategorija, na svojoj kartici.',
        '3. Pravila i uvoz zajedno, u dijelovima od 150 redaka.',
        'Povezivanje banke ostaje osobi, u Postavkama, na kartici Banke. Limiti čekaju dok ne uđe mjesec unosa.',
      ].join('\n'),
    },
    rules: {
      title: 'Postavi pravila za svoju banku',
      body: (labels) =>
        [
          'Pravilo automatski razvrstava redak izvoda. Gleda primatelja ili IBAN druge strane, pa jednako radi za svaku banku čiji retci dolaze u Kunu.',
          `1. Uvezite retke na zaslonu ${labels.entries}, na kartici ${labels.import}, ili ih donesite sinkronizacijom na zaslonu ${labels.settings}, na kartici ${labels.bankSync}. Retci koje nijedno pravilo ne razvrsta čekaju na zaslonu ${labels.entries}, na kartici ${labels.review}.`,
          `2. Na kartici ${labels.review} odaberite kategoriju za redak i zatim ${labels.always}. Prije spremanja Kuna pokaže koliko redaka pravilo razvrstava.`,
          `3. Sva pravila navedena su na zaslonu ${labels.settings}, na kartici ${labels.rules}, gdje ih možete i obrisati.`,
          'Redak koji ste sami razvrstali ostaje kakav jest, što god pravilo kaže.',
        ].join('\n'),
    },
    import: {
      title: 'Uvezi izvod',
      body: (labels) =>
        [
          `Na zaslonu ${labels.entries}, na kartici ${labels.import} ispustite izvoz iz Revoluta, kao datoteku .xlsx ili .csv. Za druge banke ovdje još nema čitača datoteka, a njihovi retci dolaze sinkronizacijom s bankom.`,
          'U razgovoru priložite datoteku bilo koje banke, i izvoz iz Revoluta, ili zalijepite izvod ili ga priložite kao PDF ili fotografiju. Njegovi retci idu AI tvrtki, koja ih prepisuje kako su ispisani. Kuna provjerava zbrajaju li se kad izvod ispisuje stanja i pita za retke koji nalikuju onima koje već ima.',
          'Kuna najprije pokaže što bi datoteka učinila i ne zapisuje ništa dok je ne uvezete. Uvoz možete poništiti iz poruke koja slijedi.',
          `Retci koje nijedno pravilo ne razvrsta zatim čekaju na kartici ${labels.review}.`,
        ].join('\n'),
    },
    bankSync: {
      title: 'Poveži banku',
      body: (labels) =>
        [
          `Sinkronizacija s bankom donosi proknjižene retke iz OTP-a i Revoluta preko vaše vlastite skripte, u isti pregled kao i izvod. Nalazi se na zaslonu ${labels.settings}, na kartici ${labels.bankSync}.`,
          `1. Objavite skriptu (Deploy u uređivaču skripte) pa tamo spremite ${labels.deployment}. Bez toga sinkronizacija ostaje isključena.`,
          '2. Povežite svaku banku. Odobrenje istječe na datum s kartice i tada banku ponovno povežite.',
          '3. Nakon sinkronizacije ondje Bankovni računi navode svaki račun koji banke daju. Svaki ondje dodajte, ažurirajte, zadržite svoje podatke ili ga izostavite, ili zamolite razgovor, koji može i ispraviti početno stanje s kojim se stanje u banci ne slaže.',
        ].join('\n'),
    },
    limits: {
      title: 'Postavi mjesečno ograničenje',
      body: (labels) =>
        `Na zaslonu ${labels.limits} postavite mjesečno ograničenje u eurima na skupinu kao što je Hrana ili na neku od njezinih kategorija. Ono što u mjesecu ne potrošite prenosi se u sljedeći, a prekoračenje umanjuje sljedeći mjesec.`,
    },
    categories: {
      title: 'Promijeni kategorije',
      body: (labels) => `Skupine i kategorije nalaze se na zaslonu ${labels.settings}, na kartici ${labels.general}. Skrivena kategorija zadržava svoje unose.`,
    },
    receipts: {
      title: 'Dodaj fiskalni račun kroz razgovor',
      body: (labels) =>
        [
          `Priložite fotografiju fiskalnog računa u razgovoru ili je snimite na zaslonu ${labels.entries}, pod ${labels.addReceipt}, ili kamerom na unosu, koja označava taj unos. Razgovor prepisuje stavke, a Kuna sama čita datum i ukupan iznos iz QR koda.`,
          '1. Kad je unos označen, kartica stavlja račun na njega. Inače razgovor pita Kunu koja bi plaćanja mogla biti taj račun, alatom match_records s vrstom receipt.',
          '2. Kad je spremno jedno plaćanje, kartica stavlja račun na njega. Kad ih može biti više, razgovor vas pita koje. Ide i svako drugo plaćanje koje navedete, a kartica upozorava kad se dan ili iznos razlikuju.',
          '3. Kad nijedno ne odgovara, razgovor pita jeste li platili gotovinom. Gotovina postaje novi unos na vašem računu gotovine u eurima, a razgovor pita koji kad ih imate više. Ako ga nemate, pita koliko ste gotovine imali prije plaćanja, a kartica dodaje račun gotovine s tim početnim stanjem od dana računa, pa je stanje točno od početka. Plaćanje karticom na računu koji puni banka čeka pod Za pregled dok ne stigne redak iz banke, a zatim ide na njega.',
          '4. Fiskalni račun na unosu koji ste ručno podijelili zamjenjuje vaše dijelove svojim stavkama, a kartica navodi dijelove koji odlaze.',
          '5. Fiskalni račun na kojem je kupac vaša tvrtka sve stavke stavlja pod Za tvrtku. Kuna prepoznaje tvrtku po OIB-u iz uvjeta naplate i računa u Tvrtki, pa ga upišite ondje. Bez Tvrtke na ovom uređaju nijedan račun ne ide na tvrtku.',
        ].join('\n'),
    },
  },
}

export const words = language === 'hr' ? hr : en
