// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { LABEL_WRITES, deleteLabel } from '../src/apps/company/labels/application/labelWrites'
import { dryRunFor, statementReadings, writeImport } from '../src/apps/company/imports/application/importStatements'
import { camtFile } from '../src/apps/company/imports/infrastructure/importFiles'
import { writeRuleSave, writeRulesChange } from '../src/apps/company/rules/application/ruleWrites'
import { categorisationContextOf } from '../src/apps/company/rules/domain/categorisationContext'
import { readRules, ruleLabelIdsIn } from '../src/apps/company/rules/domain/readRules'
import { blankDraft, draftChange, draftOfRule } from '../src/apps/company/rules/domain/ruleDraft'
import { previewRulesChange } from '../src/apps/company/rules/domain/rulesChangePreview'
import { ruleFieldsOf } from '../src/apps/company/rules/domain/rulesTabChange'
import { LABEL_RECORDS } from '../src/apps/company/workbook/domain/coreKinds'
import { companyBooksOf } from '../src/apps/company/workbook/domain/readWorkbook'
import { storedItemsOfRow, storesItems } from '../src/apps/company/workbook/domain/rowItems'
import { rowsOfOneItem } from '../src/apps/company/workbook/domain/splits'
import { BY_HAND_SOURCES } from '../src/apps/company/workbook/domain/workbook'
import { fakeWorkbookDocument } from '../src/apps/company/workbook/infrastructure/fake/fakeWorkbook'
import { categorise } from '../src/shared/categorising/domain/categorise'
import type { Rule } from '../src/shared/categorising/domain/rule'
import { moneyFromCents } from '../src/shared/money/money'
import { WorkbookWriteRefused } from '../src/shared/storage/application/workbookWriteRefused'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { recordsOf } from '../src/shared/storage/domain/recordsRead'
import { DEFAULT_SETTINGS } from '../src/apps/company/settings/domain/settings'
import { NO_SIGNALS } from './fixtures/ledger'
import { browserHarness, driveHarness, forgetCaches, ruleRow, workbookGrids } from './fixtures/writeBack'
import type { CellValue } from '../src/apps/company/workbook/infrastructure/workbookSnapshot'

const used = new Set<string>()
afterEach(async () => forgetCaches(used))

const SAVED = '2026-10-16T09:00:00.000Z'
const BERLIN = recordIdOf(LABEL_RECORDS, 'berlin')
const OFFICE = recordIdOf(LABEL_RECORDS, 'office')
const CATEGORIES = new Set(['travel', 'equipment'])
const LABELS = new Set([BERLIN, OFFICE])

function stored(fields: Record<string, string | boolean>) {
  return { fields: { order: '100', enabled: true, is_card: true, category: 'travel', confidence: 'rule', ...fields } }
}

