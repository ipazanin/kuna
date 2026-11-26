import { language } from '../../../../shared/text/language'
import { listInWords } from '../../../../shared/text/listInWords'
import type { Translation } from '../../../../shared/text/translation'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import type { Money } from '../../../../shared/money/money'
import type { RegisterLinesProblem } from './invoiceLine'
import type { TemplateProblem } from './invoiceTemplate'
import type { PatternProblem } from './templateTokens'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// An invoice is račun and its line stavka, and a plan item usluga iz plana. Invoicing, Clients names the screen and its tab. A word in braces keeps its spelling, such as {yyyy}.

export const en = {
  addLine: 'Add a line.',
  lineDescription: 'Every line needs a description.',
  lineAmount: 'Every line needs an amount above zero.',
  lineSeparator: 'No line or plan item can hold | or a line break.',
  linesTotal: (total: Money, amount: Money) => `The lines add up to ${formatMoney(total)}, not the amount of ${formatMoney(amount)}.`,
  /** Why an invoice number, filing path or mail pattern cannot be used. */
  patternProblem: (problem: PatternProblem): string => {
    switch (problem.kind) {
      case 'unknown-tokens':
        return `${problem.unknown.join(', ')} is not one of ${problem.known.join(', ')}`
      case 'path-not-pdf':
        return 'the path ends in a file name such as {yyyy}-{mm}-{client}-invoice.pdf'
      case 'blank-folder':
        return 'a folder name between two slashes is blank'
      case 'blank-pattern':
        return 'a pattern such as {n}-1-{yy}'
      case 'sequence-not-once':
        return 'the pattern needs {n}, the sequence, exactly once'
    }
  },
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
  addLine: 'Dodajte stavku.',
  lineDescription: 'Svaka stavka mora imati opis.',
  lineAmount: 'Svaka stavka mora imati iznos veći od nule.',
  lineSeparator: 'Nijedna stavka ni usluga iz plana ne smije sadržavati | ni prijelom retka.',
  linesTotal: (total, amount) => `Stavke zajedno iznose ${formatMoney(total)}, a ne ${formatMoney(amount)}, koliko glasi iznos.`,
  patternProblem: (problem) => {
    switch (problem.kind) {
      case 'unknown-tokens':
        return `${listInWords(problem.unknown)} nije među oznakama ${listInWords(problem.known)}`
      case 'path-not-pdf':
        return 'putanja završava nazivom datoteke, na primjer {yyyy}-{mm}-{client}-invoice.pdf'
      case 'blank-folder':
        return 'naziv mape između dviju kosih crta je prazan'
      case 'blank-pattern':
        return 'uzorak, na primjer {n}-1-{yy}'
      case 'sequence-not-once':
        return 'uzorak mora sadržavati {n}, redni broj, točno jednom'
    }
  },
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

/** Each problem of a client's invoice lines as a phrase that names its line, in the screen's language or the one given. */
export function templateProblemsInWords(problems: readonly TemplateProblem[], said: typeof en = words): string[] {
  return problems.map((problem) => said.templateLine(problem.line, said.templateProblem(problem)))
}

/** What is wrong with an invoice's lines as sentences, each kind once, in the order the lines show them, in the screen's language or the one given. */
export function lineProblemsInWords(problems: readonly RegisterLinesProblem[], said: typeof en = words): string[] {
  const sentences = problems.map((problem) => {
    switch (problem.kind) {
      case 'no-lines':
        return said.addLine
      case 'blank-text':
        return said.lineDescription
      case 'not-above-zero':
        return said.lineAmount
      case 'separator':
        return said.lineSeparator
      case 'total':
        return said.linesTotal(problem.total, problem.amount)
    }
  })
  return [...new Set(sentences)]
}
