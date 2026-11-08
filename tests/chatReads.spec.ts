import { describe, expect, it, vi } from 'vitest'

import { spendingFigures } from '../src/apps/spending/analytics/presentation/spendingFigures'
import { UNREAD_KINDS, spendingReader } from '../src/apps/spending/assistant/spendingReader'
import * as spendingKinds from '../src/apps/spending/workbook/domain/spendingKinds'
import { findRecords, getRecord, readFigures } from '../src/shared/ai/application/chatReads'
import type { ChatReads, FindRecordsInput } from '../src/shared/ai/application/chatReads'
import { chatRefs } from '../src/shared/ai/domain/chatRefs'
import { NO_RATES } from '../src/shared/money/rateBook'
import { newPseudonyms } from '../src/shared/privacy/domain/pseudonyms'
import { parseMonthKey } from '../src/shared/calendar/monthKey'
import { readableKind } from '../src/shared/app/assistantReader'
import type { AppReader } from '../src/shared/app/assistantReader'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { CHAT_BOOK, CHAT_PERSONS, CHAT_READING, HOSTILE_TEXT, IBAN_OF_ANA } from './fixtures/chatBook'

function readsOf(overrides: Partial<ChatReads> = {}): ChatReads {
  return {
    readers: new Map([['spending', { name: 'Spending', reader: spendingReader(CHAT_READING) }]]),
    pseudonyms: newPseudonyms(),
    refs: chatRefs(),
    anonymising: () => true,
    persons: () => CHAT_PERSONS,
    mayRead: async () => true,
    ...overrides,
  }
}

const ALL: FindRecordsInput = { app: 'spending', kind: 'transaction', query: null, from: null, to: null, about: null, only: null, limit: null, cursor: null }

async function found(input: Partial<FindRecordsInput>, reads: ChatReads) {
  const answer = await findRecords({ ...ALL, ...input }, reads)
  expect(answer.isError).toBe(false)
  return { answer, ...(JSON.parse(answer.text) as { total: number; nextCursor: string | null; untrusted: boolean; records: Record<string, string>[] }) }
}

