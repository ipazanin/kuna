import 'fake-indexeddb/auto'
import ts from 'typescript'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LEDGER_WRITES } from '../src/apps/company/imports/application/ledgerWrites'
import { ledgerIdOf } from '../src/apps/company/workbook/domain/ledgerReading'
import type { LedgerEntry } from '../src/apps/company/workbook/domain/ledgerReading'
import { INSTRUMENT_WRITES, INVESTMENT_ACCOUNT_WRITES } from '../src/apps/investments/holdings/application/holdingWrites'
import { words as holdingWords } from '../src/apps/investments/holdings/application/words'
import { reportRowKey } from '../src/apps/investments/imports/domain/reportKey'
import { writeTransaction } from '../src/apps/investments/transactions/application/transactionWrites'
import type { TransactionRecord } from '../src/apps/investments/transactions/domain/listedTransactions'
import type { InvestmentAccount } from '../src/apps/investments/workbook/domain/investmentAccount'
import { emptyInvestmentsDocument } from '../src/apps/investments/workbook/infrastructure/investmentsDocument'
import { codecOfSpendingKind } from '../src/apps/spending/workbook/application/spendingCodecs'
import type { Account } from '../src/apps/spending/workbook/domain/account'
import { ACCOUNT_RECORDS, CATEGORY_RECORDS } from '../src/apps/spending/workbook/domain/spendingKinds'
import { spendingDocumentOf } from '../src/apps/spending/workbook/infrastructure/spendingDocument'
import { NO_SIGNALS } from '../src/apps/company/imports/domain/importedStatement'
import { EURO } from '../src/shared/money/currencyCode'
import { moneyFromAmount } from '../src/shared/money/money'
import { WorkbookWriteRefused } from '../src/shared/storage/application/workbookWriteRefused'
import type { RecordKind } from '../src/shared/storage/domain/recordKind'
import { account, cashMovement, cashTransfer, dividend, exchange, instrument, trade, USD } from './fixtures/investments'
import { civil } from './fixtures/ledger'
import { ACCOUNTS, CASH, CATEGORIES, OTP, addEntries, row, FILE_THEN_LINK } from './fixtures/spending'
import { COMPANY, INVESTMENTS, SPENDING, browserHarness, forgetCaches, workbookGrids } from './fixtures/writeBack'
import { writeGraph } from './support/writePaths'
import type { WriteGraph } from './support/writePaths'

const used = new Set<string>()
afterEach(async () => forgetCaches(used))

/**
 * The write rules of each kind whose record lands on an account, by their key in the write graph. Each is checked below against a
 * row by hand on an account an automation fills, and a row before the account's opening day.
 */
const ROW_WRITES = {
  'src/apps/spending/entries/application/rowRecords.ts#TRANSACTION_WRITES': 'Spending rows',
  'src/apps/investments/transactions/application/transactionWrites.ts#TRADE_WRITES': 'Investments trades',
  'src/apps/investments/transactions/application/transactionWrites.ts#INCOME_WRITES': 'Investments income',
  'src/apps/investments/transactions/application/transactionWrites.ts#CASH_MOVEMENT_WRITES': 'Investments cash movements',
  'src/apps/investments/transactions/application/transactionWrites.ts#EXCHANGE_WRITES': 'Investments exchanges',
  'src/apps/investments/transactions/application/transactionWrites.ts#TRANSFER_WRITES': 'Investments transfers',
  'src/apps/company/imports/application/ledgerWrites.ts#LEDGER_WRITES': 'Company ledger rows',
}

/** Kinds whose record names an account, or a from and a to, but lands no row on an account, with why. */
const NOT_ROWS: Readonly<Record<string, string>> = {
  'src/apps/spending/statements/application/ruleRecords.ts#HELD_ROW_WRITES': 'A bank row on hold comes from the bank sync alone and lands as a row through TRANSACTION_WRITES once answered.',
  'src/apps/spending/statements/application/ruleRecords.ts#DROPPED_ROW_WRITES': 'A note of a payment the bank dropped names the account the row was on, and lands no row.',
  'src/apps/spending/receipts/application/receiptRecords.ts#RECEIPT_WRITES': 'A receipt for an account the bank fills writes no row and waits for the bank to bring it.',
  'src/apps/spending/shortcuts/application/shortcutWrites.ts#SHORTCUT_WRITES': 'A quick add names the account its rows go on, and each row it adds goes through TRANSACTION_WRITES.',
  'src/apps/company/packs/hr-doo/domain/hrDooWrites.ts#EMPLOYEE_WRITES': "An employee's from and to are the days of the employment, not accounts.",
  'src/apps/company/packs/hr-doo/domain/hrDooWrites.ts#TRIP_LEG_WRITES': "A trip leg's from and to are places, not accounts.",
}

