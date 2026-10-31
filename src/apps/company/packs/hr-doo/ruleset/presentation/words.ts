import { withFullStop } from '../../../../../../shared/text/withFullStop'
import { language } from '../../../../../../shared/text/language'
import { plural } from '../../../../../../shared/text/translation'
import type { EnglishForms, Translation } from '../../../../../../shared/text/translation'
import { uncapitalised } from '../../../../../../shared/text/capitalised'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// The ruleset's tab is Porezna pravila and each of its rules an odredba, so it never collides with the rules that file rows (Pravila kategorija).
// The rules' notes and terms are legal research written in English, and stay so. Their titles are labels, which ruleTitles.ts names in Croatian. A Croatian date and year end in their own full stop.

export const en = {
  tab: 'Tax rules',
  intro: (checkedOn: string) =>
    `The Croatian law behind the pack's figures: each rule's value per year, the article it comes from, and how sure that value is. Checked against the sources on ${checkedOn}.`,
  localRatesHint: 'Search for a city or municipality, or show them all. Set where the director lives on Salaries to open on that one.',
  search: 'Search by rule id, name, act or article',
  searchLabel: 'Search the ruleset',
  clearSearch: 'Clear the search',
  area: 'Area',
  allAreas: 'All areas',
  count: (count: number): EnglishForms => ({ one: `${count} rules`, other: `${count} rules` }),
  shownOf: (shown: number, total: number) => `${shown} of ${total} rules`,
  linkedMissing: { before: 'The link points at', after: ', which is not in the ruleset. It may have been renamed, so search for it below.' },
  noMatch: (search: string, area: string | null) => `No rule matches "${search}"${area === null ? '' : ` in ${area}`}.`,
  byArea: 'Rules by area',
  byAreaHelp: "This year's value of each rule and how sure it is. Open a rule for every year, its notes and its sources.",
  howSure: 'how sure each value is',
  planningOnly: 'The figures are for planning with the accountant, never filing advice.',
  areas: {
    'profit-tax': { label: 'Profit tax', description: 'Corporate income tax: the PD return, its base, rate, add-backs, advances and deadlines.' },
    'owner-pay': { label: 'Owner pay', description: 'Salary, contributions, income tax, tax-free payments and dividends.' },
    accounting: { label: 'Accounting', description: 'Size class, statements, recognition and the asset and grant policies.' },
    vat: { label: 'VAT', description: 'Registration, rates, place of supply, deductions, periods and refunds.' },
    'company-law': { label: 'Company law', description: 'Share capital, reserves, profit payouts and the decisions they need.' },
  },
  confidence: {
    'confirmed-nn': { label: 'Confirmed in NN', meaning: 'Read in the text published in Narodne novine.' },
    'confirmed-consolidated': { label: 'Confirmed, consolidated text', meaning: 'Read in the consolidated text on zakon.hr, with its list of amendments checked.' },
    'confirmed-table': { label: 'Confirmed, official table', meaning: 'Read in a table the tax administration compiles from the decisions published in Narodne novine.' },
    reading: { label: 'Our reading', meaning: 'The text was read. How it applies to the company is an interpretation to discuss with the accountant.' },
    practice: { label: "Accountant's practice", meaning: "The accountant's own figures apply it and match to the cent." },
    estimate: { label: 'Estimate', meaning: 'Worked out before the official figure is published. It changes once the figure is out.' },
    pending: { label: 'Pending', meaning: 'Set by a bill or a draft that is not law yet.' },
    unconfirmed: { label: 'Unconfirmed', meaning: 'The text was not loaded or not confirmed. The pack never uses it as a fact.' },
  },
  appliesBy: {
    'tax-period': "The tax period's first day picks the version",
    'month-worked': 'The first day of the month worked picks the version',
    'payment-date': 'The payment date picks the version',
    'supply-date': 'The supply date picks the version',
    'event-date': 'The date of the event picks the version',
  },
  periods: {
    year: (year: number) => String(year),
    onward: (from: string) => `${from} onward`,
    twoYears: (first: number, second: number) => `${first} and ${second}`,
    span: (from: string, to: string) => `${from} to ${to}`,
  },
  articles: {
    ofAmendingAct: (article: string, issues: string) => `Art. ${article} of the amending act in NN ${issues}`,
    article: (article: string) => `Art. ${article}`,
  },
  yes: 'Yes',
  no: 'No',
  detail: {
    versions: 'Versions',
    term: 'Term',
    changed: ', changed',
    sources: 'Sources',
    forPeriods: (periods: string) => `For ${periods}. `,
    checkedOn: (day: string) => `Checked on ${day}.`,
    opensInNewTab: 'Opens in a new tab.',
  },
  table: {
    search: (label: string) => `Search ${uncapitalised(label)}`,
    clearSearch: 'Clear the table search',
    showFewer: 'Show fewer',
    showAll: 'Show all',
    allRows: (count: number) => `All ${count} rows`,
    shownOf: (shown: number, total: number) => `${shown} of ${total} rows`,
    searchOrShowAll: (count: number) => `Search above, or show all ${count} rows.`,
    noMatch: (search: string) => `No row matches "${search}".`,
    period: 'Period',
  },
  watch: {
    title: 'Watch list',
    summary: (count: number): EnglishForms => ({ one: `${count} value to watch`, other: `${count} values to watch` }),
    shownOf: (shown: number, total: number) => `${shown} of ${total}`,
    about: (checkedOn: string) =>
      `Values that are estimates, still pending or unconfirmed, and matters the ruleset has no value for yet. Each needs a new look once the official text is out. The ruleset was last checked against its sources on ${checkedOn}.`,
    nothing: 'Nothing to watch in this selection.',
    openSource: 'Open the source',
    opensInNewTab: ', opens in a new tab',
    noSource: 'No source loaded yet',
  },
}

