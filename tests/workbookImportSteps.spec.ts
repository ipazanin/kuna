import { describe, expect, it } from 'vitest'

import type { WorkbookRows } from '../src/apps/investments/imports/domain/importDryRun'
import { readPortfolioWorkbook } from '../src/apps/investments/imports/domain/portfolioWorkbook'
import { sampleWorkbookGrid } from '../src/apps/investments/imports/infrastructure/fake/sampleWorkbook'
import { dryRunGroups, dryRunSummary } from '../src/apps/investments/imports/presentation/dryRunLines'
import { NO_CHOICES, settledImport } from '../src/apps/investments/imports/presentation/importChoices'
import type { ImportChoices, NewIds, SettledImport } from '../src/apps/investments/imports/presentation/importChoices'
import { words } from '../src/apps/investments/imports/presentation/words'
import { instrumentTexts } from '../src/apps/investments/holdings/presentation/instrumentForm'
import { transactionCount } from '../src/apps/investments/transactions/domain/listedTransactions'
import type { InvestmentBook } from '../src/apps/investments/workbook/domain/investmentBook'
import { decimalText } from '../src/shared/money/decimal'
import { USD, account, book, instrument, rateBookOf } from './fixtures/investments'

/** The fake build's made-up workbook, read as the import reads it. */
function sampleRows(): WorkbookRows {
  const reading = readPortfolioWorkbook([{ name: 'Transactions', grid: sampleWorkbookGrid() }])
  if (reading.kind !== 'read') {
    throw new Error(`The sample workbook was refused: ${reading.refusal.kind}.`)
  }
  return reading
}

const RATES = rateBookOf(new Map([[USD, [['2024-12-31', '1.04']]]]))

/** Ids made from their key, so a spec can name the account or holding a default makes. */
const KEYED_IDS: NewIds = (key) => `new-${key}`

function settle(choices: ImportChoices = NO_CHOICES, kept: InvestmentBook = book({})): SettledImport {
  return settledImport(sampleRows(), kept, RATES, choices, KEYED_IDS)
}

function outcomeAt(settled: SettledImport, fileRow: number): string {
  const entry = settled.dryRun.entries.find((candidate) => candidate.rows[0].fileRow === fileRow)
  if (entry === undefined) throw new Error(`No entry starts at row ${fileRow}.`)
  return entry.outcome.kind === 'waiting' ? `waiting: ${entry.outcome.reason.kind}` : entry.outcome.kind
}

/** The spin-off's received from ABC, picked as its parent. */
function withParent(settled: SettledImport, choices: ImportChoices = NO_CHOICES): ImportChoices {
  const abc = settled.parents.find((candidate) => candidate.symbol === 'ABC')!
  return { ...choices, spinOffs: { [settled.spinOffs[0]!.question.key]: { parent: abc.id, costShare: null } } }
}

describe('the steps with no choice made', () => {
  it('names every account as proposed and adds every holding from its guess', () => {
    const settled = settle()
    expect(settled.accounts.map((step) => [step.question.account, step.question.rows, step.choice, step.problem])).toEqual([
      ['U0000001', 17, { kind: 'new', name: 'IBKR' }, null],
      ['U0000002', 4, { kind: 'new', name: 'IBKR 2' }, null],
      ['RVL-1', 5, { kind: 'new', name: 'Revolut' }, null],
    ])
    expect(settled.instruments.map((step) => [step.question.identity, step.choice.kind === 'new' && step.choice.texts.sourceSymbol, step.errors?.name])).toEqual([
      ['US0000000001', 'ABC', null],
      ['NEWCO', 'NEWCO', null],
      ['IE0000000002', 'XYZ.DEX', null],
      ['DEF', 'DEF', null],
    ])
  })

  it('settles the split at the ratio its shares make once its holding is answered, and holds the spin-off for its parent', () => {
    const settled = settle()
    // 6 + 1 held the day before, and 7 added: 2 for 1.
    expect(settled.splits.map((step) => [decimalText(step.question.held!), step.texts, step.problem])).toEqual([['7', { newUnits: '2', oldUnits: '1' }, null]])
    expect([outcomeAt(settled, 15), outcomeAt(settled, 16)]).toEqual(['new', 'waiting: spin-off'])
    expect(settled.spinOffs.map((step) => [step.parent, step.costShare, step.problems.parent])).toEqual([[null, '', words.questions.parentMissing]])
  })

  it('proposes the spin-off share once its parent is picked, from the worth received over the cost the parent held, shown to two places', () => {
    const first = settle()
    const settled = settle(withParent(first))
    // 2 NEWCO at 12.00 = 24.00 over the 901.00 + 153.00 the ABC lots cost in dollars.
    expect(decimalText(settled.spinOffs[0]!.proposed!)).toBe('0.022770398482')
    expect(settled.spinOffs[0]!.costShare).toBe('2.28')
    expect(outcomeAt(settled, 16)).toBe('new')
    expect(settled.dryRun.added.spinOffs.map((spinOff) => decimalText(spinOff.costShare))).toEqual(['0.022770398482'])
  })

  it('keeps the ids of new accounts and holdings from one pass to the next', () => {
    expect(settle().dryRun.added.accounts.map((added) => added.id)).toEqual(settle().dryRun.added.accounts.map((added) => added.id))
    expect(settle().dryRun.added.accounts[0]!.id).toBe('investment-account:new-account:U0000001')
  })
})

