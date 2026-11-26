import { capitalised } from '../../../../shared/text/capitalised'
import { language } from '../../../../shared/text/language'
import type { EnglishForms, Translation } from '../../../../shared/text/translation'
import { en as bookEn, hr as bookHr } from '../../workbook/domain/words'
import type { ClientRefusal } from '../domain/clientGuards'
import { en as invoicingEn, hr as invoicingHr, templateProblemsInWords } from '../domain/words'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// A Gmail draft is skica, as Gmail's Croatian names it. A file or folder name keeps its spelling, such as 2026-10.

export const en = {
  /** What each step of a run did, or why it failed. */
  steps: {
    alreadyFiled: (fileName: string) => `${fileName} is already in the folder, and the app does not overwrite an invoice. Use Re-export on the invoice to replace it.`,
    replaced: (fileName: string) => `Replaced ${fileName}.`,
    filedOverUnseen: (fileName: string) => `Filed ${fileName}. The app could not see an earlier PDF of this name, so if the old generator filed one, delete it in Drive.`,
    filed: (fileName: string) => `Filed ${fileName}.`,
    noDrive: 'There is no Google Drive to file in.',
    downloaded: (fileName: string) => `Saved ${fileName} through the browser.`,
    noGmail: 'Gmail access was not granted.',
    draftSaved: (recipient: string) => `Saved a draft to ${recipient}. Nothing was sent.`,
    deleteEarlierDraft: ' Delete the earlier draft in Gmail if it is still there.',
    registerChanged: 'Changed the invoice’s row on the invoices tab.',
    registerAdded: 'Added the invoice to the invoices tab.',
  },
  /** Why a change to the clients tab is refused. */
  clients: {
    onAnotherClient: (iban: string, client: string) => `${iban} is already on the clients tab for ${client}.`,
    ownAccount: (iban: string, account: string) => `${iban} is the IBAN of your ${account} account, so a transfer between your own accounts would read as a payment from a client.`,
    badLines: (client: string, problems: readonly string[]) => `The invoice lines of ${client} cannot be saved. ${capitalised(problems.join(', '))}.`,
  },
  clientRefusal: (refusal: ClientRefusal): string => {
    switch (refusal.kind) {
      case 'name':
        return refusal.reason
      case 'not-an-iban':
        return bookEn.notAnIban(refusal.iban)
      case 'on-another-client':
        return en.clients.onAnotherClient(refusal.iban, refusal.client)
      case 'own-account':
        return en.clients.ownAccount(refusal.iban, refusal.account)
      case 'bad-lines':
        return en.clients.badLines(refusal.client, templateProblemsInWords(refusal.problems, invoicingEn))
    }
  },
  /** What names a client outside its tab, as a refusal and the editor's lock say it. */
  uses: {
    invoices: (count: number): EnglishForms => ({ one: `${count} invoice`, other: `${count} invoices` }),
    billingPlanRows: (count: number): EnglishForms => ({ one: `${count} billing plan row`, other: `${count} billing plan rows` }),
    billingClient: 'the billing_client setting',
  },
}

export const hr: Translation<typeof en> = {
  steps: {
    alreadyFiled: (fileName) => `„${fileName}” već je u mapi, a aplikacija ne prepisuje račun. Za zamjenu upotrijebite Izvezi ponovno na tom računu.`,
    replaced: (fileName) => `Zamijenjen je „${fileName}”.`,
    filedOverUnseen: (fileName) => `Spremljen je „${fileName}”. Aplikacija nije vidjela raniji PDF tog naziva, pa ako ga je stari generator spremio, obrišite ga na Driveu.`,
    filed: (fileName) => `Spremljen je „${fileName}”.`,
    noDrive: 'Nema Google Drivea u koji bi se spremio.',
    downloaded: (fileName) => `„${fileName}” spremljen je putem preglednika.`,
    noGmail: 'Pristup Gmailu nije odobren.',
    draftSaved: (recipient) => `Spremljena je skica za ${recipient}. Ništa nije poslano.`,
    deleteEarlierDraft: ' Obrišite raniju skicu u Gmailu ako je još ondje.',
    registerChanged: 'Redak računa u popisu računa je promijenjen.',
    registerAdded: 'Račun je dodan u popis računa.',
  },
  clients: {
    onAnotherClient: (iban, client) => `${iban} već je u popisu klijenata, kod klijenta „${client}”.`,
    ownAccount: (iban, account) => `${iban} je IBAN vašeg računa u banci „${account}”, pa bi prijenos između vaših računa izgledao kao uplata klijenta.`,
    badLines: (client, problems) => `Stavke računa klijenta „${client}” ne mogu se spremiti. ${capitalised(problems.join(', '))}.`,
  },
  clientRefusal: (refusal) => {
    switch (refusal.kind) {
      case 'name':
        return refusal.reason
      case 'not-an-iban':
        return bookHr.notAnIban(refusal.iban)
      case 'on-another-client':
        return hr.clients.onAnotherClient(refusal.iban, refusal.client)
      case 'own-account':
        return hr.clients.ownAccount(refusal.iban, refusal.account)
      case 'bad-lines':
        return hr.clients.badLines(refusal.client, templateProblemsInWords(refusal.problems, invoicingHr))
    }
  },
  uses: {
    invoices: (count) => ({ one: `${count} račun`, few: `${count} računa`, other: `${count} računa` }),
    billingPlanRows: (count) => ({ one: `${count} stavka plana naplate`, few: `${count} stavke plana naplate`, other: `${count} stavki plana naplate` }),
    billingClient: 'postavka billing_client',
  },
}

export const words = language === 'hr' ? hr : en
