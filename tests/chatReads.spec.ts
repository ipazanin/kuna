import { describe, expect, it, vi } from 'vitest'

import { spendingFigures } from '../src/apps/spending/analytics/domain/spendingFigures'
import { BANK_ACCOUNT_LINES } from '../src/apps/spending/bankSync/domain/bankAccountSetup'
import { BANK_SYNC_LINES, PAYEE_LINES, UNREAD_KINDS, spendingReader } from '../src/apps/spending/assistant/spendingReader'
import * as spendingKinds from '../src/apps/spending/workbook/domain/spendingKinds'
import { wholeItemOf } from '../src/apps/spending/workbook/domain/rowItems'
import { findRecords, getRecord, readFigures, recordKeptHome } from '../src/shared/ai/application/chatReads'
import type { ChatReads, FindRecordsInput } from '../src/shared/ai/application/chatReads'
import { MOST_CHARACTERS_A_READ } from '../src/shared/ai/domain/chatAttachments'
import { fileNotOpen } from '../src/shared/app/assistantOperations'
import { chatRefs } from '../src/shared/ai/domain/chatRefs'
import { NO_RATES } from '../src/shared/money/rateBook'
import { newPseudonyms } from '../src/shared/privacy/domain/pseudonyms'
import { parseMonthKey } from '../src/shared/calendar/monthKey'
import { readableKind } from '../src/shared/app/assistantReader'
import type { AppReader } from '../src/shared/app/assistantReader'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import type { RecordId } from '../src/shared/storage/domain/recordId'
import { CHAT_BOOK, CHAT_PERSONS, CHAT_READING, HOSTILE_TEXT, IBAN_OF_ANA } from './fixtures/chatBook'
import type { AppTargets, CompanyMoney, LinkTarget } from '../src/apps/spending/links/domain/linkTarget'
import { moneyFromAmount } from '../src/shared/money/money'
import { civilDate } from '../src/shared/calendar/civilDate'
import { words } from '../src/apps/spending/assistant/words'

function readsOf(overrides: Partial<ChatReads> = {}): ChatReads {
  return {
    readers: new Map([['spending', { name: 'Spending', reader: spendingReader(CHAT_READING) }]]),
    pseudonyms: newPseudonyms(),
    refs: chatRefs(),
    anonymising: () => true,
    persons: () => CHAT_PERSONS,
    mayRead: () => true,
    ...overrides,
  }
}

const ALL: FindRecordsInput = { app: 'spending', kind: 'transaction', query: null, from: null, to: null, refs: [], filters: [], sort: [], fields: [], only: null, limit: null, cursor: null }

async function found(input: Partial<FindRecordsInput>, reads: ChatReads) {
  const answer = await findRecords({ ...ALL, ...input }, reads)
  expect(answer.isError).toBe(false)
  return { answer, ...(JSON.parse(answer.text) as { total: number; nextCursor: string | null; untrusted: boolean; records: Record<string, string>[] }) }
}

