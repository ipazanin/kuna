// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { startPlacingPayments, writeInvoice } from '../src/apps/company/receivables/application/invoicePaymentWrites'
import { invoiceToPlace, paymentChoices } from '../src/apps/company/receivables/domain/invoicePayments'
import type { PaymentChoice } from '../src/apps/company/receivables/domain/invoicePayments'
import { invoiceIdOf } from '../src/apps/company/workbook/domain/invoicesReading'
import type { Invoice } from '../src/apps/company/workbook/domain/workbook'
import { removeSplit, splitRefusal, writeSplit } from '../src/apps/company/transactions/application/splitWrites'
import type { SplitPartDraft } from '../src/apps/company/transactions/application/splitWrites'
import { storedSplitsOf } from '../src/apps/company/workbook/domain/storedSplits'
import { dryRunFor, statementReadings, writeImport } from '../src/apps/company/imports/application/importStatements'
import type { ImportDryRun } from '../src/apps/company/imports/domain/importDryRun'
import { sampleCamtXml, sampleCopiedLedgerRow } from '../src/apps/company/imports/infrastructure/fake/sampleImportFiles'
import { companyBooksOf } from '../src/apps/company/workbook/domain/readWorkbook'
import { euros } from './fixtures/ledger'
import { receivablesOf } from '../src/apps/company/receivables/domain/invoiceMatching'
import { presentedWorkbook } from '../src/apps/company/transactions/domain/presentedWorkbook'
import type { Workbook } from '../src/apps/company/workbook/domain/workbook'
import { fakeWorkbookDocument, fakeWorkbookDocumentBeforeItems, itemOfLedgerRow, withPaymentsMatched } from '../src/apps/company/workbook/infrastructure/fake/fakeWorkbook'
import { addMoney, minMoney, moneyFromCents, subtractMoney, sumMoney } from '../src/shared/money/money'
import type { Money } from '../src/shared/money/money'
import type { RecordFields } from '../src/shared/storage/domain/recordFields'
import { recordsOf } from '../src/shared/storage/domain/recordsRead'
import { browserHarness, forgetCaches } from './fixtures/writeBack'
import type { WriteBackHarness } from './fixtures/writeBack'
import { camtFile } from '../src/apps/company/imports/infrastructure/importFiles'

const used = new Set<string>()

afterEach(async () => {
  await forgetCaches(used)
})

const SAVED = '2026-10-16T09:00:00.000Z'

type Store = WriteBackHarness['store']

function booksOf(store: Store) {
  return { records: store.state.records!, workbook: store.state.workbook! }
}

/** What each client owes and was paid, with what was paid past or beside an invoice as one sum, since matching and placing tell those apart differently. */
function owed(workbook: Workbook) {
  return receivablesOf(presentedWorkbook(workbook)).clients.map((client) => [
    client.client.slug,
    client.outstanding,
    addMoney(client.overpaid, client.creditsWithNoInvoice),
    client.invoices.map((matched) => [matched.invoice.id, matched.remaining, matched.status, matched.received]),
  ])
}

describe('starting to place client payments', () => {
  it('stores what the matching put on each invoice and records it in the settings, figures unchanged, and Undo puts the books back', async () => {
    const { store } = await browserHarness(used, withPaymentsMatched(fakeWorkbookDocument(SAVED, 'browser')))
    const matched = store.state.workbook!
    const itemsBefore = recordsOf(store.state.records!.items)
    expect(matched.paidInvoices).toBeUndefined()

    await store.write('Placed', (unit) => startPlacingPayments(unit, booksOf(store)))

    const placed = store.state.workbook!
    expect(placed.settings.clientPaymentsPlaced).toBe(true)
    expect(placed.paidInvoices?.size).toBeGreaterThan(0)
    expect(placed.problems).toEqual([])
    expect(owed(placed)).toEqual(owed(matched))
    expect(receivablesOf(presentedWorkbook(placed)).clients.flatMap((client) => client.unplaced ?? [])).toEqual([])

    await store.undo(store.state.writes[0]!)
    expect(store.state.workbook!.settings.clientPaymentsPlaced).toBe(false)
    expect(recordsOf(store.state.records!.items)).toEqual(itemsBefore)
  })

  it.each([
    ['books that place their payments already', fakeWorkbookDocument(SAVED, 'browser')],
    ['books from before items', fakeWorkbookDocumentBeforeItems(SAVED, 'browser')],
  ])('writes nothing on %s', async (_books, document) => {
    const { store } = await browserHarness(used, document)

    await store.write('Placed', (unit) => startPlacingPayments(unit, booksOf(store)))

    expect(store.state.writes).toEqual([])
  })
})

