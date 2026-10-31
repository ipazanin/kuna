import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.

export const en = {
  /** What another bank's mail needs before a sync can search for it. */
  typeSender: 'Type the address the bank mails statements from',
  typeSubject: 'Type the words before the statement number',
}

export const hr: Translation<typeof en> = {
  typeSender: 'Upišite adresu s koje banka šalje izvode',
  typeSubject: 'Upišite riječi ispred broja izvoda',
}

export const words = language === 'hr' ? hr : en
