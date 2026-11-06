import { capitalised } from '../../text/capitalised'
import { language } from '../../text/language'
import { plural } from '../../text/translation'
import type { EnglishForms, Translation } from '../../text/translation'
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
    unnamedFolder: 'A folder Kuna cannot read the name of',
    lastSaved: 'Last saved',
    lastBackup: 'Last backup',
    noBackup: 'None yet. The first save of a day makes one.',
    lastSynced: 'Last synced',
    openInDrive: 'Open in Drive',
    missingTitle: 'Kuna stopped using this file',
  },
  localFile: {
    kept: 'Kept in this browser',
    notExported: 'Not exported yet',
    exported: (day: string) => `Exported ${day}`,
    reminder: (day: string) => `Changes since ${day} are in no exported file.`,
    export: 'Export',
  },
  firstRun: {
    steps: 'Steps',
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
      subtitle: 'Your files live in one Kuna folder, with a folder inside it for each app. Nothing is made until you tap Create.',
      withBackups: ', with a backups folder beside it',
      openFolder: 'Open this folder in Drive',
      failed: 'That did not work',
      haveOne: 'Already keep this file on Drive? Open it instead of making an empty one. Kuna cannot always see a file you once picked by hand.',
      openExisting: 'Open a file I already have',
      elsewhere: 'Put the Kuna folder elsewhere',
      pickerTitle: 'Choose where the Kuna folder goes',
      create: 'Create the file here',
      created: (name: string, folder: string) => `Created ${name} in ${folder}`,
      createdNote: 'The app keeps a copy in this browser, and a backups folder beside the file.',
      moved: (count: number): EnglishForms => ({ one: `Moved ${count} record`, other: `Moved ${count} records` }),
      movedNote: (name: string, where: string) => `${name} in ${where} holds them. The app read it back and found the same records.`,
    },
    find: {
      pick: 'Pick another file',
      find: 'Find the file',
    },
  },
  moveIntoKuna: {
    action: "Move into Kuna's folder",
    finish: 'Finish the move',
    title: "Move this file into Kuna's folder?",
    description: 'It goes here, and only when you press Move.',
    goes: 'Goes with it',
    backups: (count: number): EnglishForms => ({ one: `${count} backup of this file`, other: `${count} backups of this file` }),
    kunaFiles: (count: number): EnglishForms => ({ one: `: ${count} file Kuna made`, other: `: ${count} files Kuna made` }),
    stays: 'Stays where it is',
    others: (count: number): EnglishForms => ({
      one: `${count} other file in those folders. Kuna cannot say it made it, as with an older file or one a script or a person put there, so it stays, and it goes on working there for whatever made it.`,
      other: `${count} other files in those folders. Kuna cannot say it made them, as with older files or ones a script or a person put there, so they stay, and they go on working there for whatever made them.`,
    }),
    stopsReading:
      ': Kuna stops reading this folder and files the same statements from your mail into its own folder, so nothing is lost. A script that files there is not touched, and goes on filing. A file you put there by hand and have not imported needs Import.',
    blockedTitle: "These folders are named from this file's own folder, so a move would lose them. Name them as a path from My Drive first:",
    keepsWorking:
      'Kuna goes on finding the file on your other devices, with nothing to do there. Anything outside Kuna that reaches it by its path, such as Drive for Desktop or a script, needs the new path.',
    partWay: 'The file goes first. If what follows stops part way, a sync may not find a folder that has not caught up, and the button stays until you press it again.',
    cancel: 'Not now',
    confirm: 'Move',
    failed: 'The move did not finish',
    moved: (name: string, where: string) => `Moved ${name} to ${where}`,
    unfinished: (reason: string) => `The file moved, and the rest is still in its old folder. Press Move to bring it. ${reason}`,
    left: (names: string) => `These stayed where they were, because the new folder already holds one of the same name: ${names}.`,
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
    unnamedFolder: 'Mapa čiji naziv Kuna ne može pročitati',
    lastSaved: 'Zadnje spremanje',
    lastBackup: 'Zadnja sigurnosna kopija',
    noBackup: 'Još nema. Izradit će je prvo spremanje u danu.',
    lastSynced: 'Zadnja sinkronizacija',
    openInDrive: 'Otvori na Driveu',
    missingTitle: 'Kuna je prestala koristiti ovu datoteku',
  },
  localFile: {
    kept: 'Čuva se u ovom pregledniku',
    notExported: 'Još nije izvezena',
    exported: (day) => `Izvezena ${day}`,
    reminder: (day) => `Promjene od ${day} nisu ni u jednoj izvezenoj datoteci.`,
    export: 'Izvezi',
  },
  firstRun: {
    steps: 'Koraci',
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
      subtitle: 'Vaše datoteke čuvaju se u jednoj mapi Kuna, s mapom za svaku aplikaciju. Ništa se ne stvara dok ne dodirnete Izradi.',
      withBackups: ', uz mapu sa sigurnosnim kopijama',
      openFolder: 'Otvori ovu mapu na Driveu',
      failed: 'To nije uspjelo',
      haveOne: 'Već čuvate ovu datoteku na Driveu? Otvorite je umjesto da izradite praznu. Kuna ne vidi uvijek datoteku koju ste jednom odabrali ručno.',
      openExisting: 'Otvori datoteku koju već imam',
      elsewhere: 'Stavi mapu Kuna drugdje',
      pickerTitle: 'Odaberite gdje ide mapa Kuna',
      create: 'Izradi datoteku ovdje',
      created: (name, folder) => `Datoteka „${name}” izrađena je u mapi „${folder}”`,
      createdNote: 'Aplikacija čuva kopiju u ovom pregledniku i mapu sa sigurnosnim kopijama uz datoteku.',
      moved: (count) => ({ one: `Premješten je ${count} zapis`, few: `Premještena su ${count} zapisa`, other: `Premješteno je ${count} zapisa` }),
      movedNote: (name, where) => `Sadrži ih datoteka „${name}” u mapi „${where}”. Aplikacija ju je ponovno pročitala i našla iste zapise.`,
    },
    find: {
      pick: 'Odaberi drugu datoteku',
      find: 'Pronađi datoteku',
    },
  },
  moveIntoKuna: {
    action: 'Premjesti u mapu Kuna',
    finish: 'Dovrši premještanje',
    title: 'Premjestiti ovu datoteku u mapu Kuna?',
    description: 'Ide ovamo, i to tek kad pritisnete Premjesti.',
    goes: 'Ide s njom',
    backups: (count) => ({ one: `${count} sigurnosna kopija ove datoteke`, few: `${count} sigurnosne kopije ove datoteke`, other: `${count} sigurnosnih kopija ove datoteke` }),
    kunaFiles: (count) => ({ one: `: ${count} datoteka koju je izradila Kuna`, few: `: ${count} datoteke koje je izradila Kuna`, other: `: ${count} datoteka koje je izradila Kuna` }),
    stays: 'Ostaje gdje jest',
    others: (count) => ({
      one: `${count} druga datoteka u tim mapama. Kuna ne može reći da ju je izradila, kao kod starije datoteke ili one koju je ondje stavila skripta ili osoba, pa ostaje i ondje i dalje služi onome što ju je izradilo.`,
      few: `${count} druge datoteke u tim mapama. Kuna ne može reći da ih je izradila, kao kod starijih datoteka ili onih koje je ondje stavila skripta ili osoba, pa ostaju i ondje i dalje služe onome što ih je izradilo.`,
      other: `${count} drugih datoteka u tim mapama. Kuna ne može reći da ih je izradila, kao kod starijih datoteka ili onih koje je ondje stavila skripta ili osoba, pa ostaju i ondje i dalje služe onome što ih je izradilo.`,
    }),
    stopsReading:
      ': Kuna prestaje čitati ovu mapu i sprema iste izvode iz vaše pošte u svoju mapu, pa se ništa ne gubi. Skripta koja ondje sprema ostaje netaknuta i nastavlja spremati. Datoteku koju ste ondje stavili ručno, a niste je uvezli, treba uvesti kroz Uvoz.',
    blockedTitle: 'Ove su mape imenovane iz mape ove datoteke, pa bi ih premještanje izgubilo. Najprije ih imenujte putem od mape Moj disk:',
    keepsWorking: 'Kuna i dalje pronalazi datoteku na vašim drugim uređajima, bez ikakve radnje. Sve izvan Kune što do nje dolazi po putu, poput Drivea za računala ili skripte, treba novi put.',
    partWay: 'Datoteka ide prva. Ako ono što slijedi stane na pola puta, sinkronizacija možda neće naći mapu koja još nije stigla, a gumb ostaje dok ga ponovno ne pritisnete.',
    cancel: 'Ne sada',
    confirm: 'Premjesti',
    failed: 'Premještanje nije završilo',
    moved: (name, where) => `Datoteka „${name}” premještena je u „${where}”`,
    unfinished: (reason) => `Datoteka je premještena, a ostalo je još u staroj mapi. Pritisnite Premjesti da to donesete. ${reason}`,
    left: (names) => `Ovo je ostalo gdje je bilo, jer u novoj mapi već postoji stavka istog imena: ${names}.`,
  },
}

export const words = language === 'hr' ? hr : en
