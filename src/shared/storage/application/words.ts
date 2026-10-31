import { language } from '../../text/language'
import type { EnglishForms, Translation } from '../../text/translation'
import { withFullStop } from '../../text/withFullStop'
import type { RecordNoun } from '../domain/recordKind'
import { agreeing, en as domainEnglish, hr as domainCroatian } from '../domain/words'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// The books file is datoteka in Croatian, so that knjige keeps its legal sense.

const { named: enNamed, namedFirst: enFirst } = domainEnglish
const { named: hrNamed, namedFirst: hrFirst } = domainCroatian

export const en = {
  nothingWritten: (refusals: string) => `Nothing was written. ${refusals}`,
  noBooks: 'There is no workbook on screen to change.',
  busy: 'Another change or a sync is still running. Try again when it finishes.',
  savedElsewhere: 'Nothing was written. Another device kept saving the workbook during this change. Sync and try again.',
  notUndoable: 'This change cannot be undone from here.',
  undone: 'Undone',
  alreadyOnDrive: (fileName: string) => `Drive already holds ${fileName}, so the app does not make a second one. Open that file, or trash it in Drive first.`,
  refusals: {
    noLongerAsRead: (noun: RecordNoun, label: string | null) => `${enFirst(noun, label)} is no longer in the workbook as the app read it. Sync and look again.`,
    heldBy: (count: number, noun: RecordNoun, label: string | null): EnglishForms => ({
      one: `${count} records hold ${enNamed(noun, label)}, so the app cannot tell which one is meant. Change it in the workbook.`,
      other: `${count} records hold ${enNamed(noun, label)}, so the app cannot tell which one is meant. Change it in the workbook.`,
    }),
    nothingToFindBy: (noun: RecordNoun, label: string | null) => `${enFirst(noun, label)} has nothing to find it by, so the app cannot change it.`,
    gone: (noun: RecordNoun, label: string | null) => `${enFirst(noun, label)} is no longer in the workbook. Sync and look again.`,
    changedSince: (noun: RecordNoun, label: string | null) => `${enFirst(noun, label)} changed since the app read it. Sync and look again.`,
    newLeftOut: (noun: RecordNoun, label: string, reasons: string) => `The new ${noun.en.one} "${label}" would be left out: ${reasons}.`,
    leftOut: (noun: RecordNoun, label: string, reasons: string) => `The ${noun.en.one} "${label}" would be left out: ${reasons}.`,
    newProblem: (noun: RecordNoun, label: string, reasons: string) => `The new ${noun.en.one} "${label}" would read with a problem: ${reasons}.`,
    problem: (noun: RecordNoun, label: string, reasons: string) => `The ${noun.en.one} "${label}" would read with a problem: ${reasons}.`,
    leftOutThen: (noun: RecordNoun, label: string, reasons: string) => `The ${noun.en.one} "${label}" would then be left out: ${reasons}.`,
    problemThen: (noun: RecordNoun, label: string, reasons: string) => `The ${noun.en.one} "${label}" would then read with a problem: ${reasons}.`,
    twice: (noun: RecordNoun, label: string | null) => `${enFirst(noun, label)} is asked to change twice in one write.`,
    newWithoutKey: (noun: RecordNoun) => `The new ${noun.en.one} has nothing to find it by, such as its name or id.`,
    alreadyThere: (noun: RecordNoun, label: string | null) => `${enFirst(noun, label)} is in the workbook already, so it is not added again.`,
    fixedInFile: (noun: RecordNoun, label: string, changeable: string) =>
      `The app changes only ${changeable} of ${noun.en.article} ${noun.en.one}, so ${enNamed(noun, label)} is fixed in the workbook itself.`,
    otherFields: (noun: RecordNoun, label: string, changeable: string, others: string) => `Of ${enNamed(noun, label)} the app changes only ${changeable}, and this change also alters ${others}.`,
    stillHeld: (noun: RecordNoun, label: string | null) => `The write reached the workbook, but it still holds ${enNamed(noun, label)}. Check it in the workbook.`,
    notReadBack: (noun: RecordNoun, label: string | null) => `The write reached the workbook, but ${enNamed(noun, label)} does not read back as written. Check it in the workbook.`,
  },
}