describe('money placed on an invoice', () => {
  /** The first client payment of several items whose first item pays an invoice, with its stored split and drafts that keep each part as it is. */
  async function placedPayment() {
    const { store } = await browserHarness(used, fakeWorkbookDocument(SAVED, 'browser'))
    const items = recordsOf(store.state.records!.items)
    const paid = items.find((item) => item.invoice !== null && items.filter((other) => other.row === item.row).length > 1)!
    const row = store.state.workbook!.transactions.find((held) => held.rowId === paid.row)!
    const stored = storedSplitsOf(store.state.records!)(row)
    const kept = stored.parts.map((part): SplitPartDraft => ({ amount: part.amount, category: part.category, note: part.note, opened: part }))
    return { store, row, stored, kept }
  }

  it('lets a split keep what each part puts on its invoice', async () => {
    const { store, row, stored, kept } = await placedPayment()
    const notes = kept.map((draft) => ({ ...draft, note: `${draft.note} kept` }))

    expect(splitRefusal(booksOf(store), row, stored, notes)).toBeNull()
    await store.write('Split', (unit) => writeSplit(unit, store.state.records!, row, stored, notes, store.state.workbook!.categories))
    expect(store.state.workbook!.problems).toEqual([])
  })

  it('refuses a split that moves money between its parts, and taking the split off, naming the invoices it pays', async () => {
    const { store, row, stored, kept } = await placedPayment()
    const [first, second] = kept
    const cent = moneyFromCents(100)
    const moved = [{ ...first!, amount: subtractMoney(first!.amount, cent) }, { ...second!, amount: addMoney(second!.amount, cent) }, ...kept.slice(2)]
    const refusal = splitRefusal(booksOf(store), row, stored, moved)

    expect(refusal).toMatch(/pays invoices? .*\. Change what it puts on (it|each) in the invoice dialog\.$/)
    await expect(store.write('Split', (unit) => writeSplit(unit, store.state.records!, row, stored, moved, store.state.workbook!.categories))).rejects.toThrow(refusal!)
    expect(splitRefusal(booksOf(store), row, stored, null)).toBe(refusal)
    await expect(store.write('Taken off', (unit) => removeSplit(unit, booksOf(store), row, stored))).rejects.toThrow(refusal!)
  })
})