const APPS = /^src\/apps\/(spending|investments|company)\//

/** Where a type is declared, as the file and the interface or type alias, through the imports and re-exports that bring it. */
function typeDeclarations(graph: WriteGraph, file: string, name: string, seen: Set<string> = new Set()): { readonly file: string; readonly nodes: readonly ts.Node[] } | null {
  const asked = `${file}#${name}`
  const module = graph.modules.get(file)
  if (module === undefined || seen.has(asked)) return null
  seen.add(asked)
  const nodes = module.scripts.flatMap((script) =>
    script.source.statements.filter((statement) => (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) && statement.name.text === name),
  )
  if (nodes.length > 0) return { file, nodes }
  const from = module.reExports.get(name) ?? module.imports.get(name)
  return from === undefined || from.file === null ? null : typeDeclarations(graph, from.file, from.name, seen)
}

/** The names of the fields a type declares, through the interfaces it extends, the types it joins and the fields a `Pick` keeps. */
function fieldsOf(graph: WriteGraph, file: string, name: string, seen: Set<string> = new Set()): Set<string> {
  const found = typeDeclarations(graph, file, name)
  const fields = new Set<string>()
  if (found === null || seen.has(`${found.file}#${name}`)) return fields
  seen.add(`${found.file}#${name}`)
  const into = (other: Set<string>) => other.forEach((field) => fields.add(field))
  const ofType = (type: ts.TypeNode): void => {
    if (ts.isTypeLiteralNode(type)) type.members.forEach((member) => member.name !== undefined && fields.add(member.name.getText()))
    else if (ts.isIntersectionTypeNode(type) || ts.isUnionTypeNode(type)) type.types.forEach(ofType)
    else if (ts.isParenthesizedTypeNode(type)) ofType(type.type)
    else if (ts.isTypeReferenceNode(type)) {
      const referenced = type.typeName.getText()
      const [first, kept] = type.typeArguments ?? []
      if (referenced === 'Pick' && kept !== undefined)
        kept
          .getText()
          .split('|')
          .forEach((field) => fields.add(field.trim().replace(/^'|'$/g, '')))
      else if (referenced === 'Omit' && first !== undefined) ofType(first)
      else into(fieldsOf(graph, found.file, referenced, seen))
    }
  }
  for (const node of found.nodes) {
    if (ts.isInterfaceDeclaration(node)) {
      node.members.forEach((member) => member.name !== undefined && fields.add(member.name.getText()))
      node.heritageClauses?.forEach((clause) => clause.types.forEach((base) => into(fieldsOf(graph, found.file, base.expression.getText(), seen))))
    }
    if (ts.isTypeAliasDeclaration(node)) ofType(node.type)
  }
  return fields
}

describe('the rule that an account takes rows only from where it says', () => {
  it('is checked for every kind whose record lands on an account', () => {
    const graph = writeGraph()
    const onAccounts = [...graph.modules.values()]
      .filter((module) => APPS.test(module.file))
      .flatMap((module) =>
        [...module.declarations].flatMap(([name, found]) =>
          found.flatMap(({ node }) => {
            if (!ts.isVariableDeclaration(node) || node.type === undefined || !ts.isTypeReferenceNode(node.type) || node.type.typeName.getText() !== 'WriteRules') return []
            const record = node.type.typeArguments?.[0]?.getText() ?? ''
            const fields = fieldsOf(graph, module.file, record)
            return fields.has('account') || (fields.has('from') && fields.has('to')) ? [`${module.file}#${name}`] : []
          }),
        ),
      )
    expect(
      onAccounts.filter((key) => !(key in ROW_WRITES) && !(key in NOT_ROWS)),
      'Add the kind to ROW_WRITES with a check below, or to NOT_ROWS with why',
    ).toEqual([])
    expect([...Object.keys(ROW_WRITES), ...Object.keys(NOT_ROWS)].filter((key) => !onAccounts.includes(key))).toEqual([])
  })
})

