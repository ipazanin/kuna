import { language } from '../../../../shared/text/language'
import { plural } from '../../../../shared/text/translation'
import type { EnglishForms, Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.

export const en = {
  /** Why a write to the settings tab is refused. */
  settings: {
    keyOnRows: (key: string, rows: number) => `The settings tab sets "${key}" on ${rows} rows. Keep one of them in an export and open that file again.`,
    wouldNotRead: (problems: string) => `The settings would not read cleanly: ${problems}.`,
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
    wouldNotRead: (problems) => `Postavke se ne bi ispravno čitale: ${problems}.`,
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
