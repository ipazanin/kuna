import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// A need is named as the subject of a sentence such as "Slanje računa treba vaše dopuštenje", so its Croatian name is singular.

export const en = {
  /** What asks for Gmail drafts while invoice mail drafts are on. */
  invoiceDrafts: 'Invoicing',
}

export const hr: Translation<typeof en> = {
  invoiceDrafts: 'Slanje računa',
}

export const words = language === 'hr' ? hr : en
