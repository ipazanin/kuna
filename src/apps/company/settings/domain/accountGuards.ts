import { isIban } from '../../workbook/domain/iban'
import { slugChangeRefusals } from '../../workbook/domain/slug'
import type { SlugUses } from '../../workbook/domain/slug'

interface AccountCells {
  readonly slug: string
  /** Normalised, blank when the row gives none. */
  readonly iban: string
}

/** One accounts row before and after a change. `before` is null for an added row, `after` for a deleted one. */
export interface AccountEdit {
  readonly before: AccountCells | null
  readonly after: AccountCells | null
}

export interface AccountChecks {
  /** What names each account outside its tab, which is the ledger's rows. */
  readonly named: SlugUses
  /** Each IBAN on the clients tab, with the client it is for. */
  readonly clientIbans: ReadonlyMap<string, string>
}

/**
 * What the statements need of the accounts tab. An account the ledger names keeps its name and its
 * row. A new or changed IBAN is a valid one that no other account and no client has, since the
 * fetch names each statement file by its IBAN and the app files each statement by it, and the rules
 * would read a client's payment as a transfer between your own accounts. An account the ledger names
 * keeps an IBAN once it has one, since the app files no statement whose IBAN the tab does not name.
 */
export function accountChangeRefusals(edits: readonly AccountEdit[], untouched: readonly AccountCells[], checks: AccountChecks): string[] {
  const refusals = slugChangeRefusals('account', { edits: edits.map((edit) => ({ from: edit.before?.slug ?? null, to: edit.after?.slug ?? null })), untouched }, checks.named, true)
  const others = (edit: AccountEdit) => [...untouched, ...edits.flatMap((other) => (other === edit || other.after === null ? [] : [other.after]))]
  for (const edit of edits) {
    const after = edit.after
    if (after !== null && after.iban === '' && edit.before !== null && edit.before.iban !== '' && checks.named.has(edit.before.slug)) {
      refusals.push(`"${edit.before.slug}" keeps its IBAN, since ledger rows name the account and the app files no statement whose IBAN the accounts tab does not name.`)
    }
    if (after === null || after.iban === '' || after.iban === edit.before?.iban) {
      continue
    }
    const holder = others(edit).find((row) => row.iban === after.iban)
    const client = checks.clientIbans.get(after.iban)
    if (!isIban(after.iban)) {
      refusals.push(`"${after.iban}" is not a valid IBAN.`)
    } else if (holder !== undefined) {
      refusals.push(`${after.iban} is already the IBAN of the ${holder.slug} account, and the app files each statement by its IBAN, so one IBAN names one account.`)
    } else if (client !== undefined) {
      refusals.push(`${after.iban} is the IBAN of the client ${client}, so the rules would read its payments as transfers between your own accounts.`)
    }
  }
  return refusals
}
