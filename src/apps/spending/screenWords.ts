import { language } from '../../shared/text/language'
import type { Translation } from '../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence.

/** The title of each Spending screen, as its menu item and the browser tab name it. */
export const en = {
  overview: 'Overview',
  entries: 'Entries',
  limits: 'Limits',
  sorting: 'Sorting',
  events: 'Events',
  payees: 'Payees',
  analysis: 'Analysis',
  accounts: 'Accounts',
  account: 'Account',
  settings: 'Settings',
}

export const hr: Translation<typeof en> = {
  overview: 'Pregled',
  entries: 'Unosi',
  limits: 'Ograničenja',
  sorting: 'Razvrstavanje',
  events: 'Događaji',
  payees: 'Primatelji i platitelji',
  analysis: 'Analiza',
  accounts: 'Računi',
  account: 'Račun',
  settings: 'Postavke',
}

export const words = language === 'hr' ? hr : en
