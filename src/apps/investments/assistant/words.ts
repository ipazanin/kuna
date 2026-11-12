import type { CivilDate } from '../../../shared/calendar/civilDate'
import { dayLabel } from '../../../shared/calendar/dayLabel'
import { language } from '../../../shared/text/language'
import { listInWords } from '../../../shared/text/listInWords'
import type { CroatianForms, EnglishForms, Translation } from '../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. IBKR's report is izvješće, and the Investments app is Ulaganja.

/** The words on the screens an automation names, passed in so it calls each thing what the screen calls it. */
export interface AutomationLabels {
  readonly settings: string
  readonly general: string
  readonly prices: string
  readonly mail: string
}

export const en = {
  guides: {
    setUp: {
      title: 'Set up Investments with the chat',
      body: [
        "Have ready each broker's statements. Every statement, an IBKR Flex report and the portfolio workbook included, goes to the AI company as text cell by cell, as a PDF or as a photo.",
        'The cards, in this order:',
        '1. The accounts, one for each broker account.',
        '2. The import, in parts. Opening positions go as holdings when the person says the history is not complete.',
        "Tax treatment, split ratios, exchange rates, whether two accounts are one person's and whether the history is complete stay with the person.",
      ].join('\n'),
    },
  },
  settings: {
    surtaxCity2023:
      "Porezna's code of the city or municipality the owner lived in during 2023, or none for one with no surtax. Its city surtax goes on the 2023 capital gains tax. Look the place up by name with find_records in surtax-city-2023 first, and propose its code with set-setting. Two places of one name differ by their office, so ask which when both match.",
  },
  automations: {
    dailyCloses: {
      title: 'Daily closes',
      what: (labels: AutomationLabels) =>
        `Kuna fetches the closing prices itself once a day, with your own free keys, for the instruments that name a vendor. Add the keys and pick each instrument's vendor on ${labels.settings}, ${labels.prices}.`,
    },
    ibkrMail: {
      title: 'IBKR report from mail',
      what: (labels: AutomationLabels) =>
        `Each sync reads IBKR's daily Activity Flex report from Gmail, so trades, dividends, tax withheld, conversions and fees reach Investments with no upload. New records wait for a review with one tap to accept. It is set up on ${labels.settings}, ${labels.general}, on the ${labels.mail} card.`,
    },
  },
  quickActions: {
    doing: { label: 'How is my portfolio doing?', prompt: 'How is my portfolio doing: its value, what I put in, the total gain and what drove it?' },
    income: { label: 'What did I earn this year?', prompt: 'What income did my holdings pay this year, and how much tax was withheld?' },
  },
  reads: {
    account: 'Accounts at brokers, each holding units and cash in any currency.',
    instrument: 'What the owner buys and sells: shares, funds, bonds, gold and crypto, with where their prices come from.',
    trade: 'Buys and sales of units in an account.',
    income: 'Dividends, coupons, interest and other income paid into an account, with the tax withheld.',
    cashMovement: 'Deposits, withdrawals, fees and fee refunds of an account.',
    exchange: 'Cash of one currency changed into another in an account.',
    transfer: 'Units or cash moved between two of the owner’s accounts.',
    split: 'Splits of an instrument’s units.',
    spinOff: 'Units of a new instrument received for holding another.',
    price: 'Closes typed by hand, such as a fund’s price from its statement.',
    fundMix: 'A fund’s own split by sector or country, typed from its factsheet.',
    target: 'The share of the value each group of one mix should hold.',
    check: 'The portfolio checks whose threshold or switch differs from the default.',
    setting: 'The Investments settings.',
    surtaxCity2023: "Porezna's table of surtax rates for 2023, each place with its code, its office and its rate. Search it by the place's name.",
  },
  reports: {
    portfolio: {
      title: 'the portfolio',
      about: 'The value, what was put in, cost, gains, income, fees and the yearly return on a day, as the Overview shows them. Null is today. A past day counts the records up to it.',
    },
    holdings: {
      title: 'the holdings',
      about: "Each held instrument's value, cost, gains, income and weight, and each account's cash in euros, on a day, as the Holdings screen shows them. Null is today.",
    },
    income: { title: "a year's income", about: 'Dividends, interest and other income of a year, gross, withheld and received, in euros. Any month of the year names it.' },
    tax: {
      title: "a year's tax",
      about:
        'The capital gains tax and the tax on income from abroad of a year, as the Tax screen shows them. Any month of the year names it. Empty until the owner confirms on the Tax screen that the file holds every buy, and for a year the screen does not offer.',
    },
  },
  proposals: {
    units: (quantity: string, instrument: string) => `${quantity} of ${instrument}`,
    percent: (value: string) => `${value}%`,
    bondQuoting: (quoting: string, coupon: string, maturity: string) => `${quoting}, coupon ${coupon} a year, matures ${maturity}`,
    pricesFetched: (instruments: readonly string[]) => `Kuna fetches the prices of ${listInWords(instruments)} after Accept. Undo leaves the prices it fetched.`,
    ratesMissing: (currencies: string, from: CivilDate, place: string) =>
      `The prices file lacks the ECB rates of ${currencies} from ${dayLabel(from)}, which the rows need. Import with ${place}, which fetches them first.`,
    holdingsAsked: (holdings: string, place: string) =>
      `The import asks about the split or spin-off of ${holdings}, whose answer sets the cost and so the tax. Link ${place} and leave the answer to the person.`,
    rowsWaiting: (count: number, place: string): EnglishForms => ({
      one: `1 row waits. Answer it in ${place}.`,
      other: `${count} rows wait. Answer them in ${place}.`,
    }),
    rowsSkipped: (count: number, place: string): EnglishForms => ({
      one: `1 row Kuna cannot read stays out, and ${place} lists it.`,
      other: `${count} rows Kuna cannot read stay out, and ${place} lists them.`,
    }),
    rowsAsked: (count: number): EnglishForms => ({ one: '1 row the report asks about stays waiting.', other: `${count} rows the report asks about stay waiting.` }),
    rowsLeftOut: (count: number): EnglishForms => ({ one: '1 row left out', other: `${count} rows left out` }),
    mailReport: { label: 'IBKR report by mail', place: 'the review on Settings, General' },
    transcribed: 'Rows read by the AI',
    lookAlike: {
      one: 'a record Kuna has from another file, of the same account, day and amounts',
      many: 'records Kuna has from another file, each of the same account, day and amounts',
      another: 'the same record or another one',
    },
    transcribedRead: (count: number, source: string): EnglishForms => ({
      one: `The AI read 1 row ${source}. Kuna could not check that the file adds up, so check it against the file.`,
      other: `The AI read ${count} rows ${source}. Kuna could not check that the file adds up, so check them against the file.`,
    }),
    transcribedTied: (count: number, source: string): EnglishForms => ({
      one: `The AI read 1 row ${source}. Its cash adds up to the balances the file prints, but check the rest against the file.`,
      other: `The AI read ${count} rows ${source}. Their cash adds up to the balances the file prints, but check the rest against the file.`,
    }),
    transcribedWaiting: (count: number, reasons: string): EnglishForms => ({
      one: `1 row waits and is not imported. ${reasons}.`,
      other: `${count} rows wait and are not imported. ${reasons}.`,
    }),
    transcribedRatesMissing: (currencies: string, from: CivilDate) =>
      `The prices file lacks the ECB rates of ${currencies} from ${dayLabel(from)}, which the rows need. Propose fetch-prices on a card of its own, then these rows again.`,
    transcribedHoldingsAsked: (holdings: string) =>
      `The rows hold a split or a spin-off of ${holdings}, whose answer sets the cost and so the tax. Propose the rows without it, and add-split or add-spin-off once the person gives the ratio or the share of the cost.`,
    fields: {
      name: 'Name',
      note: 'Note',
      account: 'Account',
      instrument: 'Holding',
      side: 'Buy or sell',
      date: 'Date',
      quantity: 'Units',
      price: 'Price',
      fees: 'Fees',
      rate: 'Rate per EUR',
      accrued: 'Accrued interest',
      kind: 'Kind',
      currency: 'Currency',
      quoted: 'Price is',
      gross: 'Gross',
      withheld: 'Tax withheld',
      amount: 'Amount',
      sold: 'Sold',
      soldCurrency: 'Sold currency',
      bought: 'Bought',
      boughtCurrency: 'Bought currency',
      from: 'From',
      to: 'To',
      moved: 'Moved',
      newUnits: 'New units',
      oldUnits: 'Old units',
      received: 'Received',
      costShare: 'Cost moved',
      type: 'Type',
      class: 'Class',
      isin: 'ISIN',
      symbol: 'Symbol',
      exchange: 'Exchange',
      prices: 'Price source',
      sourceSymbol: 'Symbol at the source',
      sector: 'Sector',
      country: 'Country or region',
      ter: 'Yearly cost',
      distribution: 'Dividends',
      slice: 'Group',
      percent: 'Percent',
      check: 'Check',
      threshold: 'Threshold',
      off: 'Switched off',
      benchmark: 'Benchmark',
      leftOut: 'Rows asked about',
    },
  },
  cards: {
    historyComplete: 'The file holds every buy and sale since the first, so tax shows',
    everyHolding: "The day's closes and ECB rates of every holding",
    vendorsOutside: 'Kuna asks the price vendors with the keys of this browser and writes what they send to the prices file beside the books.',
    failuresListed: 'Each is listed there with what to do.',
    requestsToday: 'Requests today',
    countChanged: 'Nothing was changed. Kuna asked the vendor again since the card was made.',
    otherFile: 'Another Investments file is on screen now, and the answer belongs to the one the card was for.',
  },
}

