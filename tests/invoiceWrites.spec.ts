import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { changeInvoice, removeInvoice } from '../src/apps/company/receivables/application/invoiceWrites'
import { receivablesOf } from '../src/apps/company/receivables/domain/invoiceMatching'
import { presentedWorkbook } from '../src/apps/company/transactions/domain/presentedWorkbook'
import { invoiceIdOf } from '../src/apps/company/workbook/domain/invoicesReading'
import { fakeWorkbookDocument } from '../src/apps/company/workbook/infrastructure/fake/fakeWorkbook'
import type { RecordId } from '../src/shared/storage/domain/recordId'
import { recordsOf } from '../src/shared/storage/domain/recordsRead'
import { browserHarness, forgetCaches } from './fixtures/writeBack'
import type { WriteBackHarness } from './fixtures/writeBack'

const used = new Set<string>()

afterEach(async () => {
  await forgetCaches(used)
})

type Store = WriteBackHarness['store']

async function paidInvoice() {
  const { store } = await browserHarness(used, fakeWorkbookDocument('2026-10-16T09:00:00.000Z', 'browser'))
  const paid = [...store.state.workbook!.paidInvoices!.values()][0]!
  const invoice = recordsOf(store.state.records!.invoices).find((held) => held.id === paid)!
  return { store, invoice }
}

function itemsPaying(store: Store, invoice: RecordId | null) {
  return recordsOf(store.state.records!.items)
    .filter((item) => item.invoice === invoice)
    .map((item) => item.id)
}

function owedOn(store: Store, invoice: RecordId) {
  const matched = receivablesOf(presentedWorkbook(store.state.workbook!))
    .clients.flatMap((client) => client.invoices)
    .find((held) => held.invoice.id === invoice)!
  return [matched.remaining, matched.status, matched.received]
}

describe('an invoice its payments are placed on', () => {
  it('takes its payments along to a new number, and Undo puts both back', async () => {
    const { store, invoice } = await paidInvoice()
    const paying = itemsPaying(store, invoice.id)
    const owed = owedOn(store, invoice.id)
    const renumbered = { ...invoice, number: '99-1-26', id: invoiceIdOf({ client: invoice.client, number: '99-1-26' }) }

    await store.write('Saved', (unit) => changeInvoice(unit, store.state.records!.items, invoice, renumbered))

    expect(itemsPaying(store, renumbered.id)).toEqual(paying)
    expect(itemsPaying(store, invoice.id)).toEqual([])
    expect(owedOn(store, renumbered.id)).toEqual(owed)
    expect(store.state.workbook!.problems).toEqual([])
    await store.undo(store.state.writes[0]!)
    expect(itemsPaying(store, invoice.id)).toEqual(paying)
  })

  it('frees its payments when it is deleted, so they wait to be placed, and Undo puts both back', async () => {
    const { store, invoice } = await paidInvoice()
    const paying = itemsPaying(store, invoice.id)

    await store.write('Deleted', (unit) => removeInvoice(unit, store.state.records!.items, invoice))

    expect(itemsPaying(store, invoice.id)).toEqual([])
    expect(store.state.workbook!.problems).toEqual([])
    const unplaced = receivablesOf(presentedWorkbook(store.state.workbook!)).clients.find((client) => client.client.slug === invoice.client)!.unplaced ?? []
    expect(unplaced.length).toBeGreaterThan(0)
    await store.undo(store.state.writes[0]!)
    expect(itemsPaying(store, invoice.id)).toEqual(paying)
  })
})
