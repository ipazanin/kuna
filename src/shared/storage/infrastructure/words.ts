import { capitalised } from '../../text/capitalised'
import { language } from '../../text/language'
import type { EnglishForms, Translation } from '../../text/translation'
import type { RecordNoun } from '../domain/recordKind'
import { agreeing } from '../domain/words'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// The books file is datoteka in Croatian, so that knjige keeps its legal sense.

export const en = {
  moveBlocked: (folders: string) => `These folders are named from this file's own folder and hold what Kuna may not move: ${folders}. Name them as a path from My Drive in Settings first.`,
  browserLost: 'This browser no longer holds the workbook. Open an Excel file or a backup to start again.',
  newerFile: 'This file was saved by a newer version of Kuna. Reload to update before you change anything.',
  notJson: 'The file is not a Kuna file: it does not read as JSON.',
  notKuna: 'The file is not a Kuna file.',
  notInShape: 'The file is not a Kuna file: its schema or its records are not in the shape the app writes.',
  notOnce: (noun: RecordNoun) => `Nothing was written. The ${noun.en.one} the change names is not in the file once, as the write read it. Sync and look again.`,
  otherApp: (title: string, app: string, fileName: string) => `${title} holds the books of another Kuna app, ${app}. Choose ${fileName}.`,
  notReadBack: (fileName: string) => `${fileName} on Drive does not read back with the records it was given, so the app does not use it. Trash the new file in Drive and try again.`,
  outsideEdit: 'The file changed outside the app during this save. Check the backups folder.',
  isBackup: (name: string, fileName: string) => `${name} is a backup, so the app does not keep the books in it. Pick ${fileName}, or open the backup with "Open a file" to look at it.`,
  severalFiles: (count: number, fileName: string): EnglishForms => ({
    one: `Drive holds ${count} files the app made as ${fileName}, so it cannot tell which one holds the books. Trash all but one in Drive.`,
    other: `Drive holds ${count} files the app made as ${fileName}, so it cannot tell which one holds the books. Trash all but one in Drive.`,
  }),
  revisions: 'Drive keeps 200 revisions of the file and refused this save, although the app deleted its oldest ones. Try again in a minute.',
  keptChanging: 'The file kept changing during this save. Sync to see what it holds now.',
  noFolder: 'The file has no folder the app can see, so it has nowhere to keep backups.',
}

export const hr: Translation<typeof en> = {
  moveBlocked: (folders) => `Ove su mape imenovane iz mape ove datoteke i sadrže ono što Kuna ne smije premjestiti: ${folders}. Najprije ih u postavkama imenujte putem od mape Moj disk.`,
  browserLost: 'Ovaj preglednik više nema datoteku. Otvorite Excel datoteku ili sigurnosnu kopiju da biste počeli ponovno.',
  newerFile: 'Ovu je datoteku spremila novija inačica Kune. Ponovno učitajte stranicu da se aplikacija ažurira prije bilo kakve promjene.',
  notJson: 'Datoteka nije Kunina datoteka: ne čita se kao JSON.',
  notKuna: 'Datoteka nije Kunina datoteka.',
  notInShape: 'Datoteka nije Kunina datoteka: njezina shema ili zapisi nisu u obliku koji aplikacija zapisuje.',
  notOnce: (noun) =>
    `Ništa nije upisano. ${capitalised(noun.hr.one)} na ${agreeing(noun.hr, 'koji', 'koju', 'koje')} se promjena odnosi nije točno jednom u datoteci kakvu je upis pročitao. Sinkronizirajte i pogledajte ponovno.`,
  otherApp: (title, app, fileName) => `„${title}” je datoteka druge Kunine aplikacije, ${app}. Odaberite „${fileName}”.`,
  notReadBack: (fileName) => `„${fileName}” na Driveu ne čita se sa zapisima koji su u nju upisani, pa je aplikacija ne koristi. Bacite novu datoteku u otpad na Driveu i pokušajte ponovno.`,
  outsideEdit: 'Datoteka se tijekom ovog spremanja promijenila izvan aplikacije. Provjerite mapu sa sigurnosnim kopijama.',
  isBackup: (name, fileName) => `„${name}” je sigurnosna kopija, pa je aplikacija ne koristi kao datoteku. Odaberite „${fileName}” ili otvorite kopiju kao zasebnu datoteku da biste je pregledali.`,
  severalFiles: (count, fileName) => ({
    one: `Na Driveu je ${count} datoteka koju je aplikacija izradila kao „${fileName}”, pa ne zna koja je prava. Na Driveu u otpad bacite sve osim jedne.`,
    few: `Na Driveu su ${count} datoteke koje je aplikacija izradila kao „${fileName}”, pa ne zna koja je prava. Na Driveu u otpad bacite sve osim jedne.`,
    other: `Na Driveu je ${count} datoteka koje je aplikacija izradila kao „${fileName}”, pa ne zna koja je prava. Na Driveu u otpad bacite sve osim jedne.`,
  }),
  revisions: 'Drive čuva 200 inačica datoteke i odbio je ovo spremanje, iako je aplikacija obrisala najstarije. Pokušajte ponovno za minutu.',
  keptChanging: 'Datoteka se stalno mijenjala tijekom ovog spremanja. Sinkronizirajte da vidite što sada sadrži.',
  noFolder: 'Datoteka nema mapu koju aplikacija vidi, pa nema gdje čuvati sigurnosne kopije.',
}

export const words = language === 'hr' ? hr : en