describe('the steps with choices', () => {
  it('matches an account and a holding Kuna has, offering the holding with the same ISIN first', () => {
    const main = account('main', 'Broker main')
    const abc = instrument('abc', { name: 'ABC Corp', isin: 'US0000000001', currency: USD })
    const kept = book({ accounts: [main], instruments: [abc] })
    const settled = settle({ ...NO_CHOICES, accounts: { U0000001: { kind: 'existing', account: main.id } } }, kept)
    expect(settled.accounts[0]!.choice).toEqual({ kind: 'existing', account: main.id })
    expect(settled.instruments[0]!.choice).toEqual({ kind: 'existing', instrument: abc.id })
    expect(settled.dryRun.added.accounts.map((added) => added.name)).toEqual(['IBKR 2', 'Revolut'])
    expect(settled.dryRun.added.instruments.map((added) => added.symbol)).toEqual(['XYZ.DE', 'DEF'])
  })

  it('proposes each new account under its broker, numbered past the names Kuna has', () => {
    const settled = settle(NO_CHOICES, book({ accounts: [account('old', 'IBKR')] }))
    expect(settled.accounts.map((step) => step.question.proposedName)).toEqual(['IBKR 2', 'IBKR 3', 'Revolut'])
  })

  it('offers a holding Kuna has by its symbol only where one of the two has no ISIN', () => {
    const otherAbc = instrument('other-abc', { name: 'Other ABC', isin: 'IE0000000009', symbol: 'ABC', currency: USD })
    const def = instrument('def', { name: 'DEF Inc', isin: 'US0000000003', symbol: 'DEF', currency: USD })
    const settled = settle(NO_CHOICES, book({ instruments: [otherAbc, def] }))
    const stepOf = (identity: string) => settled.instruments.find((step) => step.question.identity === identity)!
    expect([stepOf('US0000000001').question.offer, stepOf('US0000000001').choice.kind]).toEqual([null, 'new'])
    expect(stepOf('DEF').choice).toEqual({ kind: 'existing', instrument: def.id })
  })

  it('holds the rows of an account named blank, and refuses two new holdings with one ISIN', () => {
    const settled = settle({
      ...NO_CHOICES,
      accounts: { 'RVL-1': { kind: 'new', name: '  ' } },
      instruments: { DEF: { kind: 'new', texts: { ...instrumentTexts(null), name: 'DEF Inc', symbol: 'DEF', currency: 'USD', isin: 'IE0000000002' } } },
    })
    expect(settled.accounts[2]!.problem).toBe(words.accounts.nameMissing)
    expect(outcomeAt(settled, 24)).toBe('waiting: account')
    expect([settled.instruments[2]!.errors?.isin, settled.instruments[3]!.errors?.isin]).toEqual([
      'DEF Inc has this ISIN already',
      `${instrumentTexts(settled.instruments[2]!.question.proposal).name} has this ISIN already`,
    ])
    expect(outcomeAt(settled, 22)).toBe('waiting: instrument')
  })

  it('takes a typed split ratio, and says what is wrong with one it cannot read', () => {
    const first = settle()
    const split = first.splits[0]!.question.key
    const typed = settle({ ...NO_CHOICES, splits: { [split]: { newUnits: '3', oldUnits: '1' } } })
    expect(typed.dryRun.added.splits.map((added) => [added.newUnits, added.oldUnits])).toEqual([[3, 1]])
    const wrong = settle({ ...NO_CHOICES, splits: { [split]: { newUnits: '2.5', oldUnits: '1' } } })
    expect(wrong.splits[0]!.problem).toBe(words.questions.ratioProblem)
    expect(outcomeAt(wrong, 15)).toBe('waiting: split-ratio')
  })

  it('takes a typed spin-off share in percent and refuses one above 100', () => {
    const first = settle()
    const parented = withParent(first)
    const key = first.spinOffs[0]!.question.key
    const typed = settle({ ...parented, spinOffs: { [key]: { ...parented.spinOffs[key]!, costShare: '2.5' } } })
    expect(typed.dryRun.added.spinOffs.map((spinOff) => decimalText(spinOff.costShare))).toEqual(['0.025'])
    const over = settle({ ...parented, spinOffs: { [key]: { ...parented.spinOffs[key]!, costShare: '120' } } })
    expect(over.spinOffs[0]!.problems.costShare).toBe(words.questions.costShareProblem)
    expect(outcomeAt(over, 16)).toBe('waiting: spin-off')
  })
})

