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
  readonly sheetRow: number | null
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
 * What the Apps Script needs of the accounts tab. An account the ledger names keeps its name and its
 * row. A new or changed IBAN is a valid one that no other account and no client has, since the
 * ingest files each statement by its IBAN and stops on one named twice, and the rules would read a
 * client's payment as a transfer between your own accounts. An account the ledger names keeps an
 * IBAN once it has one, since the ingest refuses a statement whose IBAN the tab does not name. The
 * tab keeps at least one IBAN once it has one, or the morning run stops.
 */
export function accountChangeRefusals(
  edits: readonly AccountEdit[],
  untouched: readonly { readonly sheetRow: number; readonly slug: string; readonly iban: string }[],
  checks: AccountChecks,
): string[] {
  const refusals = slugChangeRefusals(
    'account',
    { edits: edits.map((edit) => ({ sheetRow: edit.sheetRow, from: edit.before?.slug ?? null, to: edit.after?.slug ?? null })), untouched },
    checks.named,
    true,
  )
  const others = (edit: AccountEdit) => [
    ...untouched,
    ...edits.flatMap((other) => (other === edit || other.after === null ? [] : [{ sheetRow: other.sheetRow, slug: other.after.slug, iban: other.after.iban }])),
  ]
  for (const edit of edits) {
    const after = edit.after
    if (after !== null && after.iban === '' && edit.before !== null && edit.before.iban !== '' && checks.named.has(edit.before.slug)) {
      refusals.push(`"${edit.before.slug}" keeps its IBAN, since ledger rows name the account and the Apps Script refuses a statement whose IBAN the accounts tab does not name.`)
    }
    if (after === null || after.iban === '' || after.iban === edit.before?.iban) {
      continue
    }
    const holder = others(edit).find((row) => row.iban === after.iban)
    const client = checks.clientIbans.get(after.iban)
    if (!isIban(after.iban)) {
      refusals.push(`"${after.iban}" is not a valid IBAN.`)
    } else if (holder !== undefined) {
      refusals.push(`${after.iban} is already the IBAN of the ${holder.slug} account${holder.sheetRow === null ? '' : `, on row ${holder.sheetRow}`}, and the Apps Script stops on an IBAN the tab names twice.`)
    } else if (client !== undefined) {
      refusals.push(`${after.iban} is the IBAN of the client ${client}, so the rules would read its payments as transfers between your own accounts.`)
    }
  }
  const hadIban = [...untouched, ...edits.flatMap((edit) => (edit.before === null ? [] : [edit.before]))].some((row) => row.iban !== '')
  const keepsIban = [...untouched, ...edits.flatMap((edit) => (edit.after === null ? [] : [edit.after]))].some((row) => row.iban !== '')
  if (hadIban && !keepsIban) {
    refusals.push('The accounts tab would name no IBAN, and the Apps Script stops its morning run without one. Keep at least one account with its IBAN.')
  }
  return refusals
}
