import { describe, expect, it } from 'vitest'

import { invoiceChangeRefusals } from '../src/features/receivables/domain/invoiceGuards'
import { newInvoiceDates } from '../src/features/invoicing/domain/invoiceDates'
import { accountChangeRefusals } from '../src/features/settings/domain/accountGuards'
import { categoryChangeRefusals, categoryRoleRefusals, knownRoles } from '../src/features/settings/domain/categoryGuards'
import { clientChangeRefusals } from '../src/features/settings/domain/clientGuards'
import { writeDrafts } from '../src/features/settings/application/draftWrites'
import type { Repository } from '../src/features/workbook/application/repository'
import type { ReadRecord, RefusedRecord } from '../src/features/workbook/domain/recordsRead'
import { isIban } from '../src/features/workbook/domain/iban'
import { slugChangeRefusals, slugProblem } from '../src/features/workbook/domain/slug'
import { civil } from './fixtures/ledger'

const VALID_IBAN = 'XX66FAKE0000000099'
const OTHER_IBAN = 'XX93FAKE0000000098'

describe('a slug', () => {
  it('is lower-case letters and digits in words joined by single hyphens', () => {
    expect(['ai-services', 'main', 'q3-2026'].map((slug) => slugProblem(slug, 'category'))).toEqual([null, null, null])
    expect(slugProblem('', 'account')).toBe('An account needs a name')
    for (const slug of ['Office', 'office supplies', 'office--supplies', '-office', 'office,supplies', 'café']) {
      expect(slugProblem(slug, 'category')).toContain('is not a category name the app can use')
    }
  })

  it('is refused when new or changed and outside the format, or on another row where each name is one row', () => {
    const untouched = [{ slug: 'travel' }]

    expect(slugChangeRefusals('category', { edits: [{ from: null, to: 'travel' }], untouched }, new Map(), true)).toEqual(['"travel" is already a category.'])
    expect(slugChangeRefusals('client', { edits: [{ from: null, to: 'travel' }], untouched }, new Map(), false)).toEqual([])
    expect(
      slugChangeRefusals('category', { edits: [{ from: null, to: 'meals' }, { from: null, to: 'meals' }], untouched }, new Map(), true),
    ).toEqual(['"meals" is added twice.', '"meals" is added twice.'])
    expect(slugChangeRefusals('category', { edits: [{ from: 'Old Name', to: 'Old Name' }], untouched }, new Map(), true)).toEqual([])
  })

  it('in use is never renamed or deleted, unless another row of the tab keeps it', () => {
    const uses = new Map([['startup', ['1 asset']], ['acme', ['2 invoices', 'the billing_client setting']]])

    expect(slugChangeRefusals('grant', { edits: [{ from: 'startup', to: 'start-up' }], untouched: [] }, uses, true)).toEqual([
      '"startup" cannot be renamed, since it is used by 1 asset.',
    ])
    expect(slugChangeRefusals('client', { edits: [{ from: 'acme', to: null }], untouched: [] }, uses, false)).toEqual([
      '"acme" cannot be deleted, since it is used by 2 invoices and the billing_client setting.',
    ])
    expect(slugChangeRefusals('client', { edits: [{ from: 'acme', to: null }], untouched: [{ slug: 'acme' }] }, uses, false)).toEqual([])
    expect(slugChangeRefusals('grant', { edits: [{ from: 'unused', to: null }], untouched: [] }, uses, true)).toEqual([])
  })
})

describe('an IBAN', () => {
  it('has the shape and check digits that hold, spaces and case aside', () => {
    expect(isIban(VALID_IBAN)).toBe(true)
    expect(isIban('xx66 fake 0000 0000 99')).toBe(true)
    expect(isIban('XX67FAKE0000000099')).toBe(false)
    expect(isIban('XX66FAKE')).toBe(false)
    expect(isIban('not an iban')).toBe(false)
  })
})

