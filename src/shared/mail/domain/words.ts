import { language } from '../../text/language'
import type { Translation } from '../../text/translation'
import type { MailPhrase, MailSearchFault } from './mailSource'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// Mail is pošta and one mail poruka. Filing an attachment saves it into its Drive folder, so it is spremiti.

const ENGLISH_PHRASES: Readonly<Record<MailPhrase, string>> = { subject: 'a subject', contents: 'the contents' }
const CROATIAN_PHRASES: Readonly<Record<MailPhrase, string>> = { subject: 'predmet', contents: 'sadržaj' }

export const en = {
  /** Why Gmail cannot search for the senders or the phrase a fault names. */
  searchFault: (fault: MailSearchFault) => {
    switch (fault.kind) {
      case 'not-addresses':
        return `${fault.addresses.map((address) => `"${address}"`).join(', ')} ${fault.addresses.length === 1 ? 'is not a mail address' : 'are not mail addresses'}`
      case 'quote':
        return `${ENGLISH_PHRASES[fault.phrase]} cannot hold a double quote, which would end the phrase Gmail searches for`
      case 'too-long':
        return `${ENGLISH_PHRASES[fault.phrase]} can be at most ${fault.most} characters`
    }
  },
}

export const hr: Translation<typeof en> = {
  searchFault: (fault) => {
    switch (fault.kind) {
      case 'not-addresses':
        return `${fault.addresses.map((address) => `„${address}”`).join(', ')} ${fault.addresses.length === 1 ? 'nije adresa e-pošte' : 'nisu adrese e-pošte'}`
      case 'quote':
        return `${CROATIAN_PHRASES[fault.phrase]} ne smije sadržavati dvostruke navodnike jer bi završili izraz koji Gmail traži`
      case 'too-long':
        return `${CROATIAN_PHRASES[fault.phrase]} može imati najviše ${fault.most} znakova`
    }
  },
}

export const words = language === 'hr' ? hr : en