export const hr: Translation<typeof en> = {
  tab: 'Porezna pravila',
  intro: (checkedOn) =>
    `Hrvatski propisi iza izračuna paketa: vrijednost svake odredbe po godini, članak iz kojeg dolazi i koliko je ta vrijednost sigurna. Provjereno prema izvorima ${withFullStop(checkedOn)}`,
  localRatesHint: 'Potražite grad ili općinu ili ih prikažite sve. Na zaslonu Plaće postavite gdje direktor živi da se tablica otvori na toj jedinici.',
  search: 'Pretraži po oznaci, nazivu, propisu ili članku',
  searchLabel: 'Pretraži propise',
  clearSearch: 'Očisti pretragu',
  area: 'Područje',
  allAreas: 'Sva područja',
  count: (count) => ({ one: `${count} odredba`, few: `${count} odredbe`, other: `${count} odredbi` }),
  shownOf: (shown, total) => `${shown} od ${total} ${plural({ one: 'odredbe', few: 'odredbe', other: 'odredbi' }, total)}`,
  linkedMissing: { before: 'Poveznica vodi na oznaku', after: ', a te oznake nema među propisima. Možda je preimenovana, pa je potražite ispod.' },
  noMatch: (search, area) => `Nijedna odredba ne odgovara upitu „${search}”${area === null ? '' : ` u području ${area}`}.`,
  byArea: 'Odredbe po područjima',
  byAreaHelp: 'Ovogodišnja vrijednost svake odredbe i koliko je sigurna. Otvorite odredbu za sve godine, njezine napomene i izvore.',
  howSure: 'koliko je sigurna svaka vrijednost',
  planningOnly: 'Izračuni služe za planiranje s knjigovođom, nikad kao savjet za predaju prijava.',
  areas: {
    'profit-tax': { label: 'Porez na dobit', description: 'Porez na dobit: prijava PD, osnovica, stopa, uvećanja, predujmovi i rokovi.' },
    'owner-pay': { label: 'Isplate vlasniku', description: 'Plaća, doprinosi, porez na dohodak, neoporezive isplate i dividende.' },
    accounting: { label: 'Računovodstvo', description: 'Razred veličine, izvještaji, priznavanje i politike za imovinu i potpore.' },
    vat: { label: 'PDV', description: 'Registracija, stope, mjesto isporuke, odbici, razdoblja i povrati.' },
    'company-law': { label: 'Pravo društava', description: 'Temeljni kapital, rezerve, isplate dobiti i odluke koje za njih trebaju.' },
  },
  confidence: {
    'confirmed-nn': { label: 'Potvrđeno u NN', meaning: 'Pročitano u tekstu objavljenom u Narodnim novinama.' },
    'confirmed-consolidated': { label: 'Potvrđeno, pročišćeni tekst', meaning: 'Pročitano u pročišćenom tekstu na zakon.hr, uz provjeren popis izmjena.' },
    'confirmed-table': { label: 'Potvrđeno, službena tablica', meaning: 'Pročitano u tablici koju Porezna uprava sastavlja iz odluka objavljenih u Narodnim novinama.' },
    reading: { label: 'Naše tumačenje', meaning: 'Tekst je pročitan. Kako se odnosi na tvrtku tumačenje je o kojem treba razgovarati s knjigovođom.' },
    practice: { label: 'Praksa knjigovođe', meaning: 'Knjigovođini izračuni to primjenjuju i slažu se do centa.' },
    estimate: { label: 'Procjena', meaning: 'Izračunato prije objave službenog iznosa. Mijenja se kad iznos bude objavljen.' },
    pending: { label: 'Na čekanju', meaning: 'Određeno prijedlogom zakona ili nacrtom koji još nije na snazi.' },
    unconfirmed: { label: 'Nepotvrđeno', meaning: 'Tekst nije učitan ili nije potvrđen. Paket ga nikad ne koristi kao činjenicu.' },
  },
  appliesBy: {
    'tax-period': 'Verziju bira prvi dan poreznog razdoblja',
    'month-worked': 'Verziju bira prvi dan odrađenog mjeseca',
    'payment-date': 'Verziju bira datum isplate',
    'supply-date': 'Verziju bira datum isporuke',
    'event-date': 'Verziju bira datum događaja',
  },
  periods: {
    year: (year) => `${year}.`,
    onward: (from) => `od ${from}`,
    twoYears: (first, second) => `${first}. i ${second}.`,
    span: (from, to) => `${from} – ${to}`,
  },
  articles: {
    ofAmendingAct: (article, issues) => `čl. ${article} zakona o izmjenama u NN ${issues}`,
    article: (article) => `čl. ${article}`,
  },
  yes: 'Da',
  no: 'Ne',
  detail: {
    versions: 'Verzije',
    term: 'Pojam',
    changed: ', promijenjeno',
    sources: 'Izvori',
    forPeriods: (periods) => `Za ${withFullStop(periods)} `,
    checkedOn: (day) => `Provjereno ${withFullStop(day)}`,
    opensInNewTab: 'Otvara se u novoj kartici.',
  },
  table: {
    search: (label) => `Pretraži: ${label}`,
    clearSearch: 'Očisti pretragu tablice',
    showFewer: 'Prikaži manje',
    showAll: 'Prikaži sve',
    allRows: (count) => `Svi redci (${count})`,
    shownOf: (shown, total) => `${shown} od ${total} ${plural({ one: 'retka', few: 'retka', other: 'redaka' }, total)}`,
    searchOrShowAll: (count) => `Pretražite iznad ili prikažite sve retke (${count}).`,
    noMatch: (search) => `Nijedan redak ne odgovara upitu „${search}”.`,
    period: 'Razdoblje',
  },
  watch: {
    title: 'Za praćenje',
    summary: (count) => ({ one: `${count} vrijednost za praćenje`, few: `${count} vrijednosti za praćenje`, other: `${count} vrijednosti za praćenje` }),
    shownOf: (shown, total) => `${shown} od ${total}`,
    about: (checkedOn) =>
      `Vrijednosti koje su procjene, još na čekanju ili nepotvrđene, i pitanja za koja propisi još nemaju vrijednost. Svaku treba ponovno pogledati kad izađe službeni tekst. Propisi su zadnji put provjereni prema izvorima ${withFullStop(checkedOn)}`,
    nothing: 'U ovom odabiru nema ničega za praćenje.',
    openSource: 'Otvori izvor',
    opensInNewTab: ', otvara se u novoj kartici',
    noSource: 'Izvor još nije učitan',
  },
}

export const words = language === 'hr' ? hr : en
