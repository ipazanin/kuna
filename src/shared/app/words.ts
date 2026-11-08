import { language } from '../text/language'
import type { Translation } from '../text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.

export const en = {
  allApps: 'All apps',
  homeLink: 'Kuna, all apps',
  loadingScreen: 'Loading the screen',
  privacy: 'Privacy',
  saving: 'Saving…',
  confirmedRowMoves: 'You confirmed this row. This change files it under another category.',
  proposalUndoEnded: 'Undo ended, as something else was changed since.',
  proposalChangedOnAccept: 'Nothing was written. The change would no longer be the one on this card. Ask the chat again.',
}

export const hr: Translation<typeof en> = {
  allApps: 'Sve aplikacije',
  homeLink: 'Kuna, sve aplikacije',
  loadingScreen: 'Učitavanje zaslona',
  privacy: 'Privatnost',
  saving: 'Spremanje…',
  confirmedRowMoves: 'Ovaj ste redak potvrdili. Ova ga promjena razvrstava u drugu kategoriju.',
  proposalUndoEnded: 'Poništavanje je isteklo jer je u međuvremenu promijenjeno nešto drugo.',
  proposalChangedOnAccept: 'Ništa nije upisano. Promjena više ne bi bila ona s ove kartice. Pitajte chat ponovno.',
}

/** The maker's name and contact read the same in both languages. */
export const companyFooter = { name: 'Domain Software Solutions d.o.o.', email: 'ivan.pazanin1996@gmail.com' }

export const words = language === 'hr' ? hr : en
