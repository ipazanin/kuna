import { language } from '../../text/language'
import { plural } from '../../text/translation'
import type { CroatianForms, EnglishForms } from '../../text/translation'

const en = {
  fromFile: (file: string) => `from ${file}`,
  fromChat: 'from the chat',
  unchecked: (count: number, source: string): EnglishForms => ({
    one: `The AI read 1 row ${source}. Kuna could not check that the statement adds up, so check it against it.`,
    other: `The AI read ${count} rows ${source}. Kuna could not check that the statement adds up, so check them against it.`,
  }),
  tied: (count: number, source: string): EnglishForms => ({
    one: `The AI read 1 row ${source}. Check it against the statement.`,
    other: `The AI read ${count} rows ${source}. Check them against the statement.`,
  }),
}

const hr = {
  fromFile: (file: string) => `iz datoteke ${file}`,
  fromChat: 'iz razgovora',
  unchecked: (count: number, source: string): CroatianForms => ({
    one: `AI je ${source} pročitao ${count} redak. Kuna nije mogla provjeriti zbraja li se izvod, pa ga usporedite s njim.`,
    few: `AI je ${source} pročitao ${count} retka. Kuna nije mogla provjeriti zbraja li se izvod, pa ih usporedite s njim.`,
    other: `AI je ${source} pročitao ${count} redaka. Kuna nije mogla provjeriti zbraja li se izvod, pa ih usporedite s njim.`,
  }),
  tied: (count: number, source: string): CroatianForms => ({
    one: `AI je ${source} pročitao ${count} redak. Usporedite ga s izvodom.`,
    few: `AI je ${source} pročitao ${count} retka. Usporedite ih s izvodom.`,
    other: `AI je ${source} pročitao ${count} redaka. Usporedite ih s izvodom.`,
  }),
}

const words = language === 'hr' ? hr : en

/** Where rows the AI copied came from, as a phrase that leads the sentence about them: the attached file by name, or the chat when there is none. */
export function copiedRowsSource(file: string | null): string {
  return file === null ? words.fromChat : words.fromFile(file)
}

/** The warning on rows the AI copied out of a statement, with whether Kuna could check that the statement adds up. */
export function copiedStatementRowsWarning(count: number, file: string | null, tied: boolean): string {
  const source = copiedRowsSource(file)
  return plural(tied ? words.tied(count, source) : words.unchecked(count, source), count)
}
