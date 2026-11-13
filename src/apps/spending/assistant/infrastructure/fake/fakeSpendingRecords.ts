import { findRecordsArgs } from '../../../../../shared/ai/infrastructure/fake/fakeChatReply'
import type { ModelRequest } from '../../../../../shared/ai/application/modelPort'

/** A record find_records gave, as far as Spending's fake chat reads it. */
export interface FoundRecord {
  readonly ref: string
  readonly name?: string
  readonly payee?: string
  readonly category?: string
  readonly currency?: string
  readonly closed?: boolean
  readonly kind?: string
  readonly bank?: string
  readonly rowsFrom?: string
  readonly counterpartyIban?: string
  /** The entry a part is of. */
  readonly transaction?: string
}

export function recordsIn(text: string): readonly FoundRecord[] {
  return (JSON.parse(text) as { readonly records: readonly FoundRecord[] }).records
}

export const findAccounts = findRecordsArgs('spending', 'account', { limit: 5 })

export const GROCERIES: readonly string[] = ['Groceries', 'Namirnice']
export const HOUSEHOLD: readonly string[] = ['Household goods', 'Kućanske potrepštine']

/** Every text the person's turns carried, context lines too, which name the files attached and the element tagged. */
export function personTexts(request: ModelRequest): readonly string[] {
  return request.turns.flatMap((turn) => (turn.role === 'user' ? turn.parts.flatMap((part) => (part.kind === 'text' ? [part.text] : [])) : []))
}
