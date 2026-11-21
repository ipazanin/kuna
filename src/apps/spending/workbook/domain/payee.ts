import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** What a payee is, which decides whether the chat sends their names under an alias. */
export const PAYEE_PARTIES = ['person', 'business'] as const

export type PayeeParty = (typeof PAYEE_PARTIES)[number]

/** The details you keep about a payee. Rows keep their own payee text and find their payee by its names and IBANs. */
export interface Payee {
  readonly id: RecordId
  /** The name the payee shows under first, then every other spelling of the same payee. */
  readonly names: readonly string[]
  /** IBANs you added, normalised, each on one payee only. The rows' own IBANs are not kept here. */
  readonly ibans: readonly string[]
  /** A person, whose names the chat sends under an alias, a business, or null when not said. */
  readonly party: PayeeParty | null
  /** An OIB or a foreign VAT number, blank for none. */
  readonly taxId: string
  readonly website: string
  readonly note: string
}
