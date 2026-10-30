import { capitalised } from '../../text/capitalised'
import { language } from '../../text/language'
import { plural } from '../../text/translation'
import type { Translation } from '../../text/translation'
import type { RecordNoun } from '../domain/recordKind'
import { agreeing } from '../domain/words'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// The books file is datoteka in Croatian, so that knjige keeps its legal sense. A Croatian date ends in its own full stop.

/** What a write did to the records of one kind, by the labels of the records. */
export interface ChangedRecords {
  readonly verb: 'add' | 'change' | 'remove'
  readonly noun: RecordNoun
  readonly labels: readonly string[]
}

const ENGLISH_VERBS = {
  add: { done: 'added', undone: 'adding' },
  change: { done: 'changed', undone: 'changing' },
  remove: { done: 'deleted', undone: 'deleting' },
} as const

/** The participle's stem and the noun for the act, as in "dodan je račun" and "poništeno je dodavanje računa". */
const CROATIAN_VERBS = {
  add: { done: 'dodan', undone: 'dodavanje' },
  change: { done: 'promijenjen', undone: 'mijenjanje' },
  remove: { done: 'obrisan', undone: 'brisanje' },
} as const

function englishPart({ verb, noun, labels }: ChangedRecords, undid: boolean): string {
  const words = ENGLISH_VERBS[verb]
  const count = labels.length
  const records = count === 1 ? `the ${noun.en.one} "${labels[0]}"` : `${count} ${noun.en.many}`
  return `${undid ? words.undone : words.done} ${records}`
}

/** "dodan je kredit „Stambeni”", "promijenjene su 2 kategorije", "obrisano je 5 kredita", and for an undo "dodavanje kredita „Stambeni”". */
function croatianPart({ verb, noun, labels }: ChangedRecords, undid: boolean): string {
  const { done, undone } = CROATIAN_VERBS[verb]
  const count = labels.length
  if (undid) return `${undone} ${count === 1 ? `${noun.hr.of} „${labels[0]}”` : `${count} ${plural({ one: noun.hr.of, few: noun.hr.few, other: noun.hr.other }, count)}`}`
  if (count === 1) return `${done}${agreeing(noun.hr, '', 'a', 'o')} je ${noun.hr.one} „${labels[0]}”`
  return plural(
    {
      one: `${done}${agreeing(noun.hr, '', 'a', 'o')} je ${count} ${noun.hr.one}`,
      few: `${done}${agreeing(noun.hr, 'a', 'e', 'a')} su ${count} ${noun.hr.few}`,
      other: `${done}o je ${count} ${noun.hr.other}`,
    },
    count,
  )
}

export const en = {
  /** "Added the invoice "1-1-26"", "Changed 2 categories and deleted an asset", or for an undo "Undid adding the invoice "1-1-26"". */
  changes: (groups: readonly ChangedRecords[], undid: boolean) => {
    const parts = groups.map((group) => englishPart(group, undid))
    const sentence = parts.length <= 1 ? (parts[0] ?? 'changed nothing') : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`
    return capitalised(undid ? `undid ${sentence}` : sentence)
  },
  undone: 'Undone',
  notUndone: 'Not undone',
  undo: 'Undo',
  nothingChanged: 'Nothing changed',
  alreadyHeld: 'The workbook already holds this.',
  nothingWritten: 'Nothing was written',
  mayNotHaveFinished: 'The save may not have finished',
  booksFile: {
    inBrowser: 'Kept in this browser. Your exported files are its only other copies.',
    lastChanged: (stamp: string) => `Last changed ${stamp}. `,
    lastExported: (day: string) => `Last exported ${day}.`,
    notExported: 'Not exported yet.',
    reminderTitle: 'Some changes are in no exported file yet',
    reminder: 'They live only in this browser, which can lose them if its site data is cleared. Export to keep a copy.',
    onDrive: 'On Google Drive. A copy is kept in this browser, and so is the Google sign-in until it expires, about an hour later.',
    folder: 'Folder',
    lastSaved: 'Last saved',
    lastBackup: 'Last backup',
    noBackup: 'None yet. The first save of a day makes one.',
    lastSynced: 'Last synced',
    openInDrive: 'Open in Drive',
  },
  localFile: {
    kept: 'Kept in this browser',
    notExported: 'Not exported yet',
    exported: (day: string) => `Exported ${day}`,
    reminder: (day: string) => `Changes since ${day} are in no exported file.`,
    export: 'Export',
  },
}

export const hr: Translation<typeof en> = {
  changes: (groups, undid) => {
    const parts = groups.map((group) => croatianPart(group, undid))
    const sentence = parts.length === 0 ? 'ništa nije promijenjeno' : `${parts.slice(0, -1).join(', ')}${parts.length > 1 ? ' i ' : ''}${parts.at(-1)}`
    return capitalised(undid && parts.length > 0 ? `poništeno je ${sentence}` : sentence)
  },
  undone: 'Poništeno',
  notUndone: 'Nije poništeno',
  undo: 'Poništi',
  nothingChanged: 'Ništa se nije promijenilo',
  alreadyHeld: 'Datoteka to već sadrži.',
  nothingWritten: 'Ništa nije upisano',
  mayNotHaveFinished: 'Spremanje možda nije završilo',
  booksFile: {
    inBrowser: 'Čuva se u ovom pregledniku. Datoteke koje izvezete njezine su jedine druge kopije.',
    lastChanged: (stamp) => `Zadnja promjena ${stamp}. `,
    lastExported: (day) => `Zadnji izvoz ${day}`,
    notExported: 'Još nije izvezena.',
    reminderTitle: 'Neke promjene još nisu ni u jednoj izvezenoj datoteci',
    reminder: 'Postoje samo u ovom pregledniku, koji ih može izgubiti ako se obrišu podaci stranice. Izvezite datoteku da sačuvate kopiju.',
    onDrive: 'Na Google Driveu. Kopija se čuva u ovom pregledniku, kao i Google prijava dok ne istekne, otprilike sat vremena kasnije.',
    folder: 'Mapa',
    lastSaved: 'Zadnje spremanje',
    lastBackup: 'Zadnja sigurnosna kopija',
    noBackup: 'Još nema. Izradit će je prvo spremanje u danu.',
    lastSynced: 'Zadnja sinkronizacija',
    openInDrive: 'Otvori na Driveu',
  },
  localFile: {
    kept: 'Čuva se u ovom pregledniku',
    notExported: 'Još nije izvezena',
    exported: (day) => `Izvezena ${day}`,
    reminder: (day) => `Promjene od ${day} nisu ni u jednoj izvezenoj datoteci.`,
    export: 'Izvezi',
  },
}

export const words = language === 'hr' ? hr : en