describe('what a read gives the chat', () => {
  it('runs nothing before the gate says yes, and says so', async () => {
    const rows = vi.fn(() => [])
    const reader = spendingReader(CHAT_READING)
    const reads = readsOf({ mayRead: async () => false, readers: new Map([['spending', { name: 'Spending', reader: { ...reader, kinds: [{ ...reader.kinds[0]!, rows }] } }]]) })
    const answer = await findRecords(ALL, reads)
    expect(answer.isError).toBe(true)
    expect(answer.text).toContain('did not allow')
    expect(rows).not.toHaveBeenCalled()
    expect((await readFigures('spending', 'month', '2026-10', reads)).isError).toBe(true)
  })

  it('sends a flagged payee as an alias under every spelling, a shop and a street as written, and identifiers as masked tokens', async () => {
    const { answer, records } = await found({}, readsOf())
    expect(records.map((record) => record['payee'])).toEqual(['Corner market', 'Person 1', 'Person 1'])
    expect(answer.text).not.toMatch(/Horvat|HORVAT|12345678903/)
    expect(answer.text).not.toContain(IBAN_OF_ANA)
    expect(records[1]).toMatchObject({ counterpartyIban: 'HR•• ••••0160', description: 'Stanarina Person 1, Ilica 15', note: 'OIB [OIB]', amount: { amount: '-600.00 EUR' } })
  })

  it('gives each record amount a figure ref, so the screen shows it as an account amount', async () => {
    const reads = readsOf()
    const { records } = await found({}, reads)
    const { ref } = records[1]!['amount'] as unknown as { ref: string }
    expect(reads.refs.figureOf(ref)).toMatchObject({ of: 'account', cents: -60000, currency: 'EUR' })
  })

  it('aliases only the people Kuna knows, never a name it would have to guess', async () => {
    const { records } = await found({}, readsOf({ persons: () => [] }))
    expect(records.map((record) => record['payee'])).toEqual(['Corner market', 'Ana Horvat', 'HORVAT ANA'])
  })

  it('leaves out every record about an employee while Anonymise is on, and says how many', async () => {
    const employee = [{ name: 'Ana Horvat', employee: true, ibans: [] }]
    const { answer, records, total } = await found({}, readsOf({ persons: () => employee }))
    expect(records.map((record) => record['payee'])).toEqual(['Corner market'])
    expect(total).toBe(1)
    expect(JSON.parse(answer.text).leftOutAboutEmployees).toBe(2)
    expect(answer.text).not.toMatch(/Horvat|HORVAT|-600|-500/)
    const off = await found({}, readsOf({ persons: () => employee, anonymising: () => false }))
    expect(off.total).toBe(3)
    expect(JSON.parse(off.answer.text).leftOutAboutEmployees).toBeUndefined()
  })

  it('leaves out a record paid into an employee’s IBAN, whatever its text names', async () => {
    const employee = [{ name: 'Mia Izmišljena', employee: true, ibans: [IBAN_OF_ANA] }]
    const reads = readsOf({ persons: () => employee })
    expect((await found({}, reads)).total).toBe(1)
    const open = readsOf({ persons: () => employee, anonymising: () => false })
    const { records } = await found({}, open)
    const answer = await getRecord('spending', records[1]!['ref']!, readsOf({ persons: () => employee, refs: open.refs }))
    expect(answer.isError).toBe(true)
    expect(answer.text).toContain('Anonymise')
  })

  it('sends a stranger’s text as data, marked as untrusted, without obeying or dropping it', async () => {
    const { untrusted, records } = await found({ query: 'Corner' }, readsOf())
    expect(untrusted).toBe(true)
    expect(records[0]!['description']).toBe(HOSTILE_TEXT)
  })

  it('never hands over a field the kind keeps back', async () => {
    const reads = readsOf()
    const { answer } = await found({}, reads)
    expect(answer.text).not.toContain('made-up-import-key')
    const { answer: receipts } = await found({ kind: 'receipt' }, reads)
    expect(receipts.text).not.toMatch(/made-up-jir|made-up-zki|made-up-drive-file|45\.81|15\.98/)
    expect((await findRecords({ ...ALL, kind: 'setting' }, reads)).isError).toBe(true)
  })

  it('sends real names with the setting off, and the model loop still cuts identifiers', async () => {
    const { records } = await found({}, readsOf({ anonymising: () => false }))
    expect(records[1]!['payee']).toBe('Ana Horvat')
    expect(records[1]!['counterpartyIban']).toBe(IBAN_OF_ANA)
  })

  it('finds every spelling of a person by the alias, and no identifier by its digits', async () => {
    const reads = readsOf()
    await found({}, reads)
    expect((await found({ query: 'Person 1' }, reads)).total).toBe(2)
    expect((await found({ query: '1001005186' }, reads)).total).toBe(0)
  })

  it('never matches inside a name that goes out as an alias, so a search cannot spell one out', async () => {
    const reads = readsOf()
    expect((await found({ query: 'hor' }, reads)).total).toBe(0)
    expect((await found({ query: 'Ana Horvat' }, reads)).total).toBe(0)
    expect((await found({ query: 'Person 1' }, reads)).total).toBe(2)
    expect((await found({ query: 'hor' }, readsOf({ anonymising: () => false }))).total).toBe(2)
  })

  it('pages newest first and caps what a page holds', async () => {
    const reads = readsOf()
    const first = await found({ limit: 2 }, reads)
    expect(first.records.map((record) => record['date'])).toEqual(['2026-10-12', '2026-10-05'])
    expect(first.nextCursor).toBe('2')
    const second = await found({ limit: 2, cursor: first.nextCursor! }, reads)
    expect(second.records.map((record) => record['date'])).toEqual(['2026-09-05'])
    expect(second.nextCursor).toBeNull()
    expect((await found({ limit: 100_000 }, reads)).records.length).toBeLessThanOrEqual(50)
  })

  it('filters by days and by a ref', async () => {
    const reads = readsOf()
    expect((await found({ from: '2026-10', to: '2026-10' }, reads)).total).toBe(2)
    const { records } = await found({}, reads)
    expect((await found({ about: records[1]!['category']! }, reads)).total).toBe(2)
  })

  it('reads one record only by a ref it handed out in this app', async () => {
    const reads = readsOf()
    const { records } = await found({}, reads)
    const answer = await getRecord('spending', records[1]!['ref']!, reads)
    expect(JSON.parse(answer.text).record.payee).toBe('Person 1')
    expect((await getRecord('spending', 'transaction-99', reads)).isError).toBe(true)
    expect((await getRecord('spending', 'transaction-3', readsOf())).isError).toBe(true)
    expect((await getRecord('loans', records[1]!['ref']!, reads)).isError).toBe(true)
  })

  it('says when the file is not open, instead of reading nothing as if it were empty', async () => {
    const reads = readsOf({ readers: new Map([['spending', { name: 'Spending', reader: spendingReader({ ...CHAT_READING, status: () => 'opening' }) }]]) })
    expect((await findRecords(ALL, reads)).text).toContain('still opening')
  })
})

