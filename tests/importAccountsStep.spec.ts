import { describe, expect, it } from 'vitest'

import { asksAboutAccount } from '../src/apps/investments/imports/domain/importChoices'
import type { AccountQuestion } from '../src/apps/investments/imports/domain/importDryRun'
import { parseCivilDate } from '../src/shared/calendar/civilDate'
import { account } from './fixtures/investments'

const KNOWN = account('ibkr', 'IBKR')

const question = (known: AccountQuestion['known']): AccountQuestion => ({
  account: 'U0000001',
  broker: 'IBKR',
  known,
  proposedName: 'IBKR U0000001',
  likely: null,
  rows: 3,
  firstDay: parseCivilDate('2026-11-02')!,
})

describe('the accounts step of an import', () => {
  it('asks about an account Kuna does not know', () => {
    expect(asksAboutAccount({ question: question(null), choice: { kind: 'new', name: 'IBKR U0000001' } })).toBe(true)
  })

  it('asks about a known account whose answer is a new account, so its rows never go to a new one unseen', () => {
    expect(asksAboutAccount({ question: question(KNOWN.id), choice: { kind: 'new', name: 'IBKR U0000001' } })).toBe(true)
  })

  it('asks nothing about a known account that its rows go to', () => {
    expect(asksAboutAccount({ question: question(KNOWN.id), choice: { kind: 'existing', account: KNOWN.id } })).toBe(false)
  })
})
