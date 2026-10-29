import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.

export const en = {
  title: 'Settings',
  description: "How the company's books are set up and where they are kept. A save writes what you changed to the books, on Drive or in this browser, checks it reads back, and offers Undo.",
  tabs: 'Parts of the settings',
  booksFile: 'Books file',
}

export const hr: Translation<typeof en> = {
  title: 'Postavke',
  description: 'Kako su postavljene knjige tvrtke i gdje se čuvaju. Spremanje upisuje promjene u knjige, na Driveu ili u ovom pregledniku, provjerava da se ispravno čitaju i nudi poništavanje.',
  tabs: 'Dijelovi postavki',
  booksFile: 'Datoteka knjiga',
}

export const words = language === 'hr' ? hr : en