describe('the figures of a read', () => {
  const month = parseMonthKey('2026-10')!

  it('come from the functions the screens use', async () => {
    const answer = await readFigures('spending', 'month', '2026-10', readsOf())
    const { figures } = JSON.parse(answer.text) as { figures: { label: string; amount?: string; ref?: string }[] }
    const totals = spendingFigures(CHAT_BOOK, NO_RATES).totalsOf(month)
    expect(totals.spent).toBe(64530)
    expect(figures[0]).toEqual({ ref: 'f1', label: 'spent', amount: '645.30 EUR' })
  })

  it('leave out the savings rate of a month with no income, and flag a rate no tool gave', async () => {
    const reads = readsOf()
    await readFigures('spending', 'month', '2026-11', reads)
    const inOctober = JSON.parse((await readFigures('spending', 'month', '2026-10', reads)).text) as { figures: { label: string; rate?: string }[] }
    expect(inOctober.figures.some((figure) => figure.rate !== undefined)).toBe(false)
    expect(reads.refs.holdsStrayFigure('A rate of 12%')).toBe(true)
    reads.refs.noteRate(1200)
    expect(reads.refs.holdsStrayFigure('A rate of 12%')).toBe(false)
  })

  it('answer why a month was higher, with the change Kuna worked out', async () => {
    const answer = await readFigures('spending', 'categories', '2026-10', readsOf())
    const { figures } = JSON.parse(answer.text) as { figures: { label: string; amount: string }[] }
    expect(figures.find((figure) => figure.label === 'Rent: change')?.amount).toBe('100.00 EUR')
  })

  it('keep their ref while the amount holds, and name a limit and a balance', async () => {
    const reads = readsOf()
    await readFigures('spending', 'month', '2026-10', reads)
    const again = JSON.parse((await readFigures('spending', 'month', '2026-10', reads)).text) as { figures: { ref?: string }[] }
    expect(again.figures[0]!.ref).toBe('f1')
    expect((await readFigures('spending', 'limits', '2026-10', reads)).text).toContain('Food: left')
    expect((await readFigures('spending', 'balances', '2026-10-31', reads)).text).toContain('Current')
  })

  it.each(['2026', 'October', '2026-13', '2026-10-32'])('refuse a period that reads as none: %s', async (period) => {
    expect((await readFigures('spending', 'month', period, readsOf())).isError).toBe(true)
  })

  it('refuse a report Kuna does not have', async () => {
    expect((await readFigures('spending', 'kuna-secrets.json', null, readsOf())).isError).toBe(true)
  })

  it('flag an amount in an answer no tool returned, and pass one a tool did, however it is written', async () => {
    const reads = readsOf()
    await readFigures('spending', 'month', '2026-10', reads)
    await found({}, reads)
    expect(reads.refs.holdsStrayFigure('You spent [f1], which is €645.30 or 645,30 €, and 1,234.56 is not.')).toBe(true)
    expect(reads.refs.holdsStrayFigure('You spent [f1], which is €645.30 or 645,30 €.')).toBe(false)
    expect(reads.refs.holdsStrayFigure('Person 1 got 600,00 €.')).toBe(false)
    expect(reads.refs.holdsStrayFigure('Paid Person 3 €45.30, see transaction-2 €45.30')).toBe(false)
    expect(reads.refs.holdsStrayFigure('You spent [f99].')).toBe(true)
  })

  it('do not take an amount in a stranger’s text as one Kuna gave', () => {
    const refs = chatRefs()
    expect(refs.holdsStrayFigure('Your total is 9,999.00.')).toBe(true)
  })
})