describe('the categories tab', () => {
  const uses = { named: new Map([['travel', ['3 ledger rows']]]), advances: new Map([['postage', 2]]) }

  it('keeps a category in use, and keeps one owner advances carry in a bucket an advance counts in', () => {
    expect(
      categoryChangeRefusals(
        [
          { before: { slug: 'travel', bucket: 'operating' }, after: null },
          { before: { slug: 'postage', bucket: 'operating' }, after: { slug: 'postage', bucket: 'financing' } },
          { before: { slug: 'meals', bucket: 'operating' }, after: { slug: 'meals', bucket: 'financing' } },
        ],
        [],
        uses,
      ),
    ).toEqual([
      '"travel" cannot be deleted, since it is used by 3 ledger rows.',
      '"postage" stays in the operating or taxes bucket, since 2 owner advances carry it and an advance counts only as an operating cost or a tax.',
    ])
    expect(categoryChangeRefusals([{ before: { slug: 'postage', bucket: 'operating' }, after: { slug: 'postage', bucket: 'taxes' } }], [], uses)).toEqual([])
  })

  it('refuses a role a change gives that the app does not know, and leaves one the row already held', () => {
    const known = knownRoles(['watched'])

    expect(known).toEqual(['revenue', 'client-refund', 'owner-benefit', 'watched'])
    expect(
      categoryRoleRefusals(
        [
          { before: null, after: { slug: 'paper', roles: ['revenu'] } },
          { before: { slug: 'travel', roles: ['old-role'] }, after: { slug: 'travel', roles: ['old-role', 'watched'] } },
        ],
        known,
      ),
    ).toEqual(['"paper" takes only roles the app knows, not "revenu".'])
  })
})

describe('the accounts tab', () => {
  const checks = { named: new Map([['main', ['12 ledger rows']]]), clientIbans: new Map([[OTHER_IBAN, 'acme']]) }

  it('takes a valid IBAN no other account and no client has', () => {
    const untouched = [{ slug: 'main', iban: VALID_IBAN }]
    const added = (iban: string) => [{ before: null, after: { slug: 'savings', iban } }]

    expect(accountChangeRefusals(added('XX23FAKE0000000097'), untouched, checks)).toEqual([])
    expect(accountChangeRefusals(added(''), untouched, checks)).toEqual([])
    expect(accountChangeRefusals(added('XX24FAKE0000000097'), untouched, checks)).toEqual(['"XX24FAKE0000000097" is not a valid IBAN.'])
    expect(accountChangeRefusals(added(VALID_IBAN), untouched, checks)).toEqual([
      `${VALID_IBAN} is already the IBAN of the main account, and the app files each statement by its IBAN, so one IBAN names one account.`,
    ])
    expect(accountChangeRefusals(added(OTHER_IBAN), untouched, checks)).toEqual([
      `${OTHER_IBAN} is the IBAN of the client acme, so the rules would read its payments as transfers between your own accounts.`,
    ])
  })

  it('leaves an IBAN that did not change alone, and lets an account no ledger row names drop its IBAN', () => {
    const main = { slug: 'main', iban: 'XX00FAKE0000000001' }

    expect(accountChangeRefusals([{ before: main, after: main }], [], checks)).toEqual([])
    const spare = { slug: 'spare', iban: 'XX00FAKE0000000002' }
    expect(accountChangeRefusals([{ before: spare, after: { ...spare, iban: '' } }], [], checks)).toEqual([])
    expect(accountChangeRefusals([{ before: { slug: 'cash', iban: '' }, after: null }], [], checks)).toEqual([])
  })

  it('keeps the IBAN of an account the ledger names', () => {
    const main = { slug: 'main', iban: 'XX00FAKE0000000001' }
    const savings = { slug: 'savings', iban: VALID_IBAN }

    expect(accountChangeRefusals([{ before: main, after: { ...main, iban: '' } }], [{ ...savings }], checks)).toEqual([
      '"main" keeps its IBAN, since ledger rows name the account and the app files no statement whose IBAN the accounts tab does not name.',
    ])
    expect(accountChangeRefusals([{ before: main, after: { ...main, iban: 'XX23FAKE0000000097' } }], [], checks)).toEqual([])
  })
})

