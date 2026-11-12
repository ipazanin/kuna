import { BOOKING_DAYS_APART } from '../../money/lookAlikeBookings'
import type { TwinAnswer } from '../../money/lookAlikeBookings'
import { language } from '../../text/language'
import { plural } from '../../text/translation'
import type { CroatianForms, EnglishForms } from '../../text/translation'
import type { ProposalNote } from '../../app/assistantOperations'

/**
 * What an app's copied rows look like, as the shared note words it: what one row looks like and what several do, after
 * "looks like" (in Croatian the dative after "nalikuje"), and what the person says a row may be instead.
 */
export interface LookAlikePhrase {
  readonly one: string
  readonly many: string
  readonly another: string
}

const en = {
  fromFile: (file: string) => `from ${file}`,
  fromChat: 'from the chat',
  unchecked: (count: number, source: string): EnglishForms => ({
    one: `The AI read 1 row ${source}. Kuna could not check that the statement adds up, so check it against it.`,
    other: `The AI read ${count} rows ${source}. Kuna could not check that the statement adds up, so check them against it.`,
  }),
  atLastPart: (count: number, source: string): EnglishForms => ({
    one: `The AI read 1 row ${source}. Kuna checks that the statement adds up once its last part gives the closing balance.`,
    other: `The AI read ${count} rows ${source}. Kuna checks that the statement adds up once its last part gives the closing balance.`,
  }),
  tied: (count: number, source: string): EnglishForms => ({
    one: `The AI read 1 row ${source}. Check it against the statement.`,
    other: `The AI read ${count} rows ${source}. Check them against the statement.`,
  }),
  lookAlikesWaiting: (count: number): EnglishForms => ({ one: '1 row waits, not imported', other: `${count} rows wait, not imported` }),
  lookAlikesWhy: ({ one, many, another }: LookAlikePhrase): EnglishForms => ({
    one: `It looks like ${one}. Say in the chat whether it is ${another}.`,
    other: `They look like ${many}. Say in the chat whether each is ${another}.`,
  }),
  bookingLookAlike: (days: number): LookAlikePhrase => ({
    one: `a row Kuna has from another source, with the same amount and at most ${days} days apart`,
    many: `rows Kuna has from another source, each with the same amount and at most ${days} days apart`,
    another: 'another payment',
  }),
  inKuna: (count: number): EnglishForms => ({ one: '1 row is in Kuna already and is skipped.', other: `${count} rows are in Kuna already and are skipped.` }),
  likeCopied: (row: string) => `Looks like a row the AI copied: ${row}`,
  likeSynced: (row: string) => `Looks like a row the bank sync brought: ${row}`,
  likeFiled: (row: string) => `Looks like a row a file brought: ${row}`,
  likeKept: (row: string) => `Looks like a row Kuna has: ${row}`,
  twins: {
    title: 'Rows that look like ones Kuna has',
    intro: (days: number) =>
      `Each looks like a row Kuna has from another source, with the same amount and at most ${days} days apart. Until you pick Keep both or another choice, the file's row is not imported.`,
    syncIntro: (days: number) =>
      `Each looks like a row Kuna has from another source, with the same amount and at most ${days} days apart. Until you pick Keep both or another choice, the bank's row is not imported.`,
    choice: 'Which to keep',
    later: 'Decide later',
    both: 'Keep both',
    file: "Replace with the file's row",
    kept: 'Keep the row Kuna has',
    gone: 'The row it looked like is gone',
    keepIt: 'Keep it',
    leaveOut: 'Leave it out',
  },
}