describe('the dry run on screen', () => {
  it('says what Import adds, with the new accounts and holdings', () => {
    const settled = settle(withParent(settle()))
    const { added } = settled.dryRun
    expect(dryRunSummary(added, transactionCount(added), 0)).toBe('Import adds 21 records, with 3 accounts and 4 holdings new.')
    expect(dryRunSummary(book({}), 0, 1)).toBe('Import adds nothing. It deletes 1 record gone from the workbook.')
  })

  it('lists the new records as transactions read, the rows that wait or are skipped with why, and the cells and rows worth a look', () => {
    const settled = settle(withParent(settle()))
    const groups = dryRunGroups(settled.dryRun, book({}), RATES, (row) => `${row.broker} ${row.account}`)
    expect(groups.fresh).toHaveLength(21)
    expect(groups.fresh.at(-1)).toMatchObject({ title: 'Fee · IBKR', caption: '3 Feb 2026 · IBKR · row 29 · activity-2025.csv', euros: -42, note: 'Debit interest' })
    expect(groups.reversals).toEqual(['Row 29: Debit interest. Imports as fee'])
    expect(groups.fresh[0]).toMatchObject({ title: 'Deposit · IBKR', caption: '2 Jan 2025 · IBKR · row 3 · activity-2025.csv', euros: 500_000 })
    expect(groups.fresh.find((line) => line.title === 'Dividend · ABC')?.caption).toContain('rows 8, 9')
    expect(groups.waiting.map((line) => [line.title, line.note])).toEqual([['Tax withheld · ABC', words.waits['no-partner']]])
    expect(groups.skipped.map((line) => [line.title, line.note])).toEqual([['Row 7', 'Its type CORPORATE ACTION is not one Kuna reads']])
    expect(groups.commissions).toEqual(['Row 6: Commission $0.35, fees from the net cash $1.00, which import'])
    expect(groups.rounded).toEqual(['Row 13, Net cash: −€3.005 imports as −€3.01'])
    expect(groups.inKuna).toEqual([])
    expect(groups.gone).toEqual([])
  })

  it('shows a record gone from the workbook beside the row that replaced it', () => {
    const settled = settle(withParent(settle()))
    const kept = settled.dryRun.planned
    const edited = sampleWorkbookGrid().map((row, index) => (index === 2 ? row.map((cell) => (cell === 5000 ? 5200 : cell)) : row))
    const reading = readPortfolioWorkbook([{ name: 'Transactions', grid: edited }])
    if (reading.kind !== 'read') throw new Error('refused')
    const again = settledImport(reading, kept, RATES, NO_CHOICES, KEYED_IDS)
    const groups = dryRunGroups(again.dryRun, kept, RATES, (row) => row.account)
    expect(groups.fresh.map((line) => line.title)).toEqual(['Deposit · IBKR'])
    expect(groups.gone.map((gone) => [gone.line.euros, gone.now?.euros])).toEqual([[500_000, 520_000]])
    // The fee of row 13 was rounded when it was first imported, so it is not listed again.
    expect(groups.rounded).toEqual([])
    expect(again.dryRun.gone.map((gone) => gone.kind)).toEqual(['cash-movement'])
  })
})
