import { describe, expect, it, vi } from 'vitest'

import type { Rule } from '../src/shared/categorising/domain/rule'
import { assetsSetUp } from '../src/apps/assets/overview/presentation/assetsSetUp'
import { gettingSetUp } from '../src/apps/company/onboarding/presentation/gettingSetUp'
import { hr as croatianWords } from '../src/apps/company/onboarding/presentation/words'
import { payeesWaiting } from '../src/apps/company/rules/domain/ruleCoverage'
import { DEFAULT_SETTINGS } from '../src/apps/company/settings/domain/settings'
import type { Workbook } from '../src/apps/company/workbook/domain/workbook'
import { investmentsSetUp } from '../src/apps/investments/overview/presentation/investmentsSetUp'
import type { PortfolioFigures } from '../src/apps/investments/holdings/domain/portfolioFigures'
import { loansSetUp } from '../src/apps/loans/overview/presentation/loansSetUp'
import { spendingSetUp } from '../src/apps/spending/overview/presentation/spendingSetUp'
import { account, book, cashMovement } from './fixtures/investments'
import { exampleStudio } from './fixtures/exampleStudio'
import { ledger } from './fixtures/ledger'

function fakeRule(id: string, confidence: Rule['confidence']): Rule {
  return { id, order: 10, enabled: true, conditions: [], category: 'ai-services', confidence, note: '' }
}

const keysOf = (lines: readonly { readonly key: string }[]) => lines.map((line) => line.key)

describe('set-up lines', () => {
  it('ask Loans and Assets for a first record and then for nothing', () => {
    expect(keysOf(loansSetUp({ bankLoans: [], informalLoans: [] }))).toEqual(['first-loan'])
    expect(loansSetUp({ bankLoans: [{}], informalLoans: [] })).toEqual([])
    expect(keysOf(assetsSetUp({ assets: [] }))).toEqual(['first-asset'])
    expect(assetsSetUp({ assets: [{}] })).toEqual([])
  })

  it('ask Spending for one account, then its first entries', () => {
    expect(keysOf(spendingSetUp({ accounts: [], transactions: [] }))).toEqual(['first-account'])
    expect(keysOf(spendingSetUp({ accounts: [{}], transactions: [] }))).toEqual(['first-entries'])
    expect(spendingSetUp({ accounts: [{}], transactions: [{}] })).toEqual([])
  })

  it('ask Investments for first holdings, then the word that the history is complete, then a price', () => {
    expect(keysOf(investmentsSetUp(book({}), null, false))).toEqual(['first-holdings'])
    const started = book({ cashMovements: [cashMovement('deposit', account('one'), '2026-01-05', '100.00')] })
    expect(keysOf(investmentsSetUp(started, null, false))).toEqual(['history'])
    const unpriced = { holdings: [{ quantity: 1n, valuation: null }], cash: [] } as unknown as PortfolioFigures
    expect(keysOf(investmentsSetUp(started, unpriced, true))).toEqual(['prices'])
    expect(keysOf(investmentsSetUp(started, unpriced, false))).toEqual(['history', 'prices'])
  })

  it('count the holdings without a price', () => {
    const started = book({ cashMovements: [cashMovement('deposit', account('one'), '2026-01-05', '100.00')] })
    const unpriced = {
      holdings: [
        { quantity: 1n, valuation: null },
        { quantity: 2n, valuation: null },
        { quantity: 3n, valuation: null },
      ],
      cash: [],
    } as unknown as PortfolioFigures
    expect(investmentsSetUp(started, unpriced, true)[0]?.text).toContain('3 holdings have no price')
  })

  it('lead Investments with the deposit a buy without one leaves missing, which is what makes the value wrong', () => {
    const started = book({ cashMovements: [cashMovement('deposit', account('one'), '2026-01-05', '100.00')] })
    const below = { holdings: [], cash: [{ balance: -100000n }] } as unknown as PortfolioFigures
    expect(keysOf(investmentsSetUp(started, below, false))).toEqual(['cash-below-zero', 'history'])
  })

  it('leave out the link of a line only the home card shows', () => {
    const lines = [
      ...loansSetUp({ bankLoans: [], informalLoans: [] }),
      ...assetsSetUp({ assets: [] }),
      ...spendingSetUp({ accounts: [], transactions: [] }),
      ...investmentsSetUp(book({}), null, false),
    ]
    expect(lines.map((line) => line.link)).toEqual([undefined, undefined, undefined, undefined])
  })
})

describe('a set-up answer', () => {
  it('holds for the file it is about and no other, and after the page loads again', async () => {
    const stored = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => stored.set(key, value),
      removeItem: (key: string) => stored.delete(key),
    })
    vi.resetModules()
    const first = await import('../src/shared/app/setUpAnswer')
    first.keepSetUpAnswer('one-file', 'history-complete')
    vi.resetModules()
    const reloaded = await import('../src/shared/app/setUpAnswer')
    expect(reloaded.hasSetUpAnswer('one-file', 'history-complete')).toBe(true)
    expect(reloaded.hasSetUpAnswer('another-file', 'history-complete')).toBe(false)
    reloaded.forgetSetUpAnswer('one-file', 'history-complete')
    expect(reloaded.hasSetUpAnswer('one-file', 'history-complete')).toBe(false)
    vi.resetModules()
    const again = await import('../src/shared/app/setUpAnswer')
    expect(again.hasSetUpAnswer('one-file', 'history-complete')).toBe(false)
    vi.unstubAllGlobals()
  })
})

