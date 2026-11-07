import { language } from '../text/language'
import type { Translation } from '../text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.

export const en = {
  allApps: 'All apps',
  homeLink: 'Kuna, all apps',
  loadingScreen: 'Loading the screen',
  privacy: 'Privacy',
  saving: 'Saving…',
}

export const hr: Translation<typeof en> = {
  allApps: 'Sve aplikacije',
  homeLink: 'Kuna, sve aplikacije',
  loadingScreen: 'Učitavanje zaslona',
  privacy: 'Privatnost',
  saving: 'Spremanje…',
}

/** The maker's name and contact read the same in both languages. */
export const companyFooter = { name: 'Domain Software Solutions d.o.o.', email: 'ivan.pazanin1996@gmail.com' }

export const words = language === 'hr' ? hr : en
