import type { FailureReason, PricesFileRefusal } from '../domain/pricesFile'
import { language } from '../../../../shared/text/language'
import type { EnglishForms, Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Ukloni, Provjeri.
// A vendor's name leads its Croatian line before a colon, so no verb has to agree with it.

type Reasons = Readonly<Record<FailureReason, (vendor: string) => string>>

const failureEn: Reasons = {
  'no-key': (vendor) => `No ${vendor} key in this browser.`,
  'no-answer': (vendor) => `${vendor} did not answer.`,
  refused: (vendor) => `${vendor} refused the request.`,
  'unknown-symbol': (vendor) => `${vendor} does not know the symbol.`,
  limit: (vendor) => `${vendor}'s limit was reached.`,
  'not-on-free-key': (vendor) => `${vendor} keeps it for paid keys.`,
  unreadable: (vendor) => `${vendor}'s answer could not be read.`,
}

const testEn: Reasons = {
  'no-key': () => 'Save a key first.',
  'no-answer': (vendor) => `${vendor} did not answer.`,
  refused: (vendor) => `${vendor} refused the key.`,
  'unknown-symbol': (vendor) => `${vendor} did not take the request. Check the key.`,
  limit: (vendor) => `${vendor}'s limit is reached for now. Try again later.`,
  'not-on-free-key': (vendor) => `${vendor} wants a paid key for this.`,
  unreadable: (vendor) => `${vendor}'s answer could not be read.`,
}

export const en = {
  card: {
    title: 'Prices',
    subtitle: 'Kuna fetches the closes once a day, with your own free keys. Each key stays in this browser and never goes into a file.',
  },
  lastFetched: 'Last fetched',
  neverFetched: 'Not yet',
  fetching: 'Fetching prices',
  fetchingCount: (asked: number, of: number) => `Fetching prices, ${asked} of ${of}`,
  fetchNow: 'Fetch now',
  failures: {
    title: (count: number): EnglishForms => ({ one: 'The last fetch got nothing for 1 series', other: `The last fetch got nothing for ${count} series` }),
    rates: (currency: string) => `${currency} rates`,
    reason: failureEn,
  },
  vendors: 'Where prices come from',
  needsNoKey: 'Needs no key.',
  key: (vendor: string) => `${vendor} key`,
  keyPlaceholder: 'Paste your key',
  keptEnding: (ending: string) => `A key ending in ${ending} is kept in this browser.`,
  kept: 'A key is kept in this browser.',
  noKey: 'No key in this browser.',
  claim: 'Get a free key',
  save: 'Save',
  forget: 'Remove',
  test: 'Test',
  works: 'The key works.',
  answers: 'It answers.',
  testFailed: testEn,
  run: {
    written: 'Prices fetched',
    allFetched: 'Every series is up to date.',
    busy: 'Another tab is fetching prices',
    current: 'The prices are already fetched',
    currentNote: 'Another browser wrote them today.',
    busyNote: 'This tab shows them once that fetch has written them and the next sync reads them.',
    failed: 'Prices not fetched',
    running: 'A fetch is under way',
    runningNote: 'Its count shows on this card.',
  },
  step: {
    label: 'Prices',
    reading: 'Reading the prices file',
    unchanged: 'Up to date',
    read: 'Read the latest prices',
    settings: 'Settings',
  },
  refused: {
    'not-json': 'The prices file is not JSON, so Kuna left it as it is.',
    'not-prices': 'The prices file holds something else, so Kuna left it as it is.',
    newer: 'A newer version of Kuna wrote the prices file. Reload Kuna to read it.',
    'not-in-shape': 'The prices file is not in the shape Kuna writes, so Kuna left it as it is.',
  } satisfies Record<PricesFileRefusal, string>,
  status: {
    upTo: (day: string) => `Prices up to ${day}.`,
    behind: 'Prices are behind',
    behindNote: (day: string) => `The newest close is from ${day}.`,
    none: 'No prices yet. Add a free key in Settings to fetch them.',
    noCloses: 'No closes yet. The next fetch brings them.',
    fetchProblem: 'The last fetch did not work',
    settings: 'Prices in Settings',
  },
}

export const hr: Translation<typeof en> = {
  card: {
    title: 'Cijene',
    subtitle: 'Kuna jednom dnevno dohvaća zaključne cijene s vašim besplatnim ključevima. Svaki ključ ostaje u ovom pregledniku i nikad ne ide u datoteku.',
  },
  lastFetched: 'Zadnje dohvaćanje',
  neverFetched: 'Još nije',
  fetching: 'Dohvaćanje cijena',
  fetchingCount: (asked, of) => `Dohvaćanje cijena, ${asked} od ${of}`,
  fetchNow: 'Dohvati sada',
  failures: {
    title: (count) => ({
      one: `Zadnje dohvaćanje nije dobilo ništa za ${count} niz`,
      few: `Zadnje dohvaćanje nije dobilo ništa za ${count} niza`,
      other: `Zadnje dohvaćanje nije dobilo ništa za ${count} nizova`,
    }),
    rates: (currency) => `Tečajevi ${currency}`,
    reason: {
      'no-key': (vendor) => `${vendor}: u ovom pregledniku nema ključa.`,
      'no-answer': (vendor) => `${vendor}: nema odgovora.`,
      refused: (vendor) => `${vendor}: zahtjev je odbijen.`,
      'unknown-symbol': (vendor) => `${vendor}: oznaka nije poznata.`,
      limit: (vendor) => `${vendor}: dosegnuto je ograničenje.`,
      'not-on-free-key': (vendor) => `${vendor}: samo uz plaćeni ključ.`,
      unreadable: (vendor) => `${vendor}: odgovor nije čitljiv.`,
    },
  },
  vendors: 'Odakle dolaze cijene',
  needsNoKey: 'Ne treba ključ.',
  key: (vendor) => `Ključ za ${vendor}`,
  keyPlaceholder: 'Zalijepite ključ',
  keptEnding: (ending) => `U ovom pregledniku čuva se ključ koji završava na ${ending}.`,
  kept: 'U ovom pregledniku čuva se ključ.',
  noKey: 'U ovom pregledniku nema ključa.',
  claim: 'Besplatan ključ',
  save: 'Spremi',
  forget: 'Ukloni',
  test: 'Provjeri',
  works: 'Ključ radi.',
  answers: 'Odgovara.',
  testFailed: {
    'no-key': () => 'Najprije spremite ključ.',
    'no-answer': (vendor) => `${vendor}: nema odgovora.`,
    refused: (vendor) => `${vendor}: ključ je odbijen.`,
    'unknown-symbol': (vendor) => `${vendor}: zahtjev nije prihvaćen. Provjerite ključ.`,
    limit: (vendor) => `${vendor}: ograničenje je zasad dosegnuto. Pokušajte kasnije.`,
    'not-on-free-key': (vendor) => `${vendor}: za ovo treba plaćeni ključ.`,
    unreadable: (vendor) => `${vendor}: odgovor nije čitljiv.`,
  },
  run: {
    written: 'Cijene su dohvaćene',
    allFetched: 'Svi nizovi su ažurni.',
    busy: 'Druga kartica dohvaća cijene',
    current: 'Cijene su već dohvaćene',
    currentNote: 'Drugi preglednik ih je danas zapisao.',
    busyNote: 'Ova kartica ih prikazuje kad ih to dohvaćanje zapiše i sljedeća sinkronizacija pročita.',
    failed: 'Cijene nisu dohvaćene',
    running: 'Dohvaćanje je u tijeku',
    runningNote: 'Broj se vidi na ovoj kartici.',
  },
  step: {
    label: 'Cijene',
    reading: 'Čitanje datoteke cijena',
    unchanged: 'Ažurno',
    read: 'Pročitane su najnovije cijene',
    settings: 'Postavke',
  },
  refused: {
    'not-json': 'Datoteka cijena nije JSON, pa ju je Kuna ostavila kakva jest.',
    'not-prices': 'Datoteka cijena sadrži nešto drugo, pa ju je Kuna ostavila kakva jest.',
    newer: 'Datoteku cijena zapisala je novija Kuna. Ponovno učitajte Kunu da je pročitate.',
    'not-in-shape': 'Datoteka cijena nije u obliku koji Kuna zapisuje, pa ju je Kuna ostavila kakva jest.',
  },
  status: {
    upTo: (day) => `Cijene do ${day}`,
    behind: 'Cijene kasne',
    behindNote: (day) => `Najnovija zaključna cijena je od ${day}`,
    none: 'Još nema cijena. Dodajte besplatan ključ u postavkama da ih dohvatite.',
    noCloses: 'Još nema zaključnih cijena. Sljedeće dohvaćanje ih donosi.',
    fetchProblem: 'Zadnje dohvaćanje nije uspjelo',
    settings: 'Cijene u postavkama',
  },
}

export const words = language === 'hr' ? hr : en