function stored<R>(kind: RecordKind<R>, records: readonly R[]) {
  const codec = codecOfSpendingKind(kind)
  return { [kind.name]: records.map((record) => codec.fieldsOf(record)) }
}

describe('Spending rows', () => {
  async function storeOf(accounts: readonly Account[]) {
    const document = spendingDocumentOf('2026-11-04T09:00:00.000Z', { ...stored(ACCOUNT_RECORDS, accounts), ...stored(CATEGORY_RECORDS, CATEGORIES) })
    return (await browserHarness(used, document, SPENDING)).store
  }

  it.each([
    ['typed', '', 'by-hand'],
    ['copied', 'read-otp-1', 'by-hand'],
    ["of the bank's file", 'otp-file-1', 'provider-file'],
  ])('refuses a row %s on an account the bank link fills alone, on any day', async (_label, importKey) => {
    const syncOnly = { ...OTP, alsoFrom: [] }
    const store = await storeOf([syncOnly, CASH])
    for (const date of ['2026-09-01', '2026-10-10']) {
      const added = row(syncOnly, date, -5, 'Food/Groceries', { source: importKey === '' ? 'typed' : 'statement', importKey })
      await expect(store.write('Added', (unit) => addEntries(unit, store.state.records!, [added]))).rejects.toThrow(WorkbookWriteRefused)
    }
    expect(store.state.workbook!.transactions).toEqual([])
  })

  it("takes the bank's file on its days, the bank sync's row from the day its link starts, and a typed row on cash", async () => {
    const store = await storeOf([FILE_THEN_LINK, ...ACCOUNTS.slice(1)])
    const added = [
      row(OTP, '2026-10-29', -7, 'Food/Groceries', { source: 'statement', importKey: 'bank-otp-1' }),
      row(OTP, '2026-10-13', -9, 'Food/Groceries', { source: 'statement', importKey: 'otp-file-1' }),
      row(CASH, '2026-10-13', -3, 'Food/Groceries'),
    ]
    await store.write('Added', (unit) => addEntries(unit, store.state.records!, added))
    expect(store.state.workbook!.transactions).toHaveLength(3)
  })

  it('refuses a row before the account opened', async () => {
    const store = await storeOf([CASH])
    await expect(store.write('Added', (unit) => addEntries(unit, store.state.records!, [row(CASH, '2026-08-31', -3, 'Food/Groceries')]))).rejects.toThrow(WorkbookWriteRefused)
  })
})

describe('Investments records', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-13T10:00:00Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  const IBKR = account('ibkr', 'IBKR', [
    { source: 'provider-file', from: null },
    { source: 'mail', from: civil('2026-06-01') },
  ])
  const OTHER = account('other', 'Other broker')
  const FUND = instrument('fund', { name: 'Example Fund', prices: 'manual', sourceSymbol: '' })

  async function storeOf() {
    const { store } = await browserHarness(used, emptyInvestmentsDocument('2026-10-30T09:00:00.000Z'), INVESTMENTS)
    await store.write('Set up', (unit) => {
      unit.of(INVESTMENT_ACCOUNT_WRITES).add(IBKR)
      unit.of(INVESTMENT_ACCOUNT_WRITES).add(OTHER)
      unit.of(INSTRUMENT_WRITES).add(FUND)
    })
    return store
  }

  const typedOn = (on: InvestmentAccount, date: string): readonly TransactionRecord[] => [
    { kind: 'trade', record: trade('buy', on, FUND, date, '1', '10', null) },
    { kind: 'income', record: dividend(on, FUND, date, '5', '0') },
    { kind: 'cash-movement', record: cashMovement('deposit', on, date, '100') },
    { kind: 'exchange', record: exchange(on, date, '100', USD, '90', EURO) },
    { kind: 'transfer', record: cashTransfer(OTHER, on, date, USD, '50') },
  ]

  it.each(['2026-05-31', '2026-06-01'])('refuses each kind typed onto an account the mail fills, on %s, whatever it allows besides', async (date) => {
    const store = await storeOf()
    for (const typed of typedOn(IBKR, date)) {
      await expect(store.write('Typed', (unit) => writeTransaction(unit, null, typed))).rejects.toThrow(new WorkbookWriteRefused(holdingWords.mailOwnsAccount('IBKR')))
    }
  })

  // A report's record carries the same key whether the mail or an upload on Import brought it, so the report's import checks
  // whether the account allows the uploaded report, and the write rule takes both.
  it("takes an IBKR report's record on an account the mail fills", async () => {
    const store = await storeOf()
    const reported = { ...trade('buy', IBKR, FUND, '2026-07-01', '1', '10', null), importKeys: [reportRowKey('trades', 'U1234567', 'T-1')] }
    await store.write('Imported', (unit) => writeTransaction(unit, null, { kind: 'trade', record: reported }))
    expect(store.state.workbook!.book.trades).toHaveLength(1)
  })

  it('takes each kind typed onto an account kept by hand', async () => {
    const store = await storeOf()
    await store.write('Typed', (unit) =>
      typedOn(OTHER, '2026-07-01')
        .slice(0, 3)
        .forEach((typed) => writeTransaction(unit, null, typed)),
    )
    expect(store.state.workbook!.book.trades).toHaveLength(1)
  })
})