export const hr: Translation<typeof en> = {
  nothingWritten: (refusals) => `Ništa nije upisano. ${refusals}`,
  noBooks: 'Na zaslonu nema datoteke koja bi se mogla promijeniti.',
  busy: 'Još traje druga promjena ili sinkronizacija. Pokušajte ponovno kad završi.',
  savedElsewhere: 'Ništa nije upisano. Drugi je uređaj tijekom ove promjene stalno spremao datoteku. Sinkronizirajte i pokušajte ponovno.',
  notUndoable: 'Ova se promjena ne može poništiti odavde.',
  undone: 'Poništeno',
  alreadyOnDrive: (fileName) => `Na Driveu već postoji „${fileName}”, pa aplikacija ne stvara drugu. Otvorite tu datoteku ili je najprije bacite u otpad na Driveu.`,
  refusals: {
    noLongerAsRead: (noun, label) => `${hrFirst(noun, label)} više nije u datoteci kakvu je aplikacija pročitala. Sinkronizirajte i pogledajte ponovno.`,
    heldBy: (count, noun, label) => ({
      one: `${hrFirst(noun, label)} nalazi se u ${count} zapisu, pa aplikacija ne zna na koji se misli. Promijenite to u datoteci.`,
      few: `${hrFirst(noun, label)} nalazi se u ${count} zapisa, pa aplikacija ne zna na koji se misli. Promijenite to u datoteci.`,
      other: `${hrFirst(noun, label)} nalazi se u ${count} zapisa, pa aplikacija ne zna na koji se misli. Promijenite to u datoteci.`,
    }),
    nothingToFindBy: (noun, label) =>
      `${hrFirst(noun, label)} nema ništa po čemu bi se ${agreeing(noun.hr, 'pronašao', 'pronašla', 'pronašlo')}, pa ${agreeing(noun.hr, 'ga', 'je', 'ga')} aplikacija ne može promijeniti.`,
    gone: (noun, label) => `${hrFirst(noun, label)} više nije u datoteci. Sinkronizirajte i pogledajte ponovno.`,
    changedSince: (noun, label) =>
      `${hrFirst(noun, label)} ${agreeing(noun.hr, 'promijenio', 'promijenila', 'promijenilo')} se otkad ${agreeing(noun.hr, 'ga', 'ju', 'ga')} je aplikacija pročitala. Sinkronizirajte i pogledajte ponovno.`,
    newLeftOut: (noun, label, reasons) =>
      `${agreeing(noun.hr, 'Novi', 'Nova', 'Novo')} ${noun.hr.one} „${label}” ${agreeing(noun.hr, 'bio bi izostavljen', 'bila bi izostavljena', 'bilo bi izostavljeno')}: ${withFullStop(reasons)}`,
    leftOut: (noun, label, reasons) => `${hrFirst(noun, label)} ${agreeing(noun.hr, 'bio bi izostavljen', 'bila bi izostavljena', 'bilo bi izostavljeno')}: ${withFullStop(reasons)}`,
    newProblem: (noun, label, reasons) => `Kod ${agreeing(noun.hr, 'novog', 'nove', 'novog')} ${noun.hr.of} „${label}” pojavio bi se problem: ${withFullStop(reasons)}`,
    problem: (noun, label, reasons) => `Kod ${noun.hr.of} „${label}” pojavio bi se problem: ${withFullStop(reasons)}`,
    leftOutThen: (noun, label, reasons) => `${hrFirst(noun, label)} tada bi ${agreeing(noun.hr, 'bio izostavljen', 'bila izostavljena', 'bilo izostavljeno')}: ${withFullStop(reasons)}`,
    problemThen: (noun, label, reasons) => `Kod ${noun.hr.of} „${label}” tada bi se pojavio problem: ${withFullStop(reasons)}`,
    twice: (noun, label) => `${hrFirst(noun, label)} ${agreeing(noun.hr, 'trebao', 'trebala', 'trebalo')} bi se promijeniti dvaput u jednom upisu.`,
    newWithoutKey: (noun) => `${agreeing(noun.hr, 'Novi', 'Nova', 'Novo')} ${noun.hr.one} nema ništa po čemu bi se ${agreeing(noun.hr, 'pronašao', 'pronašla', 'pronašlo')}, poput naziva ili id-a.`,
    alreadyThere: (noun, label) => `${hrFirst(noun, label)} već je u datoteci, pa se ne dodaje ponovno.`,
    fixedInFile: (noun, label, changeable) => `Kod ${noun.hr.of} aplikacija mijenja samo ${changeable}, pa se ${hrNamed(noun, label)} ispravlja u samoj datoteci.`,
    otherFields: (noun, label, changeable, others) => `Kod ${noun.hr.of} „${label}” aplikacija mijenja samo ${changeable}, a ova promjena mijenja i ${others}.`,
    stillHeld: (noun, label) => `Upis je stigao u datoteku, ali u njoj je još ${hrNamed(noun, label)}. Provjerite to u datoteci.`,
    notReadBack: (noun, label) => `Upis je stigao u datoteku, ali se ${hrNamed(noun, label)} ne čita onako kako je ${agreeing(noun.hr, 'upisan', 'upisana', 'upisano')}. Provjerite to u datoteci.`,
  },
}

export const words = language === 'hr' ? hr : en
