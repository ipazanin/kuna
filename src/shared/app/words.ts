import { language } from '../text/language'
import type { Translation } from '../text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.

export const en = {
  allApps: 'All apps',
  homeLink: 'Kuna, all apps',
  loadingScreen: 'Loading the screen',
  privacy: 'Privacy',
  terms: 'Terms',
  saving: 'Saving…',
  confirmedRowMoves: 'You confirmed this row. This change files it under another category.',
  proposalUndoEnded: 'Undo ended, as something else was changed since.',
  proposalChangedOnAccept: 'The change would no longer be the one on this card. Ask the chat again.',
  fileMade: (app: string) => `Kuna makes the ${app} file in this browser.`,
  fileRemovedAgain: 'The chat can remove it again while this page is open. Later, Delete on the app’s Settings removes it.',
  fileRemoved: (app: string) => `Kuna deletes the ${app} file from this browser, with all it holds.`,
  fileNotMade: 'Kuna could not make the file.',
  fileNotRemoved: 'Kuna could not remove the file, so it stays.',
  fileThereAlready: (app: string) => `${app} has a file on this device already, so nothing was made.`,
}

export const hr: Translation<typeof en> = {
  allApps: 'Sve aplikacije',
  homeLink: 'Kuna, sve aplikacije',
  loadingScreen: 'Učitavanje zaslona',
  privacy: 'Privatnost',
  terms: 'Uvjeti',
  saving: 'Spremanje…',
  confirmedRowMoves: 'Ovaj ste redak potvrdili. Ova ga promjena razvrstava u drugu kategoriju.',
  proposalUndoEnded: 'Poništavanje je isteklo jer je u međuvremenu promijenjeno nešto drugo.',
  proposalChangedOnAccept: 'Promjena više ne bi bila ona s ove kartice. Pitajte ponovno u razgovoru.',
  fileMade: (app) => `Kuna izrađuje datoteku aplikacije ${app} u ovom pregledniku.`,
  fileRemovedAgain: 'Razgovor je može ponovno ukloniti dok je ova stranica otvorena. Kasnije je uklanja Obriši u postavkama aplikacije.',
  fileRemoved: (app) => `Kuna briše datoteku aplikacije ${app} iz ovog preglednika, sa svime što drži.`,
  fileNotMade: 'Kuna nije mogla izraditi datoteku.',
  fileNotRemoved: 'Kuna nije mogla ukloniti datoteku, pa ostaje.',
  fileThereAlready: (app) => `${app} već ima datoteku na ovom uređaju, pa ništa nije izrađeno.`,
}

/** The maker's name and contact read the same in both languages. */
export const companyFooter = { name: 'Domain Software Solutions d.o.o.', email: 'ivan.pazanin1996@gmail.com' }

export const words = language === 'hr' ? hr : en