describe('the clients tab', () => {
  const checks = { named: new Map([['acme', ['2 invoices']]]), accountIbans: new Map([['XX23FAKE0000000097', 'main']]) }
  const acme = { slug: 'acme', name: 'Acme Studio', iban: VALID_IBAN }

  it('takes a second IBAN of a client under its name or none, and refuses another name', () => {
    const second = (name: string) => [{ before: null, after: { slug: 'acme', name, iban: OTHER_IBAN } }]

    expect(clientChangeRefusals(second(''), [acme], checks)).toEqual([])
    expect(clientChangeRefusals(second('acme studio'), [acme], checks)).toEqual([])
    expect(clientChangeRefusals(second('Acme Ltd'), [acme], checks)).toEqual(['acme is called "Acme Studio" on another row. Give this row the same name, or leave it blank.'])
  })

  it('refuses an IBAN on another row, one of your own accounts, or one that is not valid', () => {
    const globex = (iban: string) => [{ before: null, after: { slug: 'globex', name: 'Globex', iban } }]

    expect(clientChangeRefusals(globex(VALID_IBAN), [acme], checks)).toEqual([`${VALID_IBAN} is already on the clients tab for acme.`])
    expect(clientChangeRefusals(globex('XX23FAKE0000000097'), [acme], checks)).toEqual([
      'XX23FAKE0000000097 is the IBAN of your main account, so a transfer between your own accounts would read as a payment from a client.',
    ])
    expect(clientChangeRefusals(globex('XX00FAKE0000000001'), [acme], checks)).toEqual(['"XX00FAKE0000000001" is not a valid IBAN.'])
  })

  it('keeps a client with invoices while it has no other row', () => {
    expect(clientChangeRefusals([{ before: acme, after: null }], [], checks)).toEqual(['"acme" cannot be deleted, since it is used by 2 invoices.'])
    expect(clientChangeRefusals([{ before: acme, after: null }], [{ ...acme, iban: OTHER_IBAN }], checks)).toEqual([])
  })
})

describe('the invoices tab', () => {
  it('uses each number once, whatever the client, and takes an amount above zero', () => {
    const untouched = [{ number: '1-1-26' }]

    expect(invoiceChangeRefusals([{ before: null, after: { number: '2-1-26', amount: 4200 } }], untouched)).toEqual([])
    expect(invoiceChangeRefusals([{ before: null, after: { number: ' 1-1-26 ', amount: 4200 } }], untouched)).toEqual([
      'Invoice 1-1-26 is already on the invoices tab, and each number is used once.',
    ])
    expect(invoiceChangeRefusals([{ before: { number: '2-1-26', amount: 10 }, after: { number: '2-1-26', amount: -10 } }], untouched)).toEqual([
      'Invoice 2-1-26 is for -10, and an invoice is for an amount above zero.',
    ])
    expect(invoiceChangeRefusals([{ before: { number: '1-1-26', amount: 10 }, after: { number: '1-1-26', amount: 20 } }], [])).toEqual([])
  })

  it('starts a new invoice due a month later, for the month it is issued in', () => {
    expect(newInvoiceDates(civil('2026-10-31'))).toEqual({ due: '2026-11-30', periodFrom: '2026-10-01', periodTo: '2026-10-31' })
    expect(newInvoiceDates(civil('2026-01-15'))).toEqual({ due: '2026-02-15', periodFrom: '2026-01-01', periodTo: '2026-01-31' })
  })
})

describe('an editor save', () => {
  interface Item {
    readonly name: string
  }
  const read = (name: string): ReadRecord<Item> => ({ record: { name }, id: null, label: name, fields: {} })
  const refused = (label: string): RefusedRecord => ({ id: null, label, fields: {}, reason: 'broken' })

  it('changes the records whose drafts differ, repairs a refused one, adds new drafts, and takes out what no draft holds', () => {
    const calls: string[] = []
    const items: Repository<Item> = {
      add: (record) => calls.push(`add ${record.name}`),
      change: (before, after) => calls.push(`change ${before.name} to ${after.name}`),
      remove: (record) => calls.push(`remove ${record.name}`),
      repair: (held, after) => calls.push(`repair ${held.label} as ${after.name}`),
      discard: (held) => calls.push(`discard ${held.label}`),
    }

    writeDrafts(items, [read('laptop'), read('desk'), read('lamp'), refused('chair'), refused('stool')], [
      { saved: 0, record: { name: 'laptop' } },
      { saved: 1, record: { name: 'standing desk' } },
      { saved: 3, record: { name: 'chair' } },
      { saved: null, record: { name: 'shelf' } },
    ])

    expect(calls).toEqual(['change desk to standing desk', 'repair chair as chair', 'add shelf', 'remove lamp', 'discard stool'])
  })
})
