import { isIban } from '../../workbook/domain/iban'
import { slugChangeRefusals } from '../../workbook/domain/slug'
import type { SlugUses } from '../../workbook/domain/slug'
import { words } from './words'

interface ClientCells {
  readonly slug: string
  /** Normalised. */
  readonly ibans: readonly string[]
}

/** One client before and after a change. `before` is null for an added client, `after` for a deleted one. */
export interface ClientEdit {
  readonly before: ClientCells | null
  readonly after: ClientCells | null
}

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
 * read as a client's payment.
 */
export function clientChangeRefusals(edits: readonly ClientEdit[], untouched: readonly ClientCells[], checks: ClientChecks): string[] {
  const refusals = slugChangeRefusals('client', { edits: edits.map((edit) => ({ from: edit.before?.slug ?? null, to: edit.after?.slug ?? null })), untouched }, checks.named, true)
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
        refusals.push(words.notAnIban(iban))
      } else if (holder !== undefined) {
        refusals.push(words.clients.onAnotherClient(iban, holder.slug))
      } else if (account !== undefined) {
        refusals.push(words.clients.ownAccount(iban, account))
      }
    }
  }
  return refusals
}