describe('an import of a client payment', () => {
  /** The sample statement's dry run, its client payment from Northwind holding 7,120.00 of which invoice 10-1-26 has 500.00 open. */
  function sampleRun(store: Store, startsPlacing = true): ImportDryRun {
    const file = camtFile('statement.xml', sampleCamtXml())
    return dryRunFor(statementReadings(file, store.state.workbook!, null), booksOf(store), new Map(), new Map(), new Map(), startsPlacing)
  }

  /** What the run's rows pay, as each item's amount and the number of the invoice it pays. */
  function paysOf(store: Store, run: ImportDryRun) {
    const numberOf = new Map(store.state.workbook!.invoices.map((invoice) => [invoice.id, invoice.number]))
    return run.payments.map((payment) => payment.items.map((item) => [item.amount, item.of === null ? null : (numberOf.get(item.of) ?? 'not an invoice')]))
  }

  function owedOn(workbook: Workbook, number: string) {
    return receivablesOf(presentedWorkbook(workbook))
      .clients.flatMap((client) => client.invoices)
      .find((matched) => matched.invoice.number === number)!.remaining
  }

  it('places the payment on the invoice it pays on books that place payments', async () => {
    const { store } = await browserHarness(used, fakeWorkbookDocument(SAVED, 'browser'))
    const run = sampleRun(store)

    expect(paysOf(store, run)).toEqual([
      [
        [euros(6620), null],
        [euros(500), '10-1-26'],
      ],
    ])
    expect(run.statements[0]!.rows.find((row) => row.pays !== undefined)?.amount).toBe(euros(7120))
    await store.write('Imported', (unit) => writeImport(unit, run, companyBooksOf(store.state)))

    expect(owedOn(store.state.workbook!, '10-1-26')).toBe(euros(0))
    expect(store.state.workbook!.problems).toEqual([])
  })

  it('starts placing the earlier payments in the same write on books that match them, and Undo puts the books back', async () => {
    const { store } = await browserHarness(used, withPaymentsMatched(fakeWorkbookDocument(SAVED, 'browser')))
    const matched = store.state.workbook!
    const itemsBefore = recordsOf(store.state.records!.items)
    const run = sampleRun(store)
    expect(paysOf(store, run)).toEqual([
      [
        [euros(6620), null],
        [euros(500), '10-1-26'],
      ],
    ])

    await store.write('Imported', (unit) => writeImport(unit, run, companyBooksOf(store.state)))

    const placed = store.state.workbook!
    expect(placed.settings.clientPaymentsPlaced).toBe(true)
    expect(owedOn(placed, '10-1-26')).toBe(euros(0))
    expect(owed(placed).filter(([slug]) => slug !== 'northwind')).toEqual(owed(matched).filter(([slug]) => slug !== 'northwind'))
    expect(placed.problems).toEqual([])
    await store.undo(store.state.writes[0]!)
    expect(store.state.workbook!.settings.clientPaymentsPlaced).toBe(false)
    expect(recordsOf(store.state.records!.items)).toEqual(itemsBefore)
  })

  it("keeps what a copied row paid on the bank's row that takes its place when the import starts placing", async () => {
    const { records } = withPaymentsMatched(fakeWorkbookDocument(SAVED, 'browser'))
    const copied: RecordFields = { ...sampleCopiedLedgerRow(), counterparty_iban: 'XX00FAKE0000000000000010' }
    const { category: _category, ...stored } = copied
    const { store } = await browserHarness(used, {
      ...withPaymentsMatched(fakeWorkbookDocument(SAVED, 'browser')),
      records: { ...records, 'ledger-row': [stored, ...(records['ledger-row'] ?? [])], item: [itemOfLedgerRow(copied), ...(records.item ?? [])] },
    })
    const matched = store.state.workbook!
    expect(owedOn(matched, '10-1-26')).toBe(euros(0))
    const lumen = {
      credit: true,
      cents: 240_000,
      codes: ['PMNT', 'RCDT', 'ESCT'] as const,
      reference: 'SAMPLE-CAMT-0005',
      party: '<Dbtr><Pty><Nm>Lumen Labs GmbH</Nm></Pty></Dbtr><DbtrAcct><Id><IBAN>XX00FAKE0000000000000012</IBAN></Id></DbtrAcct>',
      description: 'Invoice LL-002',
    }
    const northwind = {
      credit: true,
      cents: 712_000,
      codes: ['PMNT', 'RCDT', 'ESCT'] as const,
      reference: 'SAMPLE-CAMT-0001',
      party: '<Dbtr><Pty><Nm>Northwind Analytics Ltd</Nm></Pty></Dbtr><DbtrAcct><Id><IBAN>XX00FAKE0000000000000010</IBAN></Id></DbtrAcct>',
      description: 'Invoice 9-1-26',
    }
    const file = camtFile('statement.xml', sampleCamtXml(undefined, [northwind, lumen]))
    const readings = statementReadings(file, matched, null)
    const [question] = dryRunFor(readings, booksOf(store), new Map()).statements[0]!.questions
    const run = dryRunFor(readings, booksOf(store), new Map(), new Map(), new Map([[question!.key, { booked: question!.copied.id, keep: 'file' as const }]]))
    expect(run.removed.map((row) => row.reference)).toEqual([copied['reference']])
    expect(paysOf(store, run)).toEqual([[[euros(2400), 'LL-002']]])

    await store.write('Imported', (unit) => writeImport(unit, run, companyBooksOf(store.state)))

    const placed = store.state.workbook!
    expect(placed.settings.clientPaymentsPlaced).toBe(true)
    expect(owedOn(placed, '10-1-26')).toBe(euros(0))
    expect(owedOn(placed, 'LL-002')).toBe(euros(0))
    // The bank booked the payment a day after the copied row, so only the day each invoice was paid moves.
    const remaining = (workbook: Workbook) =>
      owed(workbook).map(([slug, outstanding, beside, invoices]) => [slug, outstanding, beside, (invoices as unknown[][]).map((invoice) => invoice.slice(0, 3))])
    expect(remaining(placed).filter(([slug]) => slug !== 'lumen')).toEqual(remaining(matched).filter(([slug]) => slug !== 'lumen'))
    expect(placed.problems).toEqual([])
  })

  it('leaves payments unplaced in a sync on books that match them, and places them in a sync once the books place them', async () => {
    const { store: matching } = await browserHarness(used, withPaymentsMatched(fakeWorkbookDocument(SAVED, 'browser')))
    expect(sampleRun(matching, false).payments).toEqual([])

    const { store: placing } = await browserHarness(used, fakeWorkbookDocument(SAVED, 'browser'))
    expect(paysOf(placing, sampleRun(placing, false))).toEqual([
      [
        [euros(6620), null],
        [euros(500), '10-1-26'],
      ],
    ])
  })

  it('proposes nothing on books from before items', async () => {
    const { store } = await browserHarness(used, fakeWorkbookDocumentBeforeItems(SAVED, 'browser'))

    expect(sampleRun(store).payments).toEqual([])
  })
})

