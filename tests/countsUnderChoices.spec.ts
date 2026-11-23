import { describe, expect, it, vi } from 'vitest'

import { countsUnderChoices } from '../src/apps/spending/payees/domain/countsUnderChoices'
import type { Payee } from '../src/apps/spending/workbook/domain/payee'
import { PAYEE_RECORDS } from '../src/apps/spending/workbook/domain/spendingKinds'
import { recordIdOf } from '../src/shared/storage/domain/recordId'

function payee(key: string, names: readonly string[], party: Payee['party']): Payee {
  return { id: recordIdOf(PAYEE_RECORDS, key), names, ibans: [], party, taxId: '', website: '', note: '' }
}

describe('what Counts under offers', () => {
  it('lists people first by name, then the other payees, then names entries carry that no payee holds, each once', () => {
    const payees = [payee('market', ['Corner market', 'KONZUM'], 'business'), payee('marko', ['Marko'], 'person'), payee('ana', ['Ana Horvat'], 'person'), payee('bistro', ['Harbour bistro'], null)]

    expect(countsUnderChoices({ payees, markedPeople: ['Petra'] }, ['Florist', 'konzum', 'ana horvat', 'Florist', ' '])).toEqual([
      'Ana Horvat',
      'Marko',
      'Petra',
      'Corner market',
      'Harbour bistro',
      'Florist',
    ])
  })

  it('sorts names by Croatian letters in Croatian, so Č, Ć, Š and Ž follow C, S and Z', async () => {
    vi.resetModules()
    vi.doMock('../src/shared/text/language', () => ({ language: 'hr', intlLocale: 'hr-HR' }))
    const { countsUnderChoices: croatianChoices } = await import('../src/apps/spending/payees/domain/countsUnderChoices')
    vi.doUnmock('../src/shared/text/language')
    const people = ['Žana', 'Čedo', 'Zora', 'Šime', 'Cvita', 'Sara', 'Ćiro'].map((name) => payee(name, [name], 'person'))

    expect(croatianChoices({ payees: people, markedPeople: [] }, [])).toEqual(['Cvita', 'Čedo', 'Ćiro', 'Sara', 'Šime', 'Zora', 'Žana'])
  })
})
