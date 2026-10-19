import { isIban } from '../../workbook/domain/iban'
import { slugChangeRefusals } from '../../workbook/domain/slug'
import type { SlugUses } from '../../workbook/domain/slug'

interface ClientCells {
  readonly slug: string
  readonly name: string
  /** Normalised. */
  readonly iban: string
}

/** One clients row before and after a change. `before` is null for an added row, `after` for a deleted one. */
export interface ClientEdit {
  readonly sheetRow: number | null
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
 * The tab holds one row per IBAN, so a client paying from two accounts has two rows with one name.
 * A client the invoices or the plan name keeps its name while it has no other row. A new or changed
 * IBAN is a valid one on no other row and on no account of your own, since a payment from it is
 * matched to one client only and a transfer between your accounts must not read as a client's
 * payment. A second row of a client carries the client's name or none.
 */
export function clientChangeRefusals(
  edits: readonly ClientEdit[],
  untouched: readonly ({ readonly sheetRow: number } & ClientCells)[],
  checks: ClientChecks,
): string[] {
  const refusals = slugChangeRefusals(
    'client',
    { edits: edits.map((edit) => ({ sheetRow: edit.sheetRow, from: edit.before?.slug ?? null, to: edit.after?.slug ?? null })), untouched },
    checks.named,
    false,
  )
  for (const edit of edits) {
    const after = edit.after
    if (after === null) {
      continue
    }
    const others = [
      ...untouched,
      ...edits.flatMap((other) => (other === edit || other.after === null ? [] : [{ sheetRow: other.sheetRow, ...other.after }])),
    ]
    if (after.iban !== '' && after.iban !== edit.before?.iban) {
      const holder = others.find((row) => row.iban === after.iban)
      const account = checks.accountIbans.get(after.iban)
      if (!isIban(after.iban)) {
        refusals.push(`"${after.iban}" is not a valid IBAN.`)
      } else if (holder !== undefined) {
        refusals.push(`${after.iban} is already on the clients tab for ${holder.slug}${holder.sheetRow === null ? '' : `, on row ${holder.sheetRow}`}.`)
      } else if (account !== undefined) {
        refusals.push(`${after.iban} is the IBAN of your ${account} account, so a transfer between your own accounts would read as a payment from a client.`)
      }
    }
    const named = others.find((row) => row.slug === after.slug && row.name !== '')
    if (after.name !== '' && named !== undefined && named.name.toLowerCase() !== after.name.toLowerCase() && (edit.before === null || edit.before.name !== after.name || edit.before.slug !== after.slug)) {
      refusals.push(`${after.slug} is called "${named.name}"${named.sheetRow === null ? '' : ` on row ${named.sheetRow}`}. Give this row the same name, or leave it blank.`)
    }
  }
  return refusals
}