describe('Company ledger rows', () => {
  /** A row after the harness's newest one of main, which leaves main at €1,000.00 on 5 Oct 2026. */
  function entryOf(statement: string, reference: string, date = '2026-10-06'): LedgerEntry {
    const fields = {
      account: 'main',
      date: civil(date),
      statement,
      counterparty: 'Acme',
      counterpartyIban: '',
      description: 'Payment',
      amount: moneyFromAmount(10),
      balance: moneyFromAmount(1010),
      category: 'revenue',
      flaggedBy: 'rule',
      reference,
      signals: NO_SIGNALS,
      reviewReasons: [],
      ownerShare: null,
      rowId: null,
    }
    return { ...fields, id: ledgerIdOf(fields) }
  }

  async function storeOf(rowsFrom: 'mail' | 'by-hand') {
    const accounts =
      rowsFrom === 'mail'
        ? [
            ['account', 'iban', 'rows_from', 'starts_on'],
            ['main', 'XX00FAKE0000000001', 'mail', 46174],
          ]
        : [
            ['account', 'iban', 'rows_from'],
            ['main', 'XX00FAKE0000000001', 'by-hand'],
          ]
    return (await browserHarness(used, { ...workbookGrids(), accounts }, COMPANY)).store
  }

  it.each([
    ["a bank sheet's", 'export.xlsx (ffffffff)', 'X-1'],
    ['a copied', 'main, October', 'read-main-1'],
  ])('refuses %s row on an account the bank statements fill', async (_label, statement, reference) => {
    const store = await storeOf('mail')
    await expect(store.write('Imported', (unit) => unit.of(LEDGER_WRITES).add(entryOf(statement, reference)))).rejects.toThrow(WorkbookWriteRefused)
  })

  // A camt row carries the same label whether the statements folder or a file on Import brought it, so the dry run checks
  // whether the account allows the bank's file, and the write rule takes both.
  it("takes the bank statement's row there, and a sheet's on an account kept by hand", async () => {
    const mail = await storeOf('mail')
    await mail.write('Filed', (unit) => unit.of(LEDGER_WRITES).add(entryOf('2026-10-06-statement-003', 'M3-1')))
    const byHand = await storeOf('by-hand')
    await byHand.write('Imported', (unit) => unit.of(LEDGER_WRITES).add(entryOf('export.xlsx (ffffffff)', 'X-1')))
    expect([mail, byHand].map((store) => store.state.workbook!.transactions.length)).toEqual([5, 5])
  })

  it("refuses a row before the account's newest one, as the ledger opens each account at its first statement", async () => {
    const store = await storeOf('by-hand')
    await expect(store.write('Imported', (unit) => unit.of(LEDGER_WRITES).add(entryOf('export.xlsx (ffffffff)', 'X-1', '2026-10-01')))).rejects.toThrow(WorkbookWriteRefused)
  })
})
