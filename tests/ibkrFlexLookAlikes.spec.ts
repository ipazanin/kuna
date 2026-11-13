// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { writeWorkbookImport } from '../src/apps/investments/imports/application/workbookImport'
import { importableRecords } from '../src/apps/investments/imports/domain/importDryRun'
import type { ImportedRecord, WorkbookRows } from '../src/apps/investments/imports/domain/importDryRun'
import { NO_CHOICES, settledImport } from '../src/apps/investments/imports/domain/importChoices'
import type { ImportChoices } from '../src/apps/investments/imports/domain/importChoices'
import { INVESTMENT_ACCOUNT_WRITES } from '../src/apps/investments/holdings/application/holdingWrites'
import { IBKR_FLEX_RECIPE } from '../src/apps/investments/mail/domain/ibkrFlexRecipe'
import { reportRows } from '../src/apps/investments/mail/domain/reportRows'
import { sampleFlexReport } from '../src/apps/investments/mail/infrastructure/fake/sampleFlexReport'
import { writeTransaction } from '../src/apps/investments/transactions/application/transactionWrites'
import type { InvestmentBook } from '../src/apps/investments/workbook/domain/investmentBook'
import { parseCivilDate } from '../src/shared/calendar/civilDate'
import { newRecordId } from '../src/shared/storage/domain/recordId'
import { runRecipe } from '../src/shared/recipes/domain/runRecipe'
import { readRecipeFile } from '../src/shared/recipes/infrastructure/recipeFile'
import { USD, account, rateBookOf } from './fixtures/investments'
import { investmentsDesk } from './fixtures/investmentsDesk'
import type { InvestmentsDesk } from './fixtures/investmentsDesk'
import { forgetCaches } from './fixtures/writeBack'

const used = new Set<string>()
afterEach(async () => forgetCaches(used))

const RATES = rateBookOf(new Map([[USD, [['2026-01-02', '1.10']] as const]]))
const IBKR_TWO = account('ibkr2', 'IBKR 2')
const REPORT_ACCOUNT = 'U0000001'

function reportOf(): WorkbookRows {
  const bytes = new TextEncoder().encode(sampleFlexReport([parseCivilDate('2026-10-12')!])).buffer as ArrayBuffer
  const read = readRecipeFile(IBKR_FLEX_RECIPE, bytes)
  if (read.kind !== 'read') throw new Error(`It did not read: ${read.misfit.kind}`)
  const run = runRecipe(IBKR_FLEX_RECIPE, read.rows)
  if (run.kind !== 'read') throw new Error(`It does not fit: ${run.misfit.kind}`)
  return reportRows(IBKR_FLEX_RECIPE, [{ fileName: 'kuna-daily.xml', run }], { leftOut: [] }, { kind: 'uploaded' })
}

function bookOf(desk: InvestmentsDesk): InvestmentBook {
  return desk.store.state.workbook!.book
}

function settledOf(desk: InvestmentsDesk, choices: ImportChoices = NO_CHOICES) {
  const ids = new Map<string, string>()
  const newIds = (key: string): string => ids.get(key) ?? ids.set(key, newRecordId()).get(key)!
  return settledImport(reportOf(), bookOf(desk), RATES, choices, newIds)
}

async function accept(desk: InvestmentsDesk, choices: ImportChoices = NO_CHOICES): Promise<void> {
  const { dryRun } = settledOf(desk, choices)
  await desk.store.write('Report accepted', (unit) => writeWorkbookImport(unit, dryRun.added, dryRun.matched, []))
}

/** The records the report made, the ones a look-alike can be. */
function reportRecords(desk: InvestmentsDesk): ImportedRecord[] {
  return importableRecords(bookOf(desk)).filter(
    (imported) =>
      imported.record.importKey?.startsWith(`${IBKR_FLEX_RECIPE.id}:`) &&
      (imported.kind === 'trade' || imported.kind === 'income' || imported.kind === 'cash-movement' || imported.kind === 'exchange'),
  )
}

/** Takes the report's keys off its records, as if they were typed by hand or came from the workbook. */
async function unlink(desk: InvestmentsDesk, keyOf: (key: string) => string | null): Promise<void> {
  const records = reportRecords(desk)
  await desk.store.write('Unlinked', (unit) =>
    records.forEach((kept) => writeTransaction(unit, kept, { kind: kept.kind, record: { ...kept.record, importKey: keyOf(kept.record.importKey!) } } as ImportedRecord)),
  )
}

function counts(book: InvestmentBook) {
  return { accounts: book.accounts.length, trades: book.trades.length, income: book.income.length, cash: book.cashMovements.length, exchanges: book.exchanges.length }
}

