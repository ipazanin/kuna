import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// A bucket is skupina, a family grupa and a counterparty partner, as on the filter chips.

export const en = {
  showResults: 'Show results',
  allAccounts: 'All accounts',
  accounts: 'Accounts',
  addFilter: 'Add filter',
  groups: { buckets: 'Buckets', categories: 'Categories', counterparties: 'Counterparties', labels: 'Labels' },
  searchChoices: 'Search bucket, category, counterparty',
  searchChoicesWithLabels: 'Search category, counterparty, label',
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
  showResults: 'Prikaži rezultate',
  allAccounts: 'Svi računi u banci',
  accounts: 'Računi u banci',
  addFilter: 'Dodaj filtar',
  groups: { buckets: 'Skupine', categories: 'Kategorije', counterparties: 'Partneri', labels: 'Oznake' },
  searchChoices: 'Pretraži skupine, kategorije, partnere',
  searchChoicesWithLabels: 'Pretraži kategorije, partnere, oznake',
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
