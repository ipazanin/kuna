import { BOOKING_DAYS_APART } from '../../money/lookAlikeBookings'
import { language } from '../../text/language'
import { plural } from '../../text/translation'
import type { CroatianForms, EnglishForms } from '../../text/translation'
import type { ProposalNote } from '../../app/assistantOperations'

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
  lookAlikesWaiting: (count: number): EnglishForms => ({ one: '1 row waits, not imported', other: `${count} rows wait, not imported` }),
  lookAlikesWhy: (days: number): EnglishForms => ({
    one: `It looks like a row Kuna has from another source, with the same amount and at most ${days} days apart. Say in the chat whether it is another payment.`,
    other: `They look like rows Kuna has from another source, each with the same amount and at most ${days} days apart. Say in the chat whether each is another payment.`,
  }),
  inKuna: (count: number): EnglishForms => ({ one: '1 row is in Kuna already and is skipped.', other: `${count} rows are in Kuna already and are skipped.` }),
  likeCopied: (row: string) => `Looks like a row the AI copied: ${row}`,
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
  lookAlikesWaiting: (count: number): CroatianForms => ({
    one: `${count} redak čeka, nije uvezen`,
    few: `${count} retka čekaju, nisu uvezena`,
    other: `${count} redaka čeka, nije uvezeno`,
  }),
  lookAlikesWhy: (days: number): CroatianForms => ({
    one: `Nalikuje retku koji Kuna ima iz drugog izvora, s istim iznosom i najviše ${days} dana razlike. Recite u razgovoru je li to drugo plaćanje.`,
    few: `Nalikuju retcima koje Kuna ima iz drugog izvora, svaki s istim iznosom i najviše ${days} dana razlike. Recite u razgovoru je li svaki od njih drugo plaćanje.`,
    other: `Nalikuju retcima koje Kuna ima iz drugog izvora, svaki s istim iznosom i najviše ${days} dana razlike. Recite u razgovoru je li svaki od njih drugo plaćanje.`,
  }),
  inKuna: (count: number): CroatianForms => ({
    one: `${count} redak već je u Kuni i preskočen je.`,
    few: `${count} retka već su u Kuni i preskočena su.`,
    other: `${count} redaka već je u Kuni i preskočeno je.`,
  }),
  likeCopied: (row: string) => `Nalikuje retku koji je AI prepisao: ${row}`,
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

/** A copied row that waits, as the card lists it beside the row Kuna has, each as its parts in the app's own format. */
export interface CopiedLookAlike {
  readonly row: readonly string[]
  readonly like: readonly string[]
}

/** The card's note on copied rows that wait as look-alikes, which asks the person to say in the chat. */
export function lookAlikesNote(lookAlikes: readonly CopiedLookAlike[]): ProposalNote {
  const count = lookAlikes.length
  return {
    label: plural(words.lookAlikesWaiting(count), count),
    text: plural(words.lookAlikesWhy(BOOKING_DAYS_APART), count),
    tone: 'info',
    items: lookAlikes.map(({ row, like }) => ({ row: row.join(', '), record: like.join(', ') })),
  }
}

/** The caption under a file's row that names the row the AI copied it looks like, given as its parts in the app's own format. */
export function likeCopiedCaption(copied: readonly string[]): string {
  return words.likeCopied(copied.join(', '))
}

/** The card's line on copied rows Kuna has already, as the same booking or by their key. */
export function copiedInKunaText(count: number): string {
  return plural(words.inKuna(count), count)
}

/**
 * What the model hears of copied rows that wait as look-alikes, by their number among the rows it copied, in English as it
 * hears every answer. `nothingElse` says the card would write nothing else, so it is refused and the model asks first.
 */
export function lookAlikesForTheModel(rows: readonly number[], nothingElse: boolean): string {
  const named = rows.length === 1 ? `Row ${rows[0]} looks like a row Kuna has from another source` : `Rows ${rows.join(', ')} look like rows Kuna has from another source`
  const why = `, with the same amount and at most ${BOOKING_DAYS_APART} days apart,`
  return nothingElse
    ? `${named}${why} and nothing else is new. Ask the person whether each is another payment, and if so propose the same rows again with lookAlikes import.`
    : `${named}${why} and ${rows.length === 1 ? 'waits' : 'wait'}. Ask the person whether each is another payment, and if so propose the same rows again with lookAlikes import once this card is answered.`
}