async function linkedDesk(): Promise<InvestmentsDesk> {
  const desk = await investmentsDesk(used, RATES)
  await desk.store.write('IBKR 2', (unit) => unit.of(INVESTMENT_ACCOUNT_WRITES).add(IBKR_TWO))
  await accept(desk, { ...NO_CHOICES, accounts: { [REPORT_ACCOUNT]: { kind: 'existing', account: IBKR_TWO.id } } })
  return desk
}

describe('an uploaded Flex report against records Kuna has without its keys', () => {
  for (const [label, keyOf] of [
    ['typed by hand', () => null],
    ['imported from the workbook', (key: string) => key.replaceAll(':', '')],
  ] as const) {
    it(`suggests the account of records ${label} and holds every row like one back instead of adding it again`, async () => {
      const desk = await linkedDesk()
      const linked = reportRecords(desk).length
      expect(linked).toBeGreaterThan(0)
      await unlink(desk, keyOf)
      const before = counts(bookOf(desk))

      const settled = settledOf(desk)
      const [step] = settled.accounts
      expect(step!.question.known).toBeNull()
      expect(step!.question.likely).toEqual({ account: IBKR_TWO.id, rows: linked })
      expect(step!.choice).toEqual({ kind: 'existing', account: IBKR_TWO.id })
      expect(settled.dryRun.added.accounts).toEqual([])
      expect(settled.dryRun.questions.lookAlikes).toHaveLength(linked)
      expect(settled.dryRun.entries.filter((entry) => entry.outcome.kind === 'waiting' && entry.outcome.reason.kind === 'looks-in-kuna')).toHaveLength(linked)

      await accept(desk)
      expect(counts(bookOf(desk))).toEqual(before)
    })
  }

  it('keeps a new account the person picks over the suggestion', async () => {
    const desk = await linkedDesk()
    await unlink(desk, () => null)
    const settled = settledOf(desk, { ...NO_CHOICES, accounts: { [REPORT_ACCOUNT]: { kind: 'new', name: 'IBKR 3' } } })
    expect(settled.accounts[0]!.question.likely?.account).toBe(IBKR_TWO.id)
    expect(settled.accounts[0]!.choice).toEqual({ kind: 'new', name: 'IBKR 3' })
  })

  it("gives a record the person calls the same the row's key, so the next report finds it by key, and Undo takes the key back", async () => {
    const desk = await linkedDesk()
    await unlink(desk, () => null)
    const before = counts(bookOf(desk))
    const { dryRun } = settledOf(desk)
    const lookAlikes = Object.fromEntries(dryRun.questions.lookAlikes.map((question) => [question.key, { like: question.like.record.id, same: true }]))

    const answered = settledOf(desk, { ...NO_CHOICES, lookAlikes })
    expect(answered.dryRun.matched).toHaveLength(dryRun.questions.lookAlikes.length)
    expect(answered.dryRun.matched.every(({ kept, keyed }) => kept.record.importKey === null && keyed.record.importKey !== null)).toBe(true)
    await accept(desk, { ...NO_CHOICES, lookAlikes })
    expect(counts(bookOf(desk))).toEqual(before)
    expect(reportRecords(desk)).toHaveLength(dryRun.questions.lookAlikes.length)

    const next = settledOf(desk)
    expect(next.accounts.every((step) => step.question.known === IBKR_TWO.id)).toBe(true)
    expect(next.dryRun.questions.lookAlikes).toEqual([])
    expect(next.dryRun.entries.filter((entry) => entry.outcome.kind === 'in-kuna').length).toBeGreaterThanOrEqual(dryRun.questions.lookAlikes.length)

    await desk.store.undo(desk.store.state.writes[0]!)
    expect(reportRecords(desk)).toEqual([])
  })

  it('adds a row the person calls another record', async () => {
    const desk = await linkedDesk()
    await unlink(desk, () => null)
    const before = counts(bookOf(desk))
    const [first] = settledOf(desk).dryRun.questions.lookAlikes
    await accept(desk, { ...NO_CHOICES, lookAlikes: { [first!.key]: { like: first!.like.record.id, same: false } } })
    const after = counts(bookOf(desk))
    expect(Object.values(after).reduce((sum, count) => sum + count, 0)).toBe(Object.values(before).reduce((sum, count) => sum + count, 0) + 1)
  })

  it('takes a row like a record another row of the same report account made as a record of its own, since each row has its own id', async () => {
    const desk = await linkedDesk()
    await unlink(desk, (key) => `${key}0`)
    const settled = settledOf(desk)
    expect(settled.accounts.every((step) => step.question.known === IBKR_TWO.id)).toBe(true)
    expect(settled.dryRun.questions.lookAlikes).toEqual([])
    expect(importableRecords(settled.dryRun.added)).toHaveLength(reportRecords(desk).length)
  })
})
