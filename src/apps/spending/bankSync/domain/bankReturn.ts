import type { LinkableBank } from '../../workbook/domain/spendingSettings'

/** What a browser keeps while a bank has the tab, and until the link is written down. `validUntil` holds what a spent code was traded for, so a failed write retries alone. */
export interface PendingLink {
  readonly bank: LinkableBank
  readonly state: string
  readonly code: string | null
  readonly validUntil: string | null
}

/** What coming back from a bank amounted to, until the Bank sync tab shows it. `elsewhere` is an answer this browser never asked for, as when a phone's bank app opens another browser. */
export type BankReturnNote = { readonly kind: 'code' } | { readonly kind: 'refused'; readonly reason: string } | { readonly kind: 'elsewhere' }

/** What a bank's return left in the address. Enable Banking puts these in the query string, by The OAuth 2.0 Authorization Framework. */
export type BankReturn = { readonly code: string; readonly state: string } | { readonly error: string; readonly description: string; readonly state: string }

const RETURN_FIELDS = ['code', 'state', 'error', 'error_description']

/** The bank's answer in a location search, or null for an address no bank came back to. */
export function bankReturnOf(search: string): BankReturn | null {
  const fields = new URLSearchParams(search)
  const state = fields.get('state')
  if (state === null) return null
  const code = fields.get('code')
  if (code !== null) return { code, state }
  const error = fields.get('error')
  return error === null ? null : { error, description: fields.get('error_description') ?? '', state }
}

/** The location search without the bank's answer, so a reload or a shared link does not carry a code. */
export function searchWithoutReturn(search: string): string {
  const fields = new URLSearchParams(search)
  RETURN_FIELDS.forEach((field) => fields.delete(field))
  const left = fields.toString()
  return left === '' ? '' : `?${left}`
}
