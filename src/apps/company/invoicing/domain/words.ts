import { language } from '../../../../shared/text/language'
import { listInWords } from '../../../../shared/text/listInWords'
import type { Translation } from '../../../../shared/text/translation'
import type { TemplateProblem } from './invoiceTemplate'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// An invoice is račun and its line stavka, and a plan item usluga iz plana. Invoicing, Clients names the screen and its tab. A word in braces keeps its spelling, such as {yyyy}.

export const en = {
  /** What the invoice terms lack, each as the sentence of missing details lists it. */
  issuer: {
    name: 'your company name',
    address: 'your address',
    oib: 'your OIB',
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
  /** What is wrong with one line of a client's invoice lines, without naming the line. */
  templateProblem: (problem: TemplateProblem): string => {
    switch (problem.kind) {
      case 'blank-text':
        return 'the line needs a text'
      case 'unknown-tokens':
        return `${problem.tokens.join(', ')} is not {month}, the only word in braces a line can name`
      case 'separator':
        return 'a line and its plan items cannot hold | or a line break'
      case 'no-items':
        return 'only the last line can name no plan item, since it takes every plan item no line names'
      case 'item-twice':
        return `${problem.item} is on an earlier line already`
    }
  },
  /** Which line of a client's invoice lines a problem is on, counted from 1. */
  templateLine: (line: number, problem: string) => `line ${line + 1}: ${problem}`,
}

export const hr: Translation<typeof en> = {
  issuer: {
    name: 'naziv vaše tvrtke',
    address: 'vaša adresa',
    oib: 'vaš OIB',
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
  templateProblem: (problem) => {
    switch (problem.kind) {
      case 'blank-text':
        return 'stavka mora imati tekst'
      case 'unknown-tokens':
        return `${listInWords(problem.tokens)} nije {month}, jedina riječ u vitičastim zagradama koju stavka smije sadržavati`
      case 'separator':
        return 'stavka i njezine usluge iz plana ne smiju sadržavati | ni prijelom retka'
      case 'no-items':
        return 'samo zadnja stavka smije biti bez usluga iz plana, jer ona preuzima sve usluge iz plana koje nijedna druga ne navodi'
      case 'item-twice':
        return `„${problem.item}” je već u jednoj od prethodnih stavki`
    }
  },
  templateLine: (line, problem) => `stavka ${line + 1}: ${problem}`,
}

export const words = language === 'hr' ? hr : en

/** Each problem of a client's invoice lines as a phrase that names its line. */
export function templateProblemsInWords(problems: readonly TemplateProblem[]): string[] {
  return problems.map((problem) => words.templateLine(problem.line, words.templateProblem(problem)))
}
