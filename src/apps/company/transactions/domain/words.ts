import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.

export const en = {
  /** Who Transactions names as the counterparty of an owner advance, which is in no ledger row. */
  owner: 'Owner',
}

export const hr: Translation<typeof en> = {
  owner: 'Vlasnik',
}

export const words = language === 'hr' ? hr : en