describe("reading a rule's labels", () => {
  it('reads the labels a rule puts on rows, and leaves them out of a rule that puts on none', () => {
    const { rules, problems } = readRules([stored({ rule: 'flights', label_ids: 'berlin | office' }), stored({ rule: 'cards', order: '200' })], CATEGORIES, LABELS)

    expect(problems).toEqual([])
    expect(rules.map((rule) => [rule.id, rule.labels])).toEqual([
      ['flights', [BERLIN, OFFICE]],
      ['cards', undefined],
    ])
    expect('labels' in rules[1]!).toBe(false)
  })

  it('drops a label the labels tab lacks as a problem on the rule, which still reads with the others', () => {
    const { rules, problems } = readRules([stored({ rule: 'flights', label_ids: 'berlin | prague' })], CATEGORIES, LABELS)

    expect(rules[0]!.labels).toEqual([BERLIN])
    expect(problems.map((problem) => [problem.label, problem.reason])).toEqual([['flights', 'the labels tab holds no label prague, so the rule puts on none of it']])
  })

  it('reads no labels on books from before items, with a problem on the rule', () => {
    const { rules, problems } = readRules([stored({ rule: 'flights', label_ids: 'berlin' })], CATEGORIES, null)

    expect(rules[0]!.labels).toBeUndefined()
    expect(problems.map((problem) => problem.reason)).toEqual(['books from before items keep no labels, so the rule puts on none'])
  })

  it('refuses an enabled rule that labels rows and files them under no category', () => {
    const { rules, problems } = readRules([stored({ rule: 'flights', category: '', confidence: 'review', label_ids: 'berlin' })], CATEGORIES, LABELS)

    expect(rules).toEqual([])
    expect(problems.map((problem) => problem.reason)).toEqual(['it puts labels on rows and files them under no category, so it needs a category'])
  })

  it('writes the labels back into the column it reads them from', () => {
    const rule: Rule = { id: 'flights', order: 100, enabled: true, conditions: [{ column: 'is_card' }], category: 'travel', confidence: 'rule', note: '', labels: [BERLIN] }

    expect(ruleFieldsOf(rule).label_ids).toBe('berlin')
    expect(readRules([{ fields: ruleFieldsOf(rule) }], CATEGORIES, LABELS).rules).toEqual([rule])
  })

  it('gives a verdict the labels of the rule that decides it, and none of a rule it passed over', () => {
    const context = categorisationContextOf({ accounts: [], clients: [], settings: DEFAULT_SETTINGS })
    const row = { account: 'main', amount: moneyFromCents(-41_280), counterparty: 'LUFTHANSA', counterpartyIban: '', description: 'BER flight', signals: NO_SIGNALS }
    const rules: Rule[] = [
      { id: 'conference', order: 10, enabled: true, conditions: [{ column: 'description_contains', fragment: 'BER' }], category: 'travel', confidence: 'rule', note: '', labels: [BERLIN] },
      { id: 'airline', order: 20, enabled: true, conditions: [{ column: 'counterparty_contains', fragment: 'LUFTHANSA' }], category: 'travel', confidence: 'rule', note: '', labels: [OFFICE] },
    ]

    expect(categorise(row, rules, context)).toEqual({ category: 'travel', flaggedBy: 'rule', ruleId: 'conference', labels: [BERLIN] })
    expect(categorise({ ...row, description: 'Flight' }, rules, context)).toEqual({ category: 'travel', flaggedBy: 'rule', ruleId: 'airline', labels: [OFFICE] })
    expect(categorise({ ...row, description: 'Flight' }, rules.slice(0, 1), context)).not.toHaveProperty('labels')
  })

  it('gives a verdict no labels of a review rule, which leaves the row waiting rather than filing it', () => {
    const context = categorisationContextOf({ accounts: [], clients: [], settings: DEFAULT_SETTINGS })
    const row = { account: 'main', amount: moneyFromCents(-41_280), counterparty: 'LUFTHANSA', counterpartyIban: '', description: 'BER flight', signals: NO_SIGNALS }
    const rule: Rule = {
      id: 'airline',
      order: 10,
      enabled: true,
      conditions: [{ column: 'counterparty_contains', fragment: 'LUFTHANSA' }],
      category: 'travel',
      confidence: 'review',
      note: '',
      labels: [BERLIN],
    }

    expect(categorise(row, [rule], context)).toEqual({ category: 'travel', flaggedBy: 'ai', ruleId: 'airline' })
  })
})

async function itemsBooks() {
  const { store } = await browserHarness(used, fakeWorkbookDocument(SAVED, 'browser'))
  const conference = store.state.workbook!.labels.find((label) => label.name === 'Berlin conference')!
  return { store, conference }
}

describe('saving a rule with labels', () => {
  it('puts its labels beside the labels each waiting row it settles carries, in one write that one Undo takes back', async () => {
    const { store, conference } = await itemsBooks()
    const workbook = store.state.workbook!
    const records = store.state.records!
    const gadget = workbook.transactions.find((row) => row.counterparty === 'GADGET CORNER')!
    const held = storedItemsOfRow(records.items, gadget).flatMap((item) => item.labels)
    const draft = { ...blankDraft(workbook.rules), id: 'gadget-corner', conditions: [{ column: 'counterparty_contains' as const, value: 'GADGET' }], category: 'equipment', labels: [conference.id] }
    const change = draftChange(draft, workbook.rules, recordsOf(records.rules), null)
    const labels = ruleLabelIdsIn(workbook.labels, storesItems(records))

    const written = await store.write('Saved', (unit) => writeRuleSave(unit, workbook, records, change, 'gadget-corner', labels))

    expect(store.state.workbook!.rules.find((rule) => rule.id === 'gadget-corner')!.labels).toEqual([conference.id])
    expect(storedItemsOfRow(store.state.records!.items, gadget).map((item) => item.labels)).toEqual([[...new Set([...held, conference.id])]])
    await store.undo(store.state.writes.find((write) => write.receipt === written)!)
    expect(store.state.workbook!.rules.some((rule) => rule.id === 'gadget-corner')).toBe(false)
    expect(storedItemsOfRow(store.state.records!.items, gadget).flatMap((item) => item.labels)).toEqual(held)
  })

  it('leaves the labels of the rows a rule filed before, and the preview names the labels it gains', async () => {
    const { store, conference } = await itemsBooks()
    const workbook = store.state.workbook!
    const records = store.state.records!
    const context = categorisationContextOf(workbook)
    const filedRows = rowsOfOneItem(workbook.transactions, workbook.splits).filter((row) => row.flaggedBy === 'rule' && categorise(row, workbook.rules, context).ruleId !== null)
    const rule = workbook.rules.find((candidate) => filedRows.some((row) => categorise(row, workbook.rules, context).ruleId === candidate.id))!
    const opened = draftOfRule(rule, recordsOf(records.rules), workbook.rules)!
    const change = draftChange({ ...opened.draft, labels: [conference.id] }, workbook.rules, recordsOf(records.rules), opened.edited)
    const labels = ruleLabelIdsIn(workbook.labels, storesItems(records))
    const before = filedRows.map((row) => storedItemsOfRow(records.items, row).map((item) => item.labels))

    const preview = previewRulesChange(recordsOf(records.rules), change, new Set(workbook.categories.map((category) => category.slug)), labels, workbook.rules, filedRows, context)
    expect(preview.labelsGained).toEqual([{ ruleId: rule.id, labels: [conference.id] }])
    expect(preview.backtest.settled).toEqual([])

    await store.write('Saved', (unit) => writeRuleSave(unit, workbook, records, change, rule.id, labels))
    expect(filedRows.map((row) => storedItemsOfRow(store.state.records!.items, row).map((item) => item.labels))).toEqual(before)
  })
})

