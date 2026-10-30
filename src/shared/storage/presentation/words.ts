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
  firstRun: {
    home: {
      drive: 'A new file on Google Drive',
      driveNote: 'One file you open on your phone and computer. Backed up daily.',
      browser: 'A new file in this browser',
      browserNote: 'No Google. One device. Export to keep a copy.',
      open: 'My file on Google Drive',
      openNote: 'Another device already keeps it.',
      drops: 'It exists only here and in the files you exported. Export it first if you want to keep it.',
      continue: 'Continue',
    },
    folder: {
      subtitle: 'The Picker opens at My Drive. Nothing is made until you confirm the folder.',
      unseen: ', inside folders the app cannot see. Open it in Drive to check where it is.',
      withBackups: ', with a backups folder beside it',
      openFolder: 'Open this folder in Drive',
      failed: 'That did not work',
      chooseAgain: 'Choose a folder again',
      chooseAnother: 'Choose another',
      create: 'Create the file here',
      chooseFirst: 'Choose a folder in Google Drive',
      created: (name: string, folder: string) => `Created ${name} in ${folder}`,
      createdNote: 'The app keeps a copy in this browser, and a backups folder beside the file.',
    },
    find: {
      pick: 'Pick another file',
      find: 'Find the file',
    },
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
  firstRun: {
    home: {
      drive: 'Nova datoteka na Google Driveu',
      driveNote: 'Jedna datoteka koju otvarate na mobitelu i računalu. Sigurnosna kopija svaki dan.',
      browser: 'Nova datoteka u ovom pregledniku',
      browserNote: 'Bez Googlea. Jedan uređaj. Izvezite je da sačuvate kopiju.',
      open: 'Moja datoteka na Google Driveu',
      openNote: 'Već je čuva drugi uređaj.',
      drops: 'Postoji samo ovdje i u datotekama koje ste izvezli. Najprije je izvezite ako je želite sačuvati.',
      continue: 'Nastavi',
    },
    folder: {
      subtitle: 'Prozor za odabir otvara se u mapi Moj disk. Ništa se ne stvara dok ne potvrdite mapu.',
      unseen: ', unutar mapa koje aplikacija ne vidi. Otvorite je na Driveu da provjerite gdje je.',
      withBackups: ', uz mapu sa sigurnosnim kopijama',
      openFolder: 'Otvori ovu mapu na Driveu',
      failed: 'To nije uspjelo',
      chooseAgain: 'Ponovno odaberi mapu',
      chooseAnother: 'Odaberi drugu',
      create: 'Napravi datoteku ovdje',
      chooseFirst: 'Odaberi mapu na Google Driveu',
      created: (name, folder) => `Datoteka ${name} napravljena je u mapi ${folder}`,
      createdNote: 'Aplikacija čuva kopiju u ovom pregledniku i mapu sa sigurnosnim kopijama uz datoteku.',
    },
    find: {
      pick: 'Odaberi drugu datoteku',
      find: 'Pronađi datoteku',
    },
  },
}

export const words = language === 'hr' ? hr : en