describe("the company's first rules", () => {
  const waitingRows = ledger([
    { date: '2026-10-01', amount: -10, category: 'unknown', counterparty: 'Alpha Hosting', flaggedBy: '' },
    { date: '2026-10-02', amount: -10, category: 'unknown', counterparty: 'Beta Telecom', flaggedBy: '' },
    { date: '2026-10-03', amount: -10, category: 'unknown', counterparty: 'Beta Telecom', flaggedBy: '' },
    { date: '2026-10-04', amount: -10, category: 'ai-services', counterparty: 'Filed Co', flaggedBy: 'rule' },
  ])

  it('groups the rows waiting by payee, the one with most rows first', () => {
    const waiting = waitingRows.filter((row) => row.counterparty !== 'Filed Co')
    expect(payeesWaiting(waiting, new Set()).map((payee) => [payee.name, payee.rows.length])).toEqual([
      ['Beta Telecom', 2],
      ['Alpha Hosting', 1],
    ])
  })

  const workbook = (rules: Workbook['rules']): Workbook =>
    exampleStudio({ transactions: waitingRows, rules, categories: [], clients: [], accounts: [], settings: { ...DEFAULT_SETTINGS, statementsSync: false } })

  it('asks to teach who appears most after a first import, counting only what a rule filed', () => {
    const [line] = gettingSetUp(workbook([]), true).filter((candidate) => candidate.key === 'first-rules')
    expect(line?.text).toBe('Kuna filed 1 of 4 rows. Teach it the names that appear most: Beta Telecom and Alpha Hosting.')
  })

  it('does not count a row a person filed as filed by Kuna', () => {
    const rows = ledger([
      { date: '2026-10-01', amount: -10, category: 'unknown', counterparty: 'Alpha Hosting', flaggedBy: '' },
      { date: '2026-10-02', amount: -10, category: 'ai-services', counterparty: 'By Hand', flaggedBy: 'ivan' },
    ])
    const line = gettingSetUp({ ...workbook([]), transactions: rows }, true)[0]
    expect(line?.text).toContain('Kuna filed 0 of 2 rows.')
  })

  it('says row for one row', () => {
    const rows = ledger([{ date: '2026-10-01', amount: -10, category: 'unknown', counterparty: 'Alpha Hosting', flaggedBy: '' }])
    expect(gettingSetUp({ ...workbook([]), transactions: rows }, true)[0]?.text).toContain('Kuna filed 0 of 1 row.')
  })

  it('writes the Croatian count with its own form', () => {
    expect(croatianWords.setUp.filed(0, 4)).toMatchObject({ few: 'Kuna je razvrstala 0 od 4 retka.' })
    expect(croatianWords.setUp.filed(0, 5)).toMatchObject({ other: 'Kuna je razvrstala 0 od 5 redaka.' })
    expect(croatianWords.setUp.filed(0, 21)).toMatchObject({ one: 'Kuna je razvrstala 0 od 21 retka.' })
  })

  it('leaves out the names when none is left, and a nameless group takes no place', () => {
    const nameless = ledger([
      { date: '2026-10-01', amount: -10, category: 'unknown', counterparty: '', flaggedBy: '' },
      { date: '2026-10-02', amount: -10, category: 'unknown', counterparty: '', flaggedBy: '' },
    ])
    expect(gettingSetUp({ ...workbook([]), transactions: nameless }, true)[0]?.text).toBe('Kuna filed 0 of 2 rows.')
    const crowded = ledger([
      ...Array.from({ length: 9 }, () => ({ date: '2026-10-01', amount: -10, category: 'unknown', counterparty: '', flaggedBy: '' })),
      ...['A Co', 'B Co', 'C Co', 'D Co', 'E Co'].map((counterparty) => ({ date: '2026-10-02', amount: -10, category: 'unknown', counterparty, flaggedBy: '' })),
    ])
    expect(gettingSetUp({ ...workbook([]), transactions: crowded }, true)[0]?.text).toContain('E Co')
  })

  it('does not name a payee whose row a rule cannot clear', () => {
    const reversal = ledger([{ date: '2026-10-01', amount: 10, category: 'ai-services', counterparty: 'Reversed Co', flaggedBy: 'rule', reviewReasons: ['reversal'] }])
    expect(keysOf(gettingSetUp({ ...workbook([]), transactions: reversal }, true))).toEqual([])
  })

  it('ignores rules that only ask for review or are switched off, and stops at five working rules', () => {
    const asking = Array.from({ length: 5 }, (_, place) => fakeRule(`state-${place}`, 'review'))
    expect(keysOf(gettingSetUp(workbook(asking), true))).toContain('first-rules')
    const off = Array.from({ length: 5 }, (_, place) => ({ ...fakeRule(`off-${place}`, 'rule'), enabled: false }))
    expect(keysOf(gettingSetUp(workbook(off), true))).toContain('first-rules')
    const taught = Array.from({ length: 5 }, (_, place) => fakeRule(`own-${place}`, 'rule'))
    expect(keysOf(gettingSetUp(workbook(taught), true))).not.toContain('first-rules')
  })
})