describe('deleting a label a rule puts on rows', () => {
  async function labelledRule() {
    const { store, conference } = await itemsBooks()
    const workbook = store.state.workbook!
    const draft = { ...blankDraft(workbook.rules), id: 'gadget-corner', conditions: [{ column: 'counterparty_contains' as const, value: 'GADGET' }], category: 'equipment', labels: [conference.id] }
    await store.write('Saved', (unit) => writeRulesChange(unit, draftChange(draft, workbook.rules, recordsOf(store.state.records!.rules), null)))
    return { store, conference }
  }

  it('takes the label off the rule in the same write, and one Undo puts it back', async () => {
    const { store, conference } = await labelledRule()

    const written = await store.write('Deleted', (unit) => deleteLabel(unit, store.state.records!, conference))
    expect(store.state.workbook!.rules.find((rule) => rule.id === 'gadget-corner')).not.toHaveProperty('labels')
    expect(store.state.workbook!.problems.filter((problem) => problem.tab === 'rules')).toEqual([])

    await store.undo(store.state.writes.find((write) => write.receipt === written)!)
    expect(store.state.workbook!.rules.find((rule) => rule.id === 'gadget-corner')!.labels).toEqual([conference.id])
  })

  it('refuses to take out a label a rule still puts on rows', async () => {
    const { store, conference } = await labelledRule()
    const stored = recordsOf(store.state.records!.labels).find((label) => label.id === conference.id)!
    await expect(store.write('Removed', (unit) => unit.of(LABEL_WRITES).remove(stored))).rejects.toThrow(WorkbookWriteRefused)
  })
})

describe('importing rows a labelled rule files', () => {
  const MAIN_IBAN = 'XX00FAKE0000000001'

  function creditStatement(): string {
    return readFileSync(join(import.meta.dirname, 'fixtures', 'camt', 'erste-credit.xml'), 'utf8')
      .replace(/^﻿/, '')
      .replace('HR2923400091110000001', MAIN_IBAN)
  }

  function grids(confidence: 'rule' | 'review' = 'rule'): Record<string, CellValue[][]> {
    const base = workbookGrids()
    return {
      ...base,
      ledger: [base.ledger![0]!],
      labels: [
        ['name', 'id'],
        ['Berlin conference', 'berlin'],
      ],
      rules: [...base.rules!, ruleRow({ rule: 'client-northwind', order: 200, enabled: true, counterparty_iban: 'HR2420011116383368706', category: 'revenue', label_ids: 'berlin', confidence })],
    }
  }

  it('gives the new row an item that carries the rule’s labels', async () => {
    const { store } = await driveHarness(used, grids())
    const books = companyBooksOf(store.state)!
    const readings = statementReadings(camtFile('statement.xml', creditStatement()), books.workbook, null)
    const waiting = dryRunFor(readings, books, new Map())
    const opening = waiting.statements[0]!.start!.opening!
    const run = dryRunFor(readings, books, new Map([['main', opening]]))

    expect([...run.ruleLabels.values()]).toEqual([[BERLIN]])
    await store.write('Imported', (unit) => writeImport(unit, run, companyBooksOf(store.state)))
    const [row] = store.state.workbook!.transactions
    expect(row).toMatchObject({ category: 'revenue', flaggedBy: 'rule' })
    expect(storedItemsOfRow(store.state.records!.items, row!).map((item) => item.labels)).toEqual([[BERLIN]])
    expect(store.state.workbook!.accounts[0]!.sources).toEqual(BY_HAND_SOURCES)
  })

  it('puts no labels on a row a review rule leaves waiting', async () => {
    const { store } = await driveHarness(used, grids('review'))
    const books = companyBooksOf(store.state)!
    const readings = statementReadings(camtFile('statement.xml', creditStatement()), books.workbook, null)
    const opening = dryRunFor(readings, books, new Map()).statements[0]!.start!.opening!
    const run = dryRunFor(readings, books, new Map([['main', opening]]))

    expect([...run.ruleLabels.values()]).toEqual([])
    await store.write('Imported', (unit) => writeImport(unit, run, companyBooksOf(store.state)))
    const [row] = store.state.workbook!.transactions
    expect(row).toMatchObject({ category: 'revenue', flaggedBy: 'ai' })
    expect(storedItemsOfRow(store.state.records!.items, row!).flatMap((item) => item.labels)).toEqual([])
  })
})
