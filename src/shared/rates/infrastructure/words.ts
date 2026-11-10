import { language } from '../../text/language'
import type { Translation } from '../../text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence.

export const en = {
  noFolder: "The app's file has no folder Kuna can see, so it has nowhere to keep the exchange rates file.",
}

export const hr: Translation<typeof en> = {
  noFolder: 'Datoteka aplikacije nema mapu koju Kuna vidi, pa nema gdje čuvati datoteku tečajeva.',
}

export const words = language === 'hr' ? hr : en