describe('what a read gives the chat', () => {
  it('runs nothing before the gate says yes, and says so', async () => {
    const rows = vi.fn(() => [])
    const reader = spendingReader(CHAT_READING)
    const reads = readsOf({ mayRead: () => false, readers: new Map([['spending', { name: 'Spending', reader: { ...reader, kinds: [{ ...reader.kinds[0]!, rows }] } }]]) })
    const answer = await findRecords(ALL, reads)
    expect(answer.isError).toBe(true)
    expect(answer.text).toBe('The person has not allowed the chat to read their books.')
    expect(rows).not.toHaveBeenCalled()
    expect((await readFigures('spending', 'month', '2026-10', reads)).isError).toBe(true)
  })

  it('sends a flagged payee as an alias under every spelling, a shop and a street as written, and identifiers as masked tokens', async () => {
    const { answer, records } = await found({}, readsOf())
    expect(records.map((record) => record['payee'])).toEqual(['Corner market', 'Person 1', 'Person 1'])
    expect(answer.text).not.toMatch(/Horvat|HORVAT|12345678903/)
    expect(answer.text).not.toContain(IBAN_OF_ANA)
    expect(records[1]).toMatchObject({ counterpartyIban: 'HR•• ••••0160', description: 'Stanarina Person 1, Ilica 15', amount: { amount: '-600.00 EUR' } })
    const items = await found({ kind: 'item' }, readsOf())
    expect(items.records.map((record) => record['note'])).toContain('OIB [OIB]')
    expect(items.answer.text).not.toMatch(/12345678903/)
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

  describe('a row linked to a payment from your company', () => {
    const link = { app: 'company', kind: 'ledger-row', key: 'row-salary', due: null }
    const linked = recordIdOf(spendingKinds.TRANSACTION_RECORDS, 'transaction-2')
    const book = { ...CHAT_BOOK, items: CHAT_BOOK.items.map((item) => (item.transaction === linked ? { ...item, link } : item)) }
    const paymentOf = (kind: CompanyMoney): LinkTarget => ({
      kind: 'owner-payment',
      link,
      day: civilDate(2026, 10, 12),
      amount: moneyFromAmount(45.3),
      direction: 'to-owner',
      ownerIban: IBAN_OF_ANA,
      parts: [{ kind, amount: moneyFromAmount(45.3) }],
    })
    const readsWith = (company: AppTargets<LinkTarget>, anonymising = true) =>
      readsOf({
        anonymising: () => anonymising,
        readers: new Map([
          [
            'spending',
            {
              name: 'Spending',
              reader: spendingReader({ ...CHAT_READING, book: () => book, linkTargets: (app) => (app === 'company' ? company : null), linkSource: (app) => (app === 'company' ? 'company' : 'loans') }),
            },
          ],
        ]),
      })

    it('stays home with its part while Anonymise is on when the payment is salary, a travel allowance or other tax-free pay', async () => {
      for (const kind of ['salary', 'travel-allowance', 'tax-free-pay'] as const) {
        const reads = readsWith([paymentOf(kind)])
        expect((await found({}, reads)).total).toBe(2)
        expect((await found({ kind: 'item' }, reads)).total).toBe(2)
        expect(recordKeptHome('spending', 'transaction', linked, reads)).toBe(true)
      }
    })

    it('leaves as before when the payment is rent or a profit payout, or while Anonymise is off', async () => {
      expect((await found({}, readsWith([paymentOf('rent')]))).total).toBe(3)
      expect((await found({}, readsWith([paymentOf('profit-payout')]))).total).toBe(3)
      expect((await found({}, readsWith([paymentOf('salary')], false))).total).toBe(3)
    })

    it('reads the part’s link as the payment, its kinds and its day, or in Company’s words when the payment is gone or Company is not set up', async () => {
      const linkOf = async (company: AppTargets<LinkTarget>) => (await found({ kind: 'item' }, readsWith(company, false))).records.map((record) => record['link']).filter((read) => read !== undefined)

      expect(await linkOf([paymentOf('salary')])).toEqual([words.reads.linkCompanyPayment('salary', '2026-10-12', true)])
      expect(await linkOf([])).toEqual([words.reads.linkCompanyGone])
      expect(await linkOf(null)).toEqual([words.reads.linkCompanyNotSetUp])
    })

    it('stays home while Company is opening, did not open or keeps no owner pay, since then no one can tell it is not pay', async () => {
      for (const company of ['opening', 'failed', null] as const) expect((await found({}, readsWith(company))).total).toBe(2)
      expect((await found({}, readsWith([]))).total).toBe(3)
    })
  })

  it('reads the owner’s own account and the rows paid to it when the company pays the owner into it, and keeps the company’s pay rows home', async () => {
    const director = [{ name: 'Mia Izmišljena', employee: true, ibans: [IBAN_OF_ANA] }]
    const ownAccount = { ...CHAT_BOOK.accounts[0]!, id: recordIdOf(spendingKinds.ACCOUNT_RECORDS, 'account-b'), name: 'Salary account', iban: IBAN_OF_ANA }
    const spending = spendingReader({ ...CHAT_READING, book: () => ({ ...CHAT_BOOK, accounts: [...CHAT_BOOK.accounts, ownAccount] }) })
    const payRows = readableKind({
      kind: { name: 'ledger-row', noun: spendingKinds.TRANSACTION_RECORDS.noun },
      about: 'A bank row of the company.',
      fields: { id: { exposure: 'ref', to: 'ledger-row', meaning: 'The row.' }, counterpartyIban: { exposure: 'identifier', meaning: 'Who it was paid to.' } },
      dated: null,
      rows: () => [{ id: 'ledger-row:salary', counterpartyIban: IBAN_OF_ANA }],
      currencyOf: () => 'EUR',
    })
    const company: AppReader = { status: () => 'open', kinds: [payRows], reports: [] }
    const reads = readsOf({
      persons: () => director,
      readers: new Map([
        ['spending', { name: 'Spending', reader: spending }],
        ['company', { name: 'Company', reader: company }],
      ]),
    })

    expect((await found({ kind: 'account' }, reads)).total).toBe(2)
    expect((await found({}, reads)).total).toBe(3)
    expect((await found({ app: 'company', kind: 'ledger-row' }, reads)).total).toBe(0)
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

  it('sends real names with the setting off, and identifiers under tokens still', async () => {
    const { answer, records } = await found({}, readsOf({ anonymising: () => false }))
    expect(records[1]).toMatchObject({ payee: 'Ana Horvat', counterpartyIban: 'HR•• ••••0160' })
    expect((await found({ kind: 'item' }, readsOf({ anonymising: () => false }))).records.map((record) => record['note'])).toContain('OIB [OIB]')
    expect(answer.text).not.toMatch(/12345678903|1001005/)
  })

  it('filters by an identifier’s token with the setting off, and finds no identifier by its digits', async () => {
    const reads = readsOf({ anonymising: () => false })
    await found({}, reads)
    expect((await found({ filters: [{ field: 'counterpartyIban', op: 'is', values: ['HR•• ••••0160'] }] }, reads)).total).toBe(2)
    expect((await findRecords({ ...ALL, filters: [{ field: 'counterpartyIban', op: 'is', values: [IBAN_OF_ANA] }] }, reads)).isError).toBe(true)
    expect((await found({ query: '12345678903' }, reads)).total).toBe(0)
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
    expect((await found({ limit: 100_000 }, reads)).records.length).toBeLessThanOrEqual(200)
  })

  it('filters by days and by a ref', async () => {
    const reads = readsOf()
    expect((await found({ from: '2026-10', to: '2026-10' }, reads)).total).toBe(2)
    const { records } = await found({ kind: 'item' }, reads)
    expect((await found({ kind: 'item', refs: [records[0]!['category']!] }, reads)).total).toBe(2)
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

  it('says when the file is not open, naming the app, instead of reading nothing as if it were empty', async () => {
    const readsWhile = (status: 'opening' | 'none') => readsOf({ readers: new Map([['spending', { name: 'Spending', reader: spendingReader({ ...CHAT_READING, status: () => status }) }]]) })
    expect((await findRecords(ALL, readsWhile('opening'))).text).toBe('Spending is still opening its file. Ask the person to try again in a moment.')
    expect((await findRecords(ALL, readsWhile('none'))).text).toBe(fileNotOpen('Spending').join(' '))
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
  it('names every kind it stores, as read or as kept out, and reads the bank set-up list, the bank sync line and the payees beside them', () => {
    const reader = spendingReader(CHAT_READING)
    const lines = [BANK_ACCOUNT_LINES.name, BANK_SYNC_LINES.name, PAYEE_LINES.name]
    const stored = reader.kinds.map((kind) => kind.name).filter((name) => !lines.includes(name))
    expect(reader.kinds.map((kind) => kind.name)).toEqual(expect.arrayContaining(lines))
    expect([...stored, ...UNREAD_KINDS].sort()).toEqual(
      Object.values(spendingKinds)
        .map((kind) => kind.name)
        .sort(),
    )
  })

  it('sends each payee and the payees report with a person under their alias and IBANs as masked tokens', async () => {
    const payees = await found({ kind: 'payee' }, readsOf())
    expect(payees.records.map((record) => record['name'])).toEqual(['Corner market', 'Person 1', 'Person 1'])
    expect(payees.answer.text).not.toMatch(/Horvat|HORVAT/)
    expect(payees.answer.text).not.toContain(IBAN_OF_ANA)
    const report = await readFigures('spending', 'payees', '2026-10-31', readsOf())
    expect(report.isError).toBe(false)
    expect(report.text).toContain('Person 1: paid')
    expect(report.text).not.toMatch(/Horvat|HORVAT/)
  })

  it('classes an address as a place to reach nobody on a receipt, and no setting value can leave', () => {
    const fields = spendingReader(CHAT_READING).kinds.find((kind) => kind.name === 'receipt')!.fields
    expect(fields.filter((field) => field.exposure === 'never').map((field) => field.name)).toEqual(['jir', 'zki', 'photo', 'latitude', 'longitude'])
    expect(UNREAD_KINDS).toContain(spendingKinds.SETTING_RECORDS.name)
  })
})

describe('a search with filters, a sort and fields', () => {
  const payees = (answer: { records: Record<string, unknown>[] }) => answer.records.map((record) => record['payee'])
  const amounts = (answer: { records: Record<string, unknown>[] }) => answer.records.map((record) => (record['amount'] as { amount: string }).amount)

  it("ranges an amount as decimal text in the account's own currency", async () => {
    const reads = readsOf()
    expect((await found({ filters: [{ field: 'amount', op: 'at-most', values: ['-100'] }] }, reads)).total).toBe(2)
    expect(payees(await found({ filters: [{ field: 'amount', op: 'at-least', values: ['-100.00'] }] }, reads))).toEqual(['Corner market'])
    expect((await found({ filters: [{ field: 'amount', op: 'is', values: ['-45.3'] }] }, reads)).total).toBe(1)
    expect((await findRecords({ ...ALL, filters: [{ field: 'amount', op: 'at-least', values: ['-12,50'] }] }, reads)).isError).toBe(true)
  })

  it('sorts by any read field either way, and newest first when no sort is given', async () => {
    const reads = readsOf()
    expect(amounts(await found({ sort: [{ field: 'amount', direction: 'ascending' }] }, reads))).toEqual(['-600.00 EUR', '-500.00 EUR', '-45.30 EUR'])
    expect(amounts(await found({ sort: [{ field: 'amount', direction: 'descending' }] }, reads))).toEqual(['-45.30 EUR', '-500.00 EUR', '-600.00 EUR'])
    expect((await found({}, reads)).records.map((record) => record['date'])).toEqual(['2026-10-12', '2026-10-05', '2026-09-05'])
  })

  it('breaks a tie in the sort by the record id, so pages hold the same records from one call to the next', async () => {
    const reads = readsOf()
    const samePayee = await found({ sort: [{ field: 'payee', direction: 'ascending' }], filters: [{ field: 'payee', op: 'is', values: ['Person 1'] }] }, reads)
    expect(samePayee.records.map((record) => record['date'])).toEqual(['2026-09-05', '2026-10-05'])
  })

  it('matches a person on the alias they leave under, never on the real name the model types', async () => {
    const reads = readsOf()
    await found({}, reads)
    expect((await found({ filters: [{ field: 'payee', op: 'is', values: ['Person 1'] }] }, reads)).total).toBe(2)
    expect((await found({ filters: [{ field: 'payee', op: 'is', values: ['Ana Horvat'] }] }, reads)).total).toBe(0)
    expect((await found({ filters: [{ field: 'description', op: 'contains', values: ['Horvat'] }] }, reads)).total).toBe(0)
    expect((await found({ filters: [{ field: 'payee', op: 'not', values: ['Person 1'] }] }, reads)).total).toBe(1)
  })

  it('filters an identifier only by a token a read handed out, and refuses its digits without repeating them', async () => {
    const reads = readsOf()
    await found({}, reads)
    expect((await found({ filters: [{ field: 'counterpartyIban', op: 'is', values: ['HR•• ••••0160'] }] }, reads)).total).toBe(2)
    const raw = await findRecords({ ...ALL, filters: [{ field: 'counterpartyIban', op: 'is', values: [IBAN_OF_ANA] }] }, reads)
    expect(raw.isError).toBe(true)
    expect(raw.text).not.toContain('1001005')
    expect((await findRecords({ ...ALL, filters: [{ field: 'counterpartyIban', op: 'contains', values: ['HR12'] }] }, reads)).isError).toBe(true)
    expect((await findRecords({ ...ALL, sort: [{ field: 'counterpartyIban', direction: 'ascending' }] }, reads)).isError).toBe(true)
  })

  it('filters a ref field by refs Kuna handed out, and by whether it is empty', async () => {
    const reads = readsOf()
    const { records } = await found({ kind: 'item' }, reads)
    expect((await found({ kind: 'item', filters: [{ field: 'category', op: 'is', values: [records[0]!['category']!] }] }, reads)).total).toBe(2)
    expect((await found({ kind: 'item', filters: [{ field: 'category', op: 'not', values: [records[0]!['category']!] }] }, reads)).total).toBe(1)
    expect((await found({ kind: 'item', filters: [{ field: 'category', op: 'empty', values: [] }] }, reads)).total).toBe(0)
    expect((await findRecords({ ...ALL, kind: 'item', filters: [{ field: 'category', op: 'is', values: ['category-1'] }] }, readsOf())).isError).toBe(true)
  })

  it('refuses a ref of another kind on a ref field by both kinds, rather than finding nothing', async () => {
    const reads = readsOf()
    const { records } = await found({}, reads)
    const answer = await findRecords({ ...ALL, kind: 'item', filters: [{ field: 'category', op: 'is', values: [records[1]!['account']!] }] }, reads)
    expect(answer).toEqual({ text: 'category takes refs of the kind category, and that ref is of the kind account.', isError: true })
  })

  it('refuses a field the kind never reads or does not have, naming the fields it reads', async () => {
    for (const field of ['importKey', 'secret']) {
      const answer = await findRecords({ ...ALL, filters: [{ field, op: 'not-empty', values: [] }] }, readsOf())
      expect(answer.isError).toBe(true)
      expect(answer.text).toContain('payee')
      expect(answer.text).not.toContain(field)
    }
    expect((await findRecords({ ...ALL, fields: ['importKey'] }, readsOf())).isError).toBe(true)
    expect((await findRecords({ ...ALL, sort: [{ field: 'importKey', direction: 'ascending' }] }, readsOf())).isError).toBe(true)
  })

  it('refuses an op a field does not take, and a range on words', async () => {
    const answer = await findRecords({ ...ALL, filters: [{ field: 'payee', op: 'at-least', values: ['A'] }] }, readsOf())
    expect(answer.isError).toBe(true)
    expect(answer.text).toContain('payee takes is, one-of, not, contains, empty, not-empty')
    expect((await findRecords({ ...ALL, filters: [{ field: 'date', op: 'at-least', values: ['soon'] }] }, readsOf())).isError).toBe(true)
  })

  it('sends only the fields asked for, and the ref always', async () => {
    const { records } = await found({ fields: ['payee'] }, readsOf())
    expect(Object.keys(records[0]!)).toEqual(['ref', 'payee'])
  })

  it('counts records about employees before the filters on fields, so the count says nothing about them', async () => {
    const employee = [{ name: 'Ana Horvat', employee: true, ibans: [] }]
    const answer = await found({ filters: [{ field: 'amount', op: 'at-most', values: ['-550'] }] }, readsOf({ persons: () => employee }))
    expect(answer.total).toBe(0)
    expect(JSON.parse(answer.answer.text).leftOutAboutEmployees).toBe(2)
  })
})

describe('a page of long records', () => {
  interface Note {
    readonly id: string
    readonly text: string
  }
  const notes: Note[] = Array.from({ length: 200 }, (_, at) => ({ id: `note:${String(at).padStart(3, '0')}`, text: 'x'.repeat(1000) }))
  const kind = readableKind<Note>({
    kind: { name: 'note', noun: spendingKinds.TRANSACTION_RECORDS.noun },
    about: 'Notes.',
    fields: { id: { exposure: 'ref', to: 'note', meaning: 'The note.' }, text: { exposure: 'plain', meaning: 'Its text.' } },
    dated: null,
    rows: () => notes,
    currencyOf: () => 'EUR',
  })
  const reads = () => readsOf({ readers: new Map([['spending', { name: 'Spending', reader: { status: () => 'open', kinds: [kind], reports: [] } }]]) })

  it('stops at the most characters a read takes and gives the cursor where it stopped', async () => {
    const first = await found({ kind: 'note', limit: 200 }, reads())
    expect(first.answer.text.length).toBeLessThanOrEqual(MOST_CHARACTERS_A_READ)
    expect(first.records.length).toBeGreaterThan(20)
    expect(first.records.length).toBeLessThan(200)
    expect(first.nextCursor).toBe(String(first.records.length))
  })
})

describe('a search kept to a set', () => {
  const waiting = { ...CHAT_BOOK.transactions[1]!, id: recordIdOf(spendingKinds.TRANSACTION_RECORDS, 'transaction-9') }
  const book = { ...CHAT_BOOK, transactions: [...CHAT_BOOK.transactions, waiting], items: [...CHAT_BOOK.items, wholeItemOf(waiting, { category: null, note: '', link: null, labels: [] })] }
  const reading = { ...CHAT_READING, book: () => book }
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

  it('sends names as stored with Anonymise off, and each IBAN of the list under its token', async () => {
    const { records } = await found({ kind: 'holder' }, listReads({ anonymising: () => false }))
    expect(records[0]).toMatchObject({ ibans: ['HR•• ••••0160', 'HR•• ••••0001'], names: ['Ana Horvat', 'Corner market'] })
  })
})

interface Bundle {
  readonly id: string
  readonly parts: readonly RecordId[]
  readonly lead: RecordId | null
}

describe('a field that holds a list of refs', () => {
  const part = (key: string) => recordIdOf(spendingKinds.ITEM_RECORDS, key)
  const bundles: Bundle[] = [
    { id: 'bundle:1', parts: [part('p1'), part('p2')], lead: part('p1') },
    { id: 'bundle:2', parts: [], lead: null },
  ]
  const kind = readableKind<Bundle>({
    kind: { name: 'bundle', noun: spendingKinds.TRANSACTION_RECORDS.noun },
    about: 'Bundles.',
    fields: {
      id: { exposure: 'ref', to: 'bundle', meaning: 'The bundle.' },
      parts: { exposure: 'ref', to: 'item', list: true, meaning: 'Its parts.' },
      lead: { exposure: 'ref', to: 'item', meaning: 'Its first part.' },
    },
    dated: null,
    rows: () => bundles,
    currencyOf: () => 'EUR',
  })
  const reader: AppReader = { status: () => 'open', kinds: [kind], reports: [] }
  const listReads = () => readsOf({ readers: new Map([['spending', { name: 'Spending', reader }]]) })

  it('sends a list as a ref for each id, an empty list as nothing, and a single ref as one', async () => {
    const { records } = await found({ kind: 'bundle' }, listReads())
    const parts = records[0]!['parts'] as unknown as readonly string[]
    expect(parts).toHaveLength(2)
    expect(records[0]!['lead']).toBe(parts[0])
    expect(records[1]).not.toHaveProperty('parts')
    expect(records[1]).not.toHaveProperty('lead')
  })

  it('finds the records whose list names a ref, by filter and by refs, and by whether the list is empty', async () => {
    const reads = listReads()
    const { records } = await found({ kind: 'bundle' }, reads)
    const second = (records[0]!['parts'] as unknown as readonly string[])[1]!
    expect((await found({ kind: 'bundle', filters: [{ field: 'parts', op: 'is', values: [second] }] }, reads)).total).toBe(1)
    expect((await found({ kind: 'bundle', filters: [{ field: 'parts', op: 'not', values: [second] }] }, reads)).total).toBe(1)
    expect((await found({ kind: 'bundle', filters: [{ field: 'parts', op: 'empty', values: [] }] }, reads)).total).toBe(1)
    expect((await found({ kind: 'bundle', refs: [second] }, reads)).total).toBe(1)
  })
})
