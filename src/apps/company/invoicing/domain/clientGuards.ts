import { isIban } from '../../../../shared/text/iban'
import { slugChangeRefusals } from '../../workbook/domain/slug'
import type { SlugUses } from '../../workbook/domain/slug'
import { templateOfText, templateProblems } from './invoiceTemplate'
import type { TemplateProblem } from './invoiceTemplate'

export interface ClientCells {
  readonly slug: string
  /** Normalised. */
  readonly ibans: readonly string[]
  /** The invoice lines as the record stores them. */
  readonly lines: string
}

/** One client before and after a change. `before` is null for an added client, `after` for a deleted one. */
export interface ClientEdit {
  readonly before: ClientCells | null
  readonly after: ClientCells | null
}

/**
 * Why a change to a client is refused, with the field it is about, so a dialog can show it under that field. A refused name
 * carries the sentence the slug rules give it.
 */
export type ClientRefusal =
  | { readonly field: 'client'; readonly kind: 'name'; readonly reason: string }
  | { readonly field: 'iban'; readonly kind: 'not-an-iban'; readonly iban: string }
  | { readonly field: 'iban'; readonly kind: 'on-another-client'; readonly iban: string; readonly client: string }
  | { readonly field: 'iban'; readonly kind: 'own-account'; readonly iban: string; readonly account: string }
  | { readonly field: 'invoice_lines'; readonly kind: 'bad-lines'; readonly client: string; readonly problems: readonly TemplateProblem[] }

export interface ClientChecks {
  /** What names each client outside its tab: invoices, plan rows and the billing_client setting. */
  readonly named: SlugUses
  /** Each IBAN on the accounts tab, with the account it is. */
  readonly accountIbans: ReadonlyMap<string, string>
}

/**
 * A client is on one row and keeps its name while invoices, plan rows or billing_client name it.
 * Each IBAN a change gives it is a valid one on no other client and on no account of your own, since
 * a payment from it is matched to one client only and a transfer between your accounts must not
 * read as a client's payment. Invoice lines a change gives it keep to the template's rules, while
 * lines it already holds are only doubted, so a client with lines the reader doubts can still be saved.
 */
export function clientChangeRefusals(edits: readonly ClientEdit[], untouched: readonly ClientCells[], checks: ClientChecks): ClientRefusal[] {
  const refusals: ClientRefusal[] = slugChangeRefusals(
    'client',
    { edits: edits.map((edit) => ({ from: edit.before?.slug ?? null, to: edit.after?.slug ?? null })), untouched },
    checks.named,
    true,
  ).map((reason) => ({ field: 'client', kind: 'name', reason }))
  for (const edit of edits) {
    const after = edit.after
    if (after === null) {
      continue
    }
    const others = [...untouched, ...edits.flatMap((other) => (other === edit || other.after === null ? [] : [other.after]))]
    for (const iban of after.ibans.filter((candidate) => !(edit.before?.ibans ?? []).includes(candidate))) {
      const holder = others.find((client) => client.ibans.includes(iban))
      const account = checks.accountIbans.get(iban)
      if (!isIban(iban)) {
        refusals.push({ field: 'iban', kind: 'not-an-iban', iban })
      } else if (holder !== undefined) {
        refusals.push({ field: 'iban', kind: 'on-another-client', iban, client: holder.slug })
      } else if (account !== undefined) {
        refusals.push({ field: 'iban', kind: 'own-account', iban, account })
      }
    }
    const problems = after.lines === edit.before?.lines ? [] : templateProblems(templateOfText(after.lines))
    if (problems.length > 0) {
      refusals.push({ field: 'invoice_lines', kind: 'bad-lines', client: after.slug, problems })
    }
  }
  return refusals
}
