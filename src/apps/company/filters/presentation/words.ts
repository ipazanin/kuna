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
  filters: 'Filters',
  active: (count: number) => `, ${count} active`,
  showResults: 'Show results',
  allAccounts: 'All accounts',
  accounts: 'Accounts',
  addFilter: 'Add filter',
  groups: { buckets: 'Buckets', categories: 'Categories', counterparties: 'Counterparties' },
  searchChoices: 'Search buckets, categories, counterparties',
  activeFilters: 'Active filters',
  removeFilter: (label: string) => `Remove filter ${label}`,
  more: (count: number) => `+${count} more`,
  clear: 'Clear',
  viewRows: 'View rows',
}

export const hr: Translation<typeof en> = {
  presets: { l3: 'Zadnja 3 mjeseca', l12: 'Zadnjih 12 mjeseci', year: 'Godina', quarter: 'Tromjesečje', custom: 'Prilagođeno', all: 'Sve' },
  period: 'Razdoblje',
  year: 'Godina',
  quarter: 'Tromjesečje',
  from: 'Od',
  to: 'Do',
  until: 'do',
  filters: 'Filtri',
  active: (count) => `, aktivnih: ${count}`,
  showResults: 'Prikaži rezultate',
  allAccounts: 'Svi računi u banci',
  accounts: 'Računi u banci',
  addFilter: 'Dodaj filtar',
  groups: { buckets: 'Skupine', categories: 'Kategorije', counterparties: 'Partneri' },
  searchChoices: 'Pretraži skupine, kategorije, partnere',
  activeFilters: 'Aktivni filtri',
  removeFilter: (label) => `Ukloni filtar ${label}`,
  more: (count) => `još ${count}`,
  clear: 'Očisti',
  viewRows: 'Prikaži stavke',
}

export const words = language === 'hr' ? hr : en
