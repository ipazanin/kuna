import { describe, expect, it } from 'vitest'

import type { FieldDocs } from '../src/shared/privacy/domain/exposure'

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
})
