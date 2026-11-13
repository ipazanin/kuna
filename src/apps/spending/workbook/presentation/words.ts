import { language } from '../../../../shared/text/language'
import type { CroatianForms, EnglishForms, Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// The Spending file is datoteka potrošnje in Croatian.

export const en = {
  exportFile: 'Export the Spending file',
  nothingToExport: 'There is no Spending file to export yet.',
  exported: 'Exported',
  exportFailed: 'Export failed',
  notOpened: 'The Spending file was not opened',
  alreadyOpen: 'Your Spending file is already open',
  alreadyOpenNote: (name: string) => `${name} on Google Drive is the file on screen, read again just now.`,
  opened: (name: string) => `Opened ${name}`,
  openedNote: (name: string) => `${name} on Google Drive is on screen now, and the app keeps a copy in this browser.`,
  /** The offer to update a file that stores entries the way older versions of Kuna did, in one write with Undo. */
  move: {
    title: 'This file stores entries the way older versions of Kuna did',
    description:
      "Updating it puts each entry's category, note and link on its parts. An entry not split gets one part. A split entry keeps its parts, and its note goes on its largest part. No figure changes. Undo works until you reload the page. To keep this version, export a copy first.",
    action: 'Update the file',
    moved: 'Updated how this file stores entries',
    notMoved: 'The file was not updated',
    blocked: (count: number): EnglishForms => ({
      one: `${count} entry or part needs fixing before this file can be updated`,
      other: `${count} entries or parts need fixing before this file can be updated`,
    }),
    leftOut: (count: number): EnglishForms => ({ one: `${count} entry or part is left out of your figures.`, other: `${count} entries or parts are left out of your figures.` }),
    splitLegs: (count: number): EnglishForms => ({ one: `${count} transfer between your accounts is split.`, other: `${count} transfers between your accounts are split.` }),
    blockedFix: 'Fix or delete what Overview lists as left out of your figures, and take the split off any transfer between your accounts. Then the update is offered again.',
    openOverview: 'Open Overview',
  },
}

export const hr: Translation<typeof en> = {
  exportFile: 'Izvezi datoteku potrošnje',
  nothingToExport: 'Još nema datoteke potrošnje za izvoz.',
  exported: 'Izvezeno',
  exportFailed: 'Izvoz nije uspio',
  notOpened: 'Datoteka potrošnje nije otvorena',
  alreadyOpen: 'Datoteka potrošnje već je otvorena',
  alreadyOpenNote: (name) => `Na zaslonu je „${name}” s Google Drivea, upravo ponovno pročitana.`,
  opened: (name) => `Otvorena je datoteka „${name}”`,
  openedNote: (name) => `„${name}” s Google Drivea sada je na zaslonu, a aplikacija čuva kopiju u ovom pregledniku.`,
  move: {
    title: 'Ova datoteka vodi unose kao starije verzije Kune',
    description:
      'Ažuriranjem kategorija, napomena i poveznica svakog unosa prelaze na njegove dijelove. Unos koji nije podijeljen dobiva jedan dio. Podijeljeni unos zadržava svoje dijelove, a njegova napomena ide na najveći dio. Nijedna se brojka ne mijenja. Poništi radi dok ponovno ne učitate stranicu. Ako želite sačuvati ovu verziju, prvo izvezite kopiju.',
    action: 'Ažuriraj datoteku',
    moved: 'Datoteka je ažurirana',
    notMoved: 'Datoteka nije ažurirana',
    blocked: (count): CroatianForms => ({
      one: `${count} unos ili dio treba ispraviti prije ažuriranja ove datoteke`,
      few: `${count} unosa ili dijela treba ispraviti prije ažuriranja ove datoteke`,
      other: `${count} unosa ili dijelova treba ispraviti prije ažuriranja ove datoteke`,
    }),
    leftOut: (count): CroatianForms => ({
      one: `${count} unos ili dio izostavljen je iz brojki.`,
      few: `${count} unosa ili dijela izostavljena su iz brojki.`,
      other: `${count} unosa ili dijelova izostavljeno je iz brojki.`,
    }),
    splitLegs: (count): CroatianForms => ({
      one: `${count} prijenos između vaših računa podijeljen je.`,
      few: `${count} prijenosa između vaših računa podijeljena su.`,
      other: `${count} prijenosa između vaših računa podijeljeno je.`,
    }),
    blockedFix: 'Ispravite ili obrišite ono što Pregled navodi kao izostavljeno iz brojki i uklonite podjelu s prijenosa između svojih računa. Tada će se ažuriranje ponovno ponuditi.',
    openOverview: 'Otvori pregled',
  },
}

export const words = language === 'hr' ? hr : en