export const hr: Translation<typeof en> = {
  guides: {
    setUp: {
      title: 'Postavite Ulaganja kroz razgovor',
      body: [
        'Pripremite izvode svakog brokera. Svaki izvod, i IBKR-ov Flex izvještaj i radna knjiga portfelja, ide AI tvrtki kao tekst ćeliju po ćeliju, kao PDF ili kao fotografija.',
        'Kartice, ovim redom:',
        '1. Računi, po jedan za svaki račun kod brokera.',
        '2. Uvoz, u dijelovima. Početne pozicije idu kao pozicije kad osoba kaže da povijest nije cijela.',
        'Porezni tretman, omjeri podjele dionica, tečajevi, jesu li dva računa iste osobe i je li povijest cijela ostaju osobi.',
      ].join('\n'),
    },
  },
  settings: {
    surtaxCity2023:
      'Šifra Porezne za grad ili općinu u kojoj je vlasnik živio 2023., ili none za onu bez prireza. Njezin prirez ide na porez na kapitalne dobitke za 2023. Najprije potražite mjesto po imenu s find_records u surtax-city-2023, a zatim predložite njegovu šifru sa set-setting. Dva mjesta istog imena razlikuju se po ispostavi, pa pitajte koje kad se oba podudaraju.',
  },
  automations: {
    dailyCloses: {
      title: 'Dnevne zaključne cijene',
      what: (labels) =>
        `Kuna sama jednom dnevno dohvaća zaključne cijene, vašim besplatnim ključevima, za instrumente kojima je odabran izvor. Dodajte ključeve i odaberite izvor svakog instrumenta na zaslonu ${labels.settings}, na kartici ${labels.prices}.`,
    },
    ibkrMail: {
      title: 'Izvješće IBKR-a iz pošte',
      what: (labels) =>
        `Svaka sinkronizacija iz Gmaila čita IBKR-ovo dnevno izvješće Activity Flex, pa transakcije, dividende, obustavljeni porez, konverzije i naknade stižu u Ulaganja bez učitavanja. Novi zapisi čekaju pregled s prihvaćanjem jednim dodirom. Postavlja se na zaslonu ${labels.settings}, na kartici ${labels.general}, u kartici ${labels.mail}.`,
    },
  },
  quickActions: {
    doing: { label: 'Kako stoji moj portfelj?', prompt: 'Kako stoji moj portfelj: vrijednost, koliko sam uložio, ukupna dobit i što ju je pokrenulo?' },
    income: { label: 'Koliko sam zaradio ove godine?', prompt: 'Koliki su prihod moje pozicije isplatile ove godine i koliko je poreza obustavljeno?' },
  },
  reads: {
    account: 'Računi kod brokera, svaki s jedinicama i novcem u bilo kojoj valuti.',
    instrument: 'Ono što vlasnik kupuje i prodaje: dionice, fondovi, obveznice, zlato i kripto, s izvorom njihovih cijena.',
    trade: 'Kupnje i prodaje jedinica na računu.',
    income: 'Dividende, kuponi, kamate i drugi prihodi uplaćeni na račun, s obustavljenim porezom.',
    cashMovement: 'Uplate, isplate, naknade i povrati naknada računa.',
    exchange: 'Novac jedne valute zamijenjen za drugu na računu.',
    transfer: 'Jedinice ili novac preneseni između dvaju vlasnikovih računa.',
    split: 'Podjele jedinica instrumenta.',
    spinOff: 'Jedinice novog instrumenta primljene zbog držanja drugog.',
    price: 'Ručno upisane zaključne cijene, na primjer cijena fonda s njegova izvoda.',
    fundMix: 'Raspodjela fonda po sektoru ili državi, upisana s njegova informativnog lista.',
    target: 'Udio vrijednosti koji bi svaka skupina jedne raspodjele trebala imati.',
    check: 'Provjere portfelja čiji se prag ili uključenost razlikuju od zadanih.',
    setting: 'Postavke Ulaganja.',
    surtaxCity2023: 'Tablica stopa prireza Porezne za 2023., svako mjesto sa šifrom, ispostavom i stopom. Pretražite je po imenu mjesta.',
  },
  reports: {
    portfolio: {
      title: 'portfelj',
      about: 'Vrijednost, uloženo, trošak, dobit, prihod, naknade i godišnji prinos na dan, kako ih prikazuje Pregled. Null je danas. Raniji dan broji zapise do njega.',
    },
    holdings: {
      title: 'pozicije',
      about: 'Vrijednost, trošak, dobit, prihod i udio svakog instrumenta koji se drži te novac svakog računa u eurima na dan, kako ih prikazuje zaslon Pozicije. Null je danas.',
    },
    income: { title: 'prihod godine', about: 'Dividende, kamate i drugi prihod godine, bruto, obustavljeno i primljeno, u eurima. Bilo koji mjesec godine je imenuje.' },
    tax: {
      title: 'porez godine',
      about:
        'Porez na kapitalne dobitke i porez na prihod iz inozemstva u godini, kako ih prikazuje zaslon Porez. Bilo koji mjesec godine je imenuje. Prazno dok vlasnik na zaslonu Porez ne potvrdi da datoteka ima svaku kupnju, i za godinu koju zaslon ne nudi.',
    },
  },
  proposals: {
    units: (quantity, instrument) => `${quantity} instrumenta ${instrument}`,
    percent: (value) => `${value}\u00a0%`,
    bondQuoting: (quoting, coupon, maturity) => `${quoting}, kupon ${coupon} godišnje, dospijeva ${maturity}`,
    pricesFetched: (instruments) =>
      `Kuna nakon prihvaćanja dohvaća cijene ${instruments.length === 1 ? 'instrumenta' : 'instrumenata'} ${listInWords(instruments)}. Poništavanje ostavlja dohvaćene cijene.`,
    ratesMissing: (currencies, from, place) =>
      `Datoteci cijena nedostaju tečajevi ESB-a za ${currencies} od ${dayLabel(from)}, a trebaju ih redci. Uvezite ondje, putem: ${place}, što ih najprije dohvati.`,
    holdingsAsked: (holdings, place) => `Uvoz pita o podjeli ili izdvajanju za ${holdings}, a odgovor određuje trošak, pa time i porez. Povežite ovo mjesto: ${place}, i odgovor prepustite osobi.`,
    rowsWaiting: (count, place): CroatianForms => ({
      one: `${count} redak čeka. Odgovorite na njega: ${place}.`,
      few: `${count} retka čekaju. Odgovorite na njih: ${place}.`,
      other: `${count} redaka čeka. Odgovorite na njih: ${place}.`,
    }),
    rowsSkipped: (count, place): CroatianForms => ({
      one: `${count} redak koji Kuna ne može pročitati ostaje izvan, a popis je ovdje: ${place}.`,
      few: `${count} retka koja Kuna ne može pročitati ostaju izvan, a popis je ovdje: ${place}.`,
      other: `${count} redaka koje Kuna ne može pročitati ostaje izvan, a popis je ovdje: ${place}.`,
    }),
    rowsAsked: (count): CroatianForms => ({
      one: `${count} redak o kojem izvješće pita i dalje čeka.`,
      few: `${count} retka o kojima izvješće pita i dalje čekaju.`,
      other: `${count} redaka o kojima izvješće pita i dalje čeka.`,
    }),
    rowsLeftOut: (count): CroatianForms => ({ one: `${count} izostavljen redak`, few: `${count} izostavljena retka`, other: `${count} izostavljenih redaka` }),
    mailReport: { label: 'Izvješće IBKR-a poštom', place: 'pregled u Postavkama, Općenito' },
    transcribed: 'Retci koje je pročitao AI',
    lookAlike: {
      one: 'zapisu koji Kuna ima iz druge datoteke, s istim računom, danom i iznosima',
      many: 'zapisima koje Kuna ima iz druge datoteke, svaki s istim računom, danom i iznosima',
      another: 'isti zapis ili drugi',
    },
    transcribedRead: (count, source): CroatianForms => ({
      one: `AI je ${source} pročitao ${count} redak. Kuna nije mogla provjeriti zbraja li se datoteka, pa ga usporedite s njom.`,
      few: `AI je ${source} pročitao ${count} retka. Kuna nije mogla provjeriti zbraja li se datoteka, pa ih usporedite s njom.`,
      other: `AI je ${source} pročitao ${count} redaka. Kuna nije mogla provjeriti zbraja li se datoteka, pa ih usporedite s njom.`,
    }),
    transcribedTied: (count, source): CroatianForms => ({
      one: `AI je ${source} pročitao ${count} redak. Novac u njemu zbraja se do stanja koja datoteka ispisuje, ali ostalo usporedite s datotekom.`,
      few: `AI je ${source} pročitao ${count} retka. Novac u njima zbraja se do stanja koja datoteka ispisuje, ali ostalo usporedite s datotekom.`,
      other: `AI je ${source} pročitao ${count} redaka. Novac u njima zbraja se do stanja koja datoteka ispisuje, ali ostalo usporedite s datotekom.`,
    }),
    transcribedWaiting: (count, reasons): CroatianForms => ({
      one: `${count} redak čeka i nije uvezen. ${reasons}.`,
      few: `${count} retka čekaju i nisu uvezena. ${reasons}.`,
      other: `${count} redaka čeka i nije uvezeno. ${reasons}.`,
    }),
    transcribedRatesMissing: (currencies, from) =>
      `Datoteci cijena nedostaju tečajevi ESB-a za ${currencies} od ${dayLabel(from)}, a trebaju ih redci. Predložite fetch-prices na zasebnoj kartici, a zatim ponovno ove retke.`,
    transcribedHoldingsAsked: (holdings) =>
      `Retci sadrže podjelu ili izdvajanje za ${holdings}, a odgovor određuje trošak, pa time i porez. Predložite retke bez toga, a add-split ili add-spin-off kad osoba navede omjer ili udio troška.`,
    fields: {
      name: 'Naziv',
      note: 'Bilješka',
      account: 'Račun',
      instrument: 'Pozicija',
      side: 'Kupnja ili prodaja',
      date: 'Datum',
      quantity: 'Jedinice',
      price: 'Cijena',
      fees: 'Naknade',
      rate: 'Tečaj za 1 EUR',
      accrued: 'Stečena kamata',
      kind: 'Vrsta',
      currency: 'Valuta',
      quoted: 'Cijena je',
      gross: 'Bruto',
      withheld: 'Obustavljeni porez',
      amount: 'Iznos',
      sold: 'Prodano',
      soldCurrency: 'Prodana valuta',
      bought: 'Kupljeno',
      boughtCurrency: 'Kupljena valuta',
      from: 'S računa',
      to: 'Na račun',
      moved: 'Preneseno',
      newUnits: 'Novih jedinica',
      oldUnits: 'Starih jedinica',
      received: 'Primljeno',
      costShare: 'Preneseni trošak',
      type: 'Vrsta',
      class: 'Klasa',
      isin: 'ISIN',
      symbol: 'Oznaka',
      exchange: 'Burza',
      prices: 'Izvor cijena',
      sourceSymbol: 'Oznaka na izvoru',
      sector: 'Sektor',
      country: 'Država ili regija',
      ter: 'Godišnji trošak',
      distribution: 'Dividende',
      slice: 'Skupina',
      percent: 'Postotak',
      check: 'Provjera',
      threshold: 'Prag',
      off: 'Isključena',
      benchmark: 'Referentni indeks',
      leftOut: 'Retci o kojima se pita',
    },
  },
  cards: {
    historyComplete: 'Datoteka ima svaku kupnju i prodaju od prve, pa se porez prikazuje',
    everyHolding: 'Današnje zaključne cijene i tečajevi ESB-a svih pozicija',
    vendorsOutside: 'Kuna pita izvore cijena ključevima ovog preglednika i ono što pošalju zapisuje u datoteku cijena pokraj knjiga.',
    failuresListed: 'Ondje je svaki niz naveden sa savjetom što učiniti.',
    requestsToday: 'Današnji zahtjevi',
    countChanged: 'Ništa nije promijenjeno. Kuna je ponovno pitala izvor nakon što je kartica napravljena.',
    otherFile: 'Sada je otvorena druga datoteka ulaganja, a odgovor pripada onoj za koju je kartica napravljena.',
  },
}

export const words = language === 'hr' ? hr : en