const hr = {
  fromFile: (file: string) => `iz datoteke ${file}`,
  fromChat: 'iz razgovora',
  unchecked: (count: number, source: string): CroatianForms => ({
    one: `AI je ${source} pročitao ${count} redak. Kuna nije mogla provjeriti zbraja li se izvod, pa ga usporedite s njim.`,
    few: `AI je ${source} pročitao ${count} retka. Kuna nije mogla provjeriti zbraja li se izvod, pa ih usporedite s njim.`,
    other: `AI je ${source} pročitao ${count} redaka. Kuna nije mogla provjeriti zbraja li se izvod, pa ih usporedite s njim.`,
  }),
  atLastPart: (count: number, source: string): CroatianForms => ({
    one: `AI je ${source} pročitao ${count} redak. Kuna provjerava zbraja li se izvod kad njegov zadnji dio navede završno stanje.`,
    few: `AI je ${source} pročitao ${count} retka. Kuna provjerava zbraja li se izvod kad njegov zadnji dio navede završno stanje.`,
    other: `AI je ${source} pročitao ${count} redaka. Kuna provjerava zbraja li se izvod kad njegov zadnji dio navede završno stanje.`,
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
  lookAlikesWhy: ({ one, many, another }: LookAlikePhrase): CroatianForms => ({
    one: `Nalikuje ${one}. Recite u razgovoru je li to ${another}.`,
    few: `Nalikuju ${many}. Recite u razgovoru je li svaki od njih ${another}.`,
    other: `Nalikuju ${many}. Recite u razgovoru je li svaki od njih ${another}.`,
  }),
  bookingLookAlike: (days: number): LookAlikePhrase => ({
    one: `retku koji Kuna ima iz drugog izvora, s istim iznosom i najviše ${days} dana razlike`,
    many: `retcima koje Kuna ima iz drugog izvora, svaki s istim iznosom i najviše ${days} dana razlike`,
    another: 'drugo plaćanje',
  }),
  inKuna: (count: number): CroatianForms => ({
    one: `${count} redak već je u Kuni i preskočen je.`,
    few: `${count} retka već su u Kuni i preskočena su.`,
    other: `${count} redaka već je u Kuni i preskočeno je.`,
  }),
  likeCopied: (row: string) => `Nalikuje retku koji je AI prepisao: ${row}`,
  likeSynced: (row: string) => `Nalikuje retku koji je donijela sinkronizacija s bankom: ${row}`,
  likeFiled: (row: string) => `Nalikuje retku koji je donijela datoteka: ${row}`,
  likeKept: (row: string) => `Nalikuje retku koji Kuna ima: ${row}`,
  twins: {
    title: 'Retci nalik onima koje Kuna ima',
    intro: (days: number) =>
      `Svaki nalikuje retku koji Kuna ima iz drugog izvora, s istim iznosom i najviše ${days} dana razlike. Dok ne odaberete Zadrži oba ili drugi izbor, redak iz datoteke se ne uvozi.`,
    syncIntro: (days: number) =>
      `Svaki nalikuje retku koji Kuna ima iz drugog izvora, s istim iznosom i najviše ${days} dana razlike. Dok ne odaberete Zadrži oba ili drugi izbor, redak iz banke se ne uvozi.`,
    choice: 'Što zadržati',
    later: 'Odluči poslije',
    both: 'Zadrži oba',
    file: 'Zamijeni retkom iz datoteke',
    kept: 'Zadrži redak koji Kuna ima',
    gone: 'Redak kojem je nalikovao više ne postoji',
    keepIt: 'Zadrži ga',
    leaveOut: 'Izostavi ga',
  },
}

const words = language === 'hr' ? hr : en

/** Where rows the AI copied came from, as a phrase that leads the sentence about them: the attached file by name, or the chat when there is none. */
export function copiedRowsSource(file: string | null): string {
  return file === null ? words.fromChat : words.fromFile(file)
}

/** Whether Kuna checks that a copied statement adds up: on this card, on a later part's card, or not at all. */
export type CopiedStatementCheck = 'tied' | 'at-last-part' | 'unchecked'

/** The check a copied part gets from the balances it gives: a closing ties the statement here, and an opening or a part after the first leaves it to the last part. */
export function copiedStatementCheck(part: { readonly part: number; readonly opening: number | null; readonly closing: number | null }): CopiedStatementCheck {
  if (part.closing !== null) return 'tied'
  return part.opening !== null || part.part > 1 ? 'at-last-part' : 'unchecked'
}

/** The warning on rows the AI copied out of a statement, with when Kuna checks that the statement adds up. */
export function copiedStatementRowsWarning(count: number, file: string | null, check: CopiedStatementCheck): string {
  const source = copiedRowsSource(file)
  const forms = check === 'tied' ? words.tied(count, source) : check === 'at-last-part' ? words.atLastPart(count, source) : words.unchecked(count, source)
  return plural(forms, count)
}

/** A copied row that waits, as the card lists it beside the row Kuna has, each as its parts in the app's own format. */
export interface CopiedLookAlike {
  readonly row: readonly string[]
  readonly like: readonly string[]
}

/** What a copied row looks like when the shared matcher of bookings finds it, as Spending and Company word it. */
export const BOOKING_LOOK_ALIKE: LookAlikePhrase = words.bookingLookAlike(BOOKING_DAYS_APART)

/** The card's note on copied rows that wait as look-alikes, in the app's phrase for what they look like, which asks the person to say in the chat. */
export function lookAlikesNote(lookAlikes: readonly CopiedLookAlike[], phrase: LookAlikePhrase): ProposalNote {
  const count = lookAlikes.length
  return {
    label: plural(words.lookAlikesWaiting(count), count),
    text: plural(words.lookAlikesWhy(phrase), count),
    tone: 'info',
    items: lookAlikes.map(({ row, like }) => ({ row: row.join(', '), record: like.join(', ') })),
  }
}

/** The caption under a row that names the row it looks like, given as its parts in the app's own format, by where that row came from, or `kept` where Kuna does not keep that. */
export function likeCaption(source: 'copied' | 'sync' | 'file' | 'kept', booked: readonly string[]): string {
  const row = booked.join(', ')
  switch (source) {
    case 'copied':
      return words.likeCopied(row)
    case 'sync':
      return words.likeSynced(row)
    case 'file':
      return words.likeFiled(row)
    case 'kept':
      return words.likeKept(row)
  }
}

/** What Kuna asks of rows that look like rows it has from another source, on Import, on the bank sync's card and on To review. */
export const twinWords = {
  title: words.twins.title,
  intro: { file: words.twins.intro(BOOKING_DAYS_APART), sync: words.twins.syncIntro(BOOKING_DAYS_APART) },
  choice: words.twins.choice,
  gone: words.twins.gone,
}

/** An answer, `later` while the person has not given one. */
export type TwinChoice = 'later' | TwinAnswer['keep']

/**
 * The choices for a row of a file: keep both, let the file's row take the other's place, or keep the row Kuna has. For a row of
 * the bank sync: keep both or keep the row Kuna has. For a row whose look-alike is gone: keep it, which books it, or leave it out.
 */
export const TWIN_CHOICES: Readonly<Record<'file' | 'sync' | 'gone', readonly { readonly value: TwinChoice; readonly label: string }[]>> = {
  file: [
    { value: 'later', label: words.twins.later },
    { value: 'both', label: words.twins.both },
    { value: 'file', label: words.twins.file },
    { value: 'kept', label: words.twins.kept },
  ],
  sync: [
    { value: 'later', label: words.twins.later },
    { value: 'both', label: words.twins.both },
    { value: 'kept', label: words.twins.kept },
  ],
  gone: [
    { value: 'later', label: words.twins.later },
    { value: 'both', label: words.twins.keepIt },
    { value: 'kept', label: words.twins.leaveOut },
  ],
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
