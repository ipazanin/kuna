import { language } from '../../shared/text/language'
import type { Translation } from '../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.

export const en = {
  description: 'Each app keeps its own books, and one sync keeps them all up to date.',
  setUp: 'Set up',
  failed: 'The books did not open. Open the app to see why.',
}

export const hr: Translation<typeof en> = {
  description: 'Svaka aplikacija vodi svoje knjige, a jedna sinkronizacija ažurira sve.',
  setUp: 'Postavi',
  failed: 'Knjige se nisu otvorile. Otvorite aplikaciju da vidite zašto.',
}

export const words = language === 'hr' ? hr : en