describe('Paid by on an invoice', () => {
  function choicesOf(store: Store, invoice: Invoice | null, client: string): PaymentChoice[] {
    return paymentChoices(presentedWorkbook(store.state.workbook!), invoice?.id ?? null, client)
  }

  function matchedOf(workbook: Workbook, invoice: Invoice) {
    return receivablesOf(presentedWorkbook(workbook))
      .clients.flatMap((client) => client.invoices)
      .find((matched) => matched.invoice.id === invoice.id)!
  }

  function unplacedOf(workbook: Workbook) {
    return receivablesOf(presentedWorkbook(workbook)).clients.flatMap((client) => client.unplaced ?? [])
  }

  /** An invoice that one client payment of one item pays exactly, on books that place payments. */
  async function paidInFull() {
    const { store } = await browserHarness(used, fakeWorkbookDocument(SAVED, 'browser'))
    const items = recordsOf(store.state.records!.items)
    const paying = items.find((item) => {
      const invoice = store.state.workbook!.invoices.find((held) => held.id === item.invoice)
      return invoice?.amount === item.amount && items.filter((other) => other.row === item.row || other.invoice === item.invoice).length === 1
    })!
    const invoice = store.state.workbook!.invoices.find((held) => held.id === paying.invoice)!
    return { store, invoice, paying }
  }

  it('takes a payment off, which then waits to be placed, and places it again where Place opens, as the books held it', async () => {
    const { store, invoice, paying } = await paidInFull()
    const itemsBefore = recordsOf(store.state.records!.items)
    const owedBefore = owed(store.state.workbook!)
    const held = choicesOf(store, invoice, invoice.client)
    expect(held.filter((choice) => choice.named).map((choice) => choice.item)).toContain(paying.id)

    await store.write('Saved', (unit) =>
      writeInvoice(
        unit,
        booksOf(store),
        invoice,
        invoice,
        held.filter((choice) => choice.named && choice.item !== paying.id),
      ),
    )

    const freed = store.state.workbook!
    expect(matchedOf(freed, invoice).status).not.toBe('paid')
    const [waiting] = unplacedOf(freed)
    expect(waiting?.transaction.amount).toBe(paying.amount)
    expect(invoiceToPlace(presentedWorkbook(freed), invoice.client, waiting!.transaction)?.id).toBe(invoice.id)
    const offered = choicesOf(store, invoice, invoice.client)
    const freedChoice = offered.find((choice) => !choice.named && choice.item === paying.id)
    expect(freedChoice?.amount).toBe(paying.amount)

    await store.write('Saved', (unit) =>
      writeInvoice(
        unit,
        booksOf(store),
        invoice,
        invoice,
        offered.filter((choice) => choice.named || choice === freedChoice),
      ),
    )

    const itemsAfter = recordsOf(store.state.records!.items)
    expect(itemsAfter.filter((item) => !itemsBefore.some((held) => JSON.stringify(held) === JSON.stringify(item)))).toEqual([])
    expect(itemsAfter).toEqual(itemsBefore)
    expect(owed(store.state.workbook!)).toEqual(owedBefore)
    expect(store.state.workbook!.problems).toEqual([])
    await store.undo(store.state.writes[0]!)
    expect(unplacedOf(store.state.workbook!)).toHaveLength(1)
  })

  it('records a new invoice paid by part of a payment no invoice holds, in the same write, the rest staying on the row', async () => {
    const { store, invoice, paying } = await paidInFull()
    await store.write('Saved', (unit) => writeInvoice(unit, booksOf(store), invoice, invoice, []))
    const added: Invoice = { ...invoice, number: 'NEW-1', amount: subtractMoney(paying.amount, euros(1)), id: invoiceIdOf({ client: invoice.client, number: 'NEW-1' }) }
    const free = choicesOf(store, null, invoice.client).filter((choice) => choice.item === paying.id)
    expect(free.map((choice) => choice.named)).toEqual([false])

    await store.write('Added', (unit) => writeInvoice(unit, booksOf(store), null, added, free))

    expect(matchedOf(store.state.workbook!, added).status).toBe('paid')
    const row = recordsOf(store.state.records!.items).filter((item) => item.row === paying.row)
    expect(row.map((item) => [item.id === paying.id, item.amount, item.invoice])).toEqual([
      [true, euros(1), null],
      [false, added.amount, added.id],
    ])
    expect(unplacedOf(store.state.workbook!)).toEqual([])
    expect(store.state.workbook!.problems).toEqual([])
  })

  it('joins a payment taken off with the rest of its row, and places only what is open of one larger than the invoice', async () => {
    const { store } = await browserHarness(used, fakeWorkbookDocument(SAVED, 'browser'))
    const invoice = store.state.workbook!.invoices.find((held) => held.number === '10-1-26')!
    const other = store.state.workbook!.invoices.find((held) => held.number === '9-1-26')!
    const itemsBefore = recordsOf(store.state.records!.items)
    const [part] = choicesOf(store, invoice, invoice.client).filter((choice) => choice.named)
    const row = itemsBefore.find((item) => item.id === part!.item)!.row
    const rowItems = (store: Store) =>
      recordsOf(store.state.records!.items)
        .filter((item) => item.row === row)
        .map((item) => [item.amount, item.invoice])
        .sort(([left], [right]) => Number(left) - Number(right))
    const split = rowItems(store)
    expect(split).toHaveLength(2)
    expect(split.filter(([, paid]) => paid === invoice.id)).toEqual([[part!.amount, invoice.id]])
    expect(split.filter(([, paid]) => paid === other.id)).toHaveLength(1)
    const total = addMoney(split[0]![0] as Money, split[1]![0] as Money)

    await store.write('Saved', (unit) => writeInvoice(unit, booksOf(store), invoice, invoice, []))
    await store.write('Saved', (unit) => writeInvoice(unit, booksOf(store), other, other, []))

    const joined = recordsOf(store.state.records!.items).filter((item) => item.row === row)
    expect(joined.map((item) => [item.amount, item.invoice])).toEqual([[total, null]])
    const offered = choicesOf(store, other, other.client)
    const whole = offered.find((choice) => choice.item === joined[0]!.id)!
    expect(whole.amount).toBe(total)

    await store.write('Saved', (unit) =>
      writeInvoice(
        unit,
        booksOf(store),
        other,
        other,
        offered.filter((choice) => choice.named || choice === whole),
      ),
    )

    const open = subtractMoney(other.amount, sumMoney(offered.filter((choice) => choice.named).map((choice) => choice.amount)))
    const placedOn = minMoney(total, open)
    expect(rowItems(store)).toEqual(
      [
        [subtractMoney(total, placedOn), null],
        [placedOn, other.id],
      ]
        .filter(([amount]) => amount !== 0)
        .sort(([left], [right]) => Number(left) - Number(right)),
    )
    expect(store.state.workbook!.problems).toEqual([])
  })

  it('starts placing on books that match their payments, in the same write as the placement, and Undo puts the books back', async () => {
    const { store } = await browserHarness(used, withPaymentsMatched(fakeWorkbookDocument(SAVED, 'browser')))
    const matched = store.state.workbook!
    const itemsBefore = recordsOf(store.state.records!.items)
    const invoice = matched.invoices.find((held) => matchedOf(matched, held).allocations.length > 0)!
    const held = choicesOf(store, invoice, invoice.client).filter((choice) => choice.named)
    expect(held.length).toBeGreaterThan(0)
    const [first, ...rest] = held

    await store.write('Saved', (unit) => writeInvoice(unit, booksOf(store), invoice, invoice, rest))

    const placed = store.state.workbook!
    expect(placed.settings.clientPaymentsPlaced).toBe(true)
    expect(matchedOf(placed, invoice).remaining).toBe(addMoney(matchedOf(matched, invoice).remaining, first!.amount))
    expect(owed(placed).filter(([slug]) => slug !== invoice.client)).toEqual(owed(matched).filter(([slug]) => slug !== invoice.client))
    expect(placed.problems).toEqual([])
    await store.undo(store.state.writes[0]!)
    expect(store.state.workbook!.settings.clientPaymentsPlaced).toBe(false)
    expect(recordsOf(store.state.records!.items)).toEqual(itemsBefore)
  })

  it('leaves the payments and the setting alone when nothing is chosen anew', async () => {
    const { store } = await browserHarness(used, withPaymentsMatched(fakeWorkbookDocument(SAVED, 'browser')))
    const invoice = store.state.workbook!.invoices[0]!
    const itemsBefore = recordsOf(store.state.records!.items)

    await store.write('Saved', (unit) => writeInvoice(unit, booksOf(store), invoice, { ...invoice, item: 'Renamed' }, null))

    expect(store.state.workbook!.settings.clientPaymentsPlaced).toBe(false)
    expect(recordsOf(store.state.records!.items)).toEqual(itemsBefore)
  })
})
