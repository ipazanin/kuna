import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// A bucket is skupina, a family grupa and a counterparty partner, as on the filter chips.

export const en = {
  presets: { l3: 'Last 3 months', l12: 'Last 12 months', year: 'Year', quarter: 'Quarter', custom: 'Custom', all: 'All time' },
  period: 'Period',
  year: 'Year',
  quarter: 'Quarter',
  from: 'From',
  to: 'To',
  until: 'to',
  showResults: 'Show results',
  allAccounts: 'All accounts',
  accounts: 'Accounts',
  addFilter: 'Add filter',
  groups: { buckets: 'Buckets', categories: 'Categories', counterparties: 'Counterparties', labels: 'Labels' },
  searchChoices: 'Search bucket, category, counterparty',
  searchChoicesWithLabels: 'Search bucket, category, counterparty, label',
  viewRows: 'View rows',
  chips: {
    bucket: 'Bucket',
    family: 'Family',
    category: 'Category',
    counterparty: 'Counterparty',
    label: 'Label',
    deletedLabel: 'a deleted label',
    everyOwnerAdvance: 'Every owner advance',
    text: (text: string) => `Text: “${text}”`,
    atMost: (amount: string) => `at most ${amount}`,
    atLeast: (amount: string) => `at least ${amount}`,
    between: (min: string, max: string) => `${min} to ${max}`,
    amount: (bounds: string) => `Amount: ${bounds}`,
    needsReview: 'Needs review',
  },
}

export const hr: Translation<typeof en> = {
  presets: { l3: 'Zadnja 3 mjeseca', l12: 'Zadnjih 12 mjeseci', year: 'Godina', quarter: 'Tromjesečje', custom: 'Prilagođeno', all: 'Sve' },
  period: 'Razdoblje',
  year: 'Godina',
  quarter: 'Tromjesečje',
  from: 'Od',
  to: 'Do',
  until: 'do',
  showResults: 'Prikaži rezultate',
  allAccounts: 'Svi računi u banci',
  accounts: 'Računi u banci',
  addFilter: 'Dodaj filtar',
  groups: { buckets: 'Skupine', categories: 'Kategorije', counterparties: 'Partneri', labels: 'Oznake' },
  searchChoices: 'Pretraži skupine, kategorije, partnere',
  searchChoicesWithLabels: 'Pretraži skupine, kategorije, partnere, oznake',
  viewRows: 'Prikaži stavke',
  chips: {
    bucket: 'Skupina',
    family: 'Grupa',
    category: 'Kategorija',
    counterparty: 'Partner',
    label: 'Oznaka',
    deletedLabel: 'izbrisana oznaka',
    everyOwnerAdvance: 'Svi predujmovi vlasnika',
    text: (text) => `Tekst: „${text}”`,
    atMost: (amount) => `najviše ${amount}`,
    atLeast: (amount) => `najmanje ${amount}`,
    between: (min, max) => `od ${min} do ${max}`,
    amount: (bounds) => `Iznos: ${bounds}`,
    needsReview: 'Čeka provjeru',
  },
}

export const words = language === 'hr' ? hr : en
