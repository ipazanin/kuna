import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { language } from '../../../../shared/text/language'
import { withFullStop } from '../../../../shared/text/withFullStop'
import { plural } from '../../../../shared/text/translation'
import type { EnglishForms, Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.

export const en = {
  /** Why a write to the settings tab is refused. */
  settings: {
    keyOnRows: (key: string, rows: number) => `The settings tab sets "${key}" on ${rows} rows. Keep one of them in an export and open that file again.`,
  },
  /** Why an account's periods cannot be written, short enough for the field under them. */
  sources: {
    filed: (firstOpen: CivilDate) => `Those days' VAT return is filed. Give another source days from ${dayLabel(firstOpen)} on.`,
    rowsOfAnotherSource: (count: number) =>
      `${count === 1 ? 'One row' : `${count} rows`} of the old source would stay on days the new source fills. Save from Settings, Accounts, which takes them out.`,
    undoAfterHandover: 'The new source has brought rows on those days since, so Undo would keep both. Move the day back in Settings, Accounts instead.',
  },
  /** What names a category, an account or a client outside its tab, as a refusal and the editor's lock say it. */
  uses: {
    ledgerRows: (count: number): EnglishForms => ({ one: `${count} ledger row`, other: `${count} ledger rows` }),
    splitParts: (count: number): EnglishForms => ({ one: `${count} split part`, other: `${count} split parts` }),
    invoices: (count: number): EnglishForms => ({ one: `${count} invoice`, other: `${count} invoices` }),
    billingPlanRows: (count: number): EnglishForms => ({ one: `${count} billing plan row`, other: `${count} billing plan rows` }),
    billingClient: 'the billing_client setting',
    rule: (id: string) => `the rule ${id}`,
    rules: (ids: string) => `the rules ${ids}`,
    ruleWithoutId: 'one without an id',
  },
}

export const hr: Translation<typeof en> = {
  settings: {
    keyOnRows: (key, rows) =>
      `Postavka „${key}” postavljena je u ${rows} ${plural({ one: 'retku', few: 'retka', other: 'redaka' }, rows)} kartice postavki. U izvozu zadržite jedan od njih i ponovno otvorite tu datoteku.`,
  },
  sources: {
    filed: (firstOpen) => `Prijava PDV-a za te dane je predana. ${withFullStop(`Drugom izvoru dajte dane od ${dayLabel(firstOpen)}`)}`,
    rowsOfAnotherSource: (count) =>
      `${plural({ one: `${count} stavka starog izvora ostala bi`, few: `${count} stavke starog izvora ostale bi`, other: `${count} stavki starog izvora ostalo bi` }, count)} na danima koje puni novi izvor. Spremite u Postavkama, Računi, koje ih uklanjaju.`,
    undoAfterHandover: 'Novi izvor od tada je donio stavke za te dane, pa bi poništavanje zadržalo obje. Umjesto toga vratite dan u Postavkama, Računi.',
  },
  uses: {
    ledgerRows: (count) => ({ one: `${count} stavka evidencije`, few: `${count} stavke evidencije`, other: `${count} stavki evidencije` }),
    splitParts: (count) => ({ one: `${count} dio podjele`, few: `${count} dijela podjele`, other: `${count} dijelova podjele` }),
    invoices: (count) => ({ one: `${count} račun`, few: `${count} računa`, other: `${count} računa` }),
    billingPlanRows: (count) => ({ one: `${count} stavka plana naplate`, few: `${count} stavke plana naplate`, other: `${count} stavki plana naplate` }),
    billingClient: 'postavka billing_client',
    rule: (id) => `pravilo „${id}”`,
    rules: (ids) => `pravila ${ids}`,
    ruleWithoutId: 'jedno bez oznake',
  },
}

export const words = language === 'hr' ? hr : en
