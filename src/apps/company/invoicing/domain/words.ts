import { language } from '../../../../shared/text/language'
import { listInWords } from '../../../../shared/text/listInWords'
import type { Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// An invoice is račun and its line stavka. Invoicing, Clients names the screen and its tab. A word in braces keeps its spelling, such as {yyyy}.

export const en = {
  /** What the invoice terms lack, each as the sentence of missing details lists it. */
  issuer: {
    name: 'your company name',
    address: 'your address',
    vatId: 'your VAT ID',
    iban: 'your IBAN',
    place: 'the place of issue',
    signatory: 'the signatory',
  },
  termsNeed: (missing: readonly string[]) => `The invoice terms on Invoicing, Clients need ${missing.join(', ')}.`,
  chooseClient: 'Choose the client.',
  needsAddress: (client: string) => `Invoicing, Clients needs an address for ${client}.`,
  reverseChargeOnly: (client: string) =>
    `The app makes invoices without VAT for clients on reverse charge only. Tick reverse charge for ${client} on Invoicing, Clients if it accounts for the VAT, or make this invoice elsewhere.`,
  addLine: 'Add a line.',
  lineDescription: 'Every line needs a description.',
  lineAmount: 'Every line needs an amount above zero.',
  /** Why a pattern with words in braces cannot be used. */
  unknownTokens: (unknown: readonly string[], known: readonly string[]) => `${unknown.join(', ')} is not one of ${known.join(', ')}`,
  pathEndsInPdf: 'the path ends in a file name such as {yyyy}-{mm}-{client}-invoice.pdf',
  blankFolder: 'a folder name between two slashes is blank',
  patternExample: 'a pattern such as {n}-1-{yy}',
  sequenceOnce: 'the pattern needs {n}, the sequence, exactly once',
}

export const hr: Translation<typeof en> = {
  issuer: {
    name: 'naziv vaše tvrtke',
    address: 'vaša adresa',
    vatId: 'vaš PDV ID',
    iban: 'vaš IBAN',
    place: 'mjesto izdavanja',
    signatory: 'potpisnik',
  },
  termsNeed: (missing) => `U uvjetima računa pod Računi, Klijenti nedostaje: ${listInWords(missing)}.`,
  chooseClient: 'Odaberite klijenta.',
  needsAddress: (client) => `Upišite adresu klijenta „${client}” pod Računi, Klijenti.`,
  reverseChargeOnly: (client) =>
    `Aplikacija izrađuje račune bez PDV-a samo za klijente s prijenosom porezne obveze. Ako PDV obračunava klijent „${client}”, označite mu prijenos porezne obveze pod Računi, Klijenti, ili ovaj račun izradite drugdje.`,
  addLine: 'Dodajte stavku.',
  lineDescription: 'Svaka stavka mora imati opis.',
  lineAmount: 'Svaka stavka mora imati iznos veći od nule.',
  unknownTokens: (unknown, known) => `${listInWords(unknown)} nije među oznakama ${listInWords(known)}`,
  pathEndsInPdf: 'putanja završava nazivom datoteke, na primjer {yyyy}-{mm}-{client}-invoice.pdf',
  blankFolder: 'naziv mape između dviju kosih crta je prazan',
  patternExample: 'uzorak, na primjer {n}-1-{yy}',
  sequenceOnce: 'uzorak mora sadržavati {n}, redni broj, točno jednom',
}

export const words = language === 'hr' ? hr : en