describe('what Spending lets the chat read', () => {
  it('names every kind it stores, as read or as kept out', () => {
    const reader = spendingReader(CHAT_READING)
    expect([...reader.kinds.map((kind) => kind.name), ...UNREAD_KINDS].sort()).toEqual(
      Object.values(spendingKinds)
        .map((kind) => kind.name)
        .sort(),
    )
  })

  it('classes an address as a place to reach nobody on a receipt, and no setting value can leave', () => {
    const fields = spendingReader(CHAT_READING).kinds.find((kind) => kind.name === 'receipt')!.fields
    expect(fields.filter((field) => field.exposure === 'never').map((field) => field.name)).toEqual(['jir', 'zki', 'photo', 'latitude', 'longitude'])
    expect(UNREAD_KINDS).toContain(spendingKinds.SETTING_RECORDS.name)
  })
})

describe('a search kept to a set', () => {
  const waiting = { ...CHAT_BOOK.transactions[1]!, id: recordIdOf(spendingKinds.TRANSACTION_RECORDS, 'transaction-9'), category: null }
  const reading = { ...CHAT_READING, book: () => ({ ...CHAT_BOOK, transactions: [...CHAT_BOOK.transactions, waiting] }) }
  const reads = () => readsOf({ readers: new Map([['spending', { name: 'Spending', reader: spendingReader(reading) }]]) })

  it('keeps to the rows waiting on To review', async () => {
    const { total, records } = await found({ only: 'waiting' }, reads())
    expect(total).toBe(1)
    expect(records[0]!['category']).toBeUndefined()
    expect((await found({}, reads())).total).toBe(4)
  })

  it.each([
    ['transaction', 'filed'],
    ['account', 'waiting'],
  ])('refuses on %s a set it does not name, %j, and repeats nothing', async (kind, only) => {
    const answer = await findRecords({ ...ALL, kind, only }, reads())
    expect(answer.isError).toBe(true)
    if (kind === 'transaction') expect(answer.text).not.toContain(only)
  })
})

interface Holder {
  readonly id: string
  readonly ibans: readonly string[]
  readonly names: readonly string[]
}

describe('a field that holds a list', () => {
  const holder: Holder = { id: 'holder:1', ibans: [IBAN_OF_ANA, 'HR6523400091110000001'], names: ['Ana Horvat', 'Corner market'] }
  const kind = readableKind<Holder>({
    kind: { name: 'holder', noun: spendingKinds.TRANSACTION_RECORDS.noun },
    about: 'Holders.',
    fields: {
      id: { exposure: 'ref', to: 'holder', meaning: 'The holder.' },
      ibans: { exposure: 'identifier', meaning: 'Every IBAN it names.' },
      names: { exposure: 'party', meaning: 'Who it names.' },
    },
    dated: null,
    rows: () => [holder],
    currencyOf: () => 'EUR',
  })
  const reader: AppReader = { status: () => 'open', kinds: [kind], reports: [] }
  const listReads = (overrides: Partial<ChatReads> = {}) => readsOf({ readers: new Map([['spending', { name: 'Spending', reader }]]), ...overrides })

  it('sends each text of the list under its token or alias while Anonymise is on', async () => {
    const { answer, records } = await found({ kind: 'holder' }, listReads())
    expect(records[0]).toMatchObject({ ibans: ['HR•• ••••0160', 'HR•• ••••0001'], names: ['Person 1', 'Corner market'] })
    expect(answer.text).not.toMatch(/Horvat|1001005186|2340009111/)
  })

  it('matches a query in a list as it leaves, and never an identifier in it', async () => {
    const reads = listReads()
    expect((await found({ kind: 'holder', query: 'Corner' }, reads)).total).toBe(1)
    expect((await found({ kind: 'holder', query: 'Horvat' }, reads)).total).toBe(0)
    expect((await found({ kind: 'holder', query: '10010051' }, reads)).total).toBe(0)
  })

  it('keeps the record home when a list names an employee or an IBAN one is paid into', async () => {
    expect((await found({ kind: 'holder' }, listReads({ persons: () => [{ name: 'Ana Horvat', employee: true, ibans: [] }] }))).total).toBe(0)
    expect((await found({ kind: 'holder' }, listReads({ persons: () => [{ name: 'Mia Izmišljena', employee: true, ibans: [IBAN_OF_ANA] }] }))).total).toBe(0)
  })

  it('sends the list as stored with Anonymise off', async () => {
    const { records } = await found({ kind: 'holder' }, listReads({ anonymising: () => false }))
    expect(records[0]).toMatchObject({ ibans: [IBAN_OF_ANA, 'HR6523400091110000001'], names: ['Ana Horvat', 'Corner market'] })
  })
})
