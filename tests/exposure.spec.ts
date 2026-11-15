import { describe, expect, it } from 'vitest'

import type { FieldDocs } from '../src/shared/privacy/domain/exposure'
import type { RecordId } from '../src/shared/storage/domain/recordId'

interface Payment {
  readonly id: string
  readonly payee: string
  readonly iban: string
  readonly note?: string
  readonly cents: number
}

describe('the exposure of each stored field', () => {
  it('needs a class for every field of a record, the optional ones too', () => {
    const docs: FieldDocs<Payment> = {
      id: { exposure: 'ref', to: 'payment', meaning: 'The payment.' },
      payee: { exposure: 'party', meaning: 'Who was paid.' },
      iban: { exposure: 'identifier', meaning: 'Their IBAN.' },
      note: { exposure: 'free-text', meaning: 'A note.' },
      cents: { exposure: 'plain', amount: 'account', meaning: 'The amount.' },
    }
    // @ts-expect-error The table leaves out `note`.
    const missing: FieldDocs<Payment> = { id: docs.id, payee: docs.payee, iban: docs.iban, cents: docs.cents }
    expect(Object.keys(docs)).toHaveLength(5)
    expect(missing).toBeDefined()
  })

  it('hands over a field that holds record ids as a list of refs, and only such a field', () => {
    interface Advance {
      readonly id: string
      readonly repaidBy?: readonly RecordId[]
    }
    const docs: FieldDocs<Advance> = {
      id: { exposure: 'ref', to: 'advance', meaning: 'The advance.' },
      repaidBy: { exposure: 'ref', to: 'item', list: true, meaning: 'The items that paid it back.' },
    }
    // @ts-expect-error A list of ids cannot stay home, since the chat follows it.
    const hidden: FieldDocs<Advance> = { id: docs.id, repaidBy: { exposure: 'never', meaning: 'The items that paid it back.' } }
    // @ts-expect-error A field of one id is not a list.
    const single: FieldDocs<Advance> = { id: { exposure: 'ref', to: 'advance', list: true, meaning: 'The advance.' }, repaidBy: docs.repaidBy }
    expect([hidden, single]).toHaveLength(2)
  })
})
