import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// A Gmail draft is skica, as Gmail's Croatian names it. A file or folder name keeps its spelling, such as 2026-10.

export const en = {
  /** The line Google's Picker shows above the folders beside a path folder. */
  pickerTitle: (segment: string) => `Pick the existing ${segment} folder. Pick every folder you see beside it too, so the app does not ask again.`,
  /** What each step of a run did, or why it failed. */
  steps: {
    alreadyFiled: (fileName: string) => `${fileName} is already in the folder, and the app does not overwrite an invoice. Use Re-export on the invoice to replace it.`,
    replaced: (fileName: string) => `Replaced ${fileName}.`,
    filedOverUnseen: (fileName: string) => `Filed ${fileName}. The app could not see an earlier PDF of this name, so if the old generator filed one, delete it in Drive.`,
    filed: (fileName: string) => `Filed ${fileName}.`,
    noDrive: 'There is no Google Drive to file in.',
    downloaded: (fileName: string) => `Saved ${fileName} through the browser.`,
    noGmail: 'Gmail access was not granted.',
    draftSaved: (to: string) => `Saved a draft to ${to}. Nothing was sent.`,
    deleteEarlierDraft: ' Delete the earlier draft in Gmail if it is still there.',
    registerChanged: 'Changed the invoice’s row on the invoices tab.',
    registerAdded: 'Added the invoice to the invoices tab.',
  },
}

export const hr: Translation<typeof en> = {
  pickerTitle: (segment) => `Odaberite postojeću mapu ${segment}. Odaberite i sve mape koje vidite pokraj nje, da aplikacija ne pita ponovno.`,
  steps: {
    alreadyFiled: (fileName) => `${fileName} već je u mapi, a aplikacija ne prepisuje račun. Za zamjenu upotrijebite Izvezi ponovno na tom računu.`,
    replaced: (fileName) => `Zamijenjen je ${fileName}.`,
    filedOverUnseen: (fileName) => `Spremljen je ${fileName}. Aplikacija nije vidjela raniji PDF tog naziva, pa ako ga je stari generator spremio, obrišite ga na Driveu.`,
    filed: (fileName) => `Spremljen je ${fileName}.`,
    noDrive: 'Nema Google Drivea u koji bi se spremio.',
    downloaded: (fileName) => `${fileName} spremljen je putem preglednika.`,
    noGmail: 'Pristup Gmailu nije odobren.',
    draftSaved: (to) => `Spremljena je skica za ${to}. Ništa nije poslano.`,
    deleteEarlierDraft: ' Obrišite raniju skicu u Gmailu ako je još ondje.',
    registerChanged: 'Redak računa u popisu računa je promijenjen.',
    registerAdded: 'Račun je dodan u popis računa.',
  },
}

export const words = language === 'hr' ? hr : en
