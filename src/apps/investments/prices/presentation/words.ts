import type { FailureReason, PricesFileRefusal } from '../domain/pricesFile'
import { language } from '../../../../shared/text/language'
import type { EnglishForms, Translation } from '../../../../shared/text/translation'
import { withFullStop } from '../../../../shared/text/withFullStop'

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
  closesImport: {
    title: 'Import closes',
    subtitle:
      "A CSV of daily closes for each holding, named after its symbol, such as SXR8.DE.csv, with Date and Close columns. Yahoo's history download works as it is. Kuna takes Close, the close as traded, and fetches only the days after the last one.",
    drop: 'Drop CSV files of closes here',
    dropMore: 'or click to choose them, one or many',
    holding: 'Holding',
    pick: 'Pick the holding',
    noMatch: 'No holding has this symbol. Pick the one it is for.',
    twoMatch: 'More than one holding has this symbol. Pick the one it is for.',
    adds: (added: number, first: string, last: string, replaced: number) =>
      `Adds ${added} ${added === 1 ? 'day' : 'days'} from ${first} to ${last}${replaced === 0 ? '' : `, in place of ${replaced} already there`}.`,
    currency: (currency: string) => `Read as closes in ${currency}, the holding's quote currency.`,
    gap: (bought: string, first: string) => `The file starts after the first buy, so ${bought} to ${first} has no close from it.`,
    refused: {
      empty: 'The file holds no closes.',
      'no-columns': 'The file has no Date or no Close column.',
      'ambiguous-dates': 'Its dates read both day first and month first. Save them as yyyy-mm-dd.',
      unreadable: (line: number) => `Line ${line} cannot be read.`,
      'repeated-day': (day: string) => `${day} comes twice.`,
    },
    import: (count: number): EnglishForms => ({ one: 'Import closes of 1 holding', other: `Import closes of ${count} holdings` }),
    imported: (count: number): EnglishForms => ({ one: 'Closes of 1 holding imported', other: `Closes of ${count} holdings imported` }),
    importedNote: 'Kuna fetches only the days after the last close.',
    notImported: 'Closes not imported',
    clear: 'Clear',
  },
  lastFetchTitle: 'Last fetch',
  lastFetchSubtitle: 'Kuna asks only for the closes it does not have yet, once a day and again for what is missing.',
  offers: 'Gives',
  capabilities: { closes: 'daily closes', rates: 'euro exchange rates', splits: 'splits' },
  freeLimits: (perMinute: number | null, perDay: number | null) =>
    perMinute === null && perDay === null
      ? 'States no limits.'
      : `A free key takes ${[perMinute === null ? null : `${perMinute} requests a minute`, perDay === null ? null : `${perDay} a day`].filter((part) => part !== null).join(' and ')}.`,
  usedToday: (count: number, perDay: number | null) => (perDay === null ? `Asked ${count} times today from this browser.` : `Asked ${count} of ${perDay} times today from this browser.`),
  lastFetched: 'Fetched',
  neverFetched: 'Not yet',
  fetching: 'Fetching prices',
  fetchingCount: (asked: number, of: number) => `Fetching prices: ${asked} of ${of}`,
  minutesLeft: (minutes: number): EnglishForms => ({ one: 'about a minute left', other: `about ${minutes} minutes left` }),
  waiting: (seconds: number, vendor: string, perMinute: number | null): EnglishForms =>
    perMinute === null
      ? { one: `${vendor} asks Kuna to slow down, waiting 1 second`, other: `${vendor} asks Kuna to slow down, waiting ${seconds} seconds` }
      : { one: `${vendor} allows ${perMinute} a minute, waiting 1 second`, other: `${vendor} allows ${perMinute} a minute, waiting ${seconds} seconds` },
  lastCounts: (asked: number, upToDate: number) => (asked === 0 ? `Every series was up to date, ${upToDate} in all.` : `Asked for ${asked} series, ${upToDate} already up to date.`),
  fetchNow: 'Fetch now',
  failures: {
    title: (count: number): EnglishForms => ({ one: 'The last fetch got nothing for 1 series', other: `The last fetch got nothing for ${count} series` }),
    rates: (currency: string) => `${currency} rates`,
    reason: failureEn,
  },
  advice: {
    'no-key': (vendor: string) => `Add a ${vendor} key in the Prices settings.`,
    'no-answer': () => 'Kuna asks again later today.',
    refused: () => 'Kuna asks again on the next fetch.',
    'unknown-symbol': () => 'Check its symbol and price source on the holding.',
    limit: () => 'Kuna asks again later today.',
    'not-on-free-key': () => 'Enter its prices by hand on the holding, or pick another source.',
    unreadable: () => 'Kuna asks again on the next fetch.',
    toSettings: 'Prices settings',
    toHolding: 'Open the holding',
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
  closesImport: {
    title: 'Uvoz zaključnih cijena',
    subtitle:
      'CSV dnevnih zaključnih cijena za svaku poziciju, nazvan po njezinoj oznaci, npr. SXR8.DE.csv, sa stupcima Date i Close. Yahoova preuzeta povijest radi takva kakva jest. Kuna uzima Close, cijenu kako se trgovalo, i dohvaća samo dane nakon zadnje.',
    drop: 'Ovdje ispustite CSV datoteke zaključnih cijena',
    dropMore: 'ili kliknite da ih odaberete, jednu ili više',
    holding: 'Pozicija',
    pick: 'Odaberite poziciju',
    noMatch: 'Nijedna pozicija nema ovu oznaku. Odaberite onu za koju je.',
    twoMatch: 'Ovu oznaku ima više pozicija. Odaberite onu za koju je.',
    adds: (added, first, last, replaced) => withFullStop(`Dodaje dana: ${added}, od ${first} do ${last}${replaced === 0 ? '' : `, umjesto ${replaced} već unesenih`}`),
    currency: (currency) => `Čita se kao zaključne cijene u valuti ${currency}, valuti kotacije pozicije.`,
    gap: (bought, first) => `Datoteka počinje nakon prve kupnje, pa od ${bought} do ${first} nema njezine cijene.`,
    refused: {
      empty: 'Datoteka nema zaključnih cijena.',
      'no-columns': 'Datoteka nema stupac Date ili Close.',
      'ambiguous-dates': 'Datumi se čitaju i s danom i s mjesecom na prvom mjestu. Spremite ih kao gggg-mm-dd.',
      unreadable: (line) => `Redak ${line} ne može se pročitati.`,
      'repeated-day': (day) => `${day} se pojavljuje dvaput.`,
    },
    import: (count) => ({ one: `Uvezi cijene ${count} pozicije`, few: `Uvezi cijene ${count} pozicije`, other: `Uvezi cijene ${count} pozicija` }),
    imported: (count) => ({ one: `Uvezene su cijene ${count} pozicije`, few: `Uvezene su cijene ${count} pozicije`, other: `Uvezene su cijene ${count} pozicija` }),
    importedNote: 'Kuna dohvaća samo dane nakon zadnje zaključne cijene.',
    notImported: 'Cijene nisu uvezene',
    clear: 'Očisti',
  },
  lastFetchTitle: 'Zadnje dohvaćanje',
  lastFetchSubtitle: 'Kuna traži samo zaključne cijene koje još nema, jednom dnevno i ponovno za ono što nedostaje.',
  offers: 'Daje',
  capabilities: { closes: 'dnevne zaključne cijene', rates: 'tečajeve eura', splits: 'podjele dionica' },
  freeLimits: (perMinute, perDay) =>
    perMinute === null && perDay === null
      ? 'Ne navodi ograničenja.'
      : `Besplatni ključ prima ${[perMinute === null ? null : `${perMinute} zahtjeva u minuti`, perDay === null ? null : `${perDay} dnevno`].filter((part) => part !== null).join(' i ')}.`,
  usedToday: (count, perDay) => (perDay === null ? `Danas zatraženo ${count} puta iz ovog preglednika.` : `Danas zatraženo ${count} od ${perDay} puta iz ovog preglednika.`),
  lastFetched: 'Dohvaćeno',
  neverFetched: 'Još nije',
  fetching: 'Dohvaćanje cijena',
  fetchingCount: (asked, of) => `Dohvaćanje cijena: ${asked} od ${of}`,
  minutesLeft: (minutes) => ({ one: minutes === 1 ? 'još otprilike minutu' : `još otprilike ${minutes} minutu`, few: `još otprilike ${minutes} minute`, other: `još otprilike ${minutes} minuta` }),
  waiting: (seconds, vendor, perMinute) => {
    const said = perMinute === null ? `${vendor}: traži sporije slanje` : `${vendor}: dopušta ${perMinute} u minuti`
    return { one: `${said}, čeka se ${seconds} sekundu`, few: `${said}, čeka se ${seconds} sekunde`, other: `${said}, čeka se ${seconds} sekundi` }
  },
  lastCounts: (asked, upToDate) => (asked === 0 ? `Svi nizovi bili su ažurni, njih ${upToDate}.` : `Zatraženo nizova: ${asked}, već ažurnih: ${upToDate}.`),
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
  advice: {
    'no-key': (vendor) => `Dodajte ključ za ${vendor} u postavkama cijena.`,
    'no-answer': () => 'Kuna pita ponovno kasnije danas.',
    refused: () => 'Kuna pita ponovno pri sljedećem dohvaćanju.',
    'unknown-symbol': () => 'Provjerite oznaku i izvor cijena na poziciji.',
    limit: () => 'Kuna pita ponovno kasnije danas.',
    'not-on-free-key': () => 'Unesite cijene ručno na poziciji ili odaberite drugi izvor.',
    unreadable: () => 'Kuna pita ponovno pri sljedećem dohvaćanju.',
    toSettings: 'Postavke cijena',
    toHolding: 'Otvori poziciju',
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
    behind: 'Cijene kasne',
    behindNote: (day) => `Najnovija zaključna cijena je od ${day}`,
    none: 'Još nema cijena. Dodajte besplatan ključ u postavkama da ih dohvatite.',
    noCloses: 'Još nema zaključnih cijena. Sljedeće dohvaćanje ih donosi.',
    fetchProblem: 'Zadnje dohvaćanje nije uspjelo',
    settings: 'Cijene u postavkama',
  },
}

export const words = language === 'hr' ? hr : en
