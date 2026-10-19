import { describe, expect, it } from 'vitest'

import { invoiceChangeRefusals } from '../src/features/receivables/domain/invoiceGuards'
import { newInvoiceDates } from '../src/features/receivables/domain/newInvoice'
import { accountChangeRefusals } from '../src/features/settings/domain/accountGuards'
import { categoryChangeRefusals } from '../src/features/settings/domain/categoryGuards'
import { clientChangeRefusals } from '../src/features/settings/domain/clientGuards'
import { rowsChangeOf } from '../src/features/settings/domain/tabRowDrafts'
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
    const untouched = [{ sheetRow: 2, slug: 'travel' }]

    expect(slugChangeRefusals('category', { edits: [{ sheetRow: null, from: null, to: 'travel' }], untouched }, new Map(), true)).toEqual(['"travel" is already a category, on row 2.'])
    expect(slugChangeRefusals('client', { edits: [{ sheetRow: null, from: null, to: 'travel' }], untouched }, new Map(), false)).toEqual([])
    expect(
      slugChangeRefusals('category', { edits: [{ sheetRow: null, from: null, to: 'meals' }, { sheetRow: null, from: null, to: 'meals' }], untouched }, new Map(), true),
    ).toEqual(['"meals" is added twice.', '"meals" is added twice.'])
    expect(slugChangeRefusals('category', { edits: [{ sheetRow: 3, from: 'Old Name', to: 'Old Name' }], untouched }, new Map(), true)).toEqual([])
  })

  it('in use is never renamed or deleted, unless another row of the tab keeps it', () => {
    const uses = new Map([['startup', ['1 asset']], ['acme', ['2 invoices', 'the billing_client setting']]])

    expect(slugChangeRefusals('grant', { edits: [{ sheetRow: 2, from: 'startup', to: 'start-up' }], untouched: [] }, uses, true)).toEqual([
      '"startup" cannot be renamed, since it is used by 1 asset.',
    ])
    expect(slugChangeRefusals('client', { edits: [{ sheetRow: 2, from: 'acme', to: null }], untouched: [] }, uses, false)).toEqual([
      '"acme" cannot be deleted, since it is used by 2 invoices and the billing_client setting.',
    ])
    expect(slugChangeRefusals('client', { edits: [{ sheetRow: 2, from: 'acme', to: null }], untouched: [{ sheetRow: 3, slug: 'acme' }] }, uses, false)).toEqual([])
    expect(slugChangeRefusals('grant', { edits: [{ sheetRow: 2, from: 'unused', to: null }], untouched: [] }, uses, true)).toEqual([])
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
          { sheetRow: 2, before: { slug: 'travel', bucket: 'operating' }, after: null },
          { sheetRow: 3, before: { slug: 'postage', bucket: 'operating' }, after: { slug: 'postage', bucket: 'financing' } },
          { sheetRow: 4, before: { slug: 'meals', bucket: 'operating' }, after: { slug: 'meals', bucket: 'financing' } },
        ],
        [],
        uses,
      ),
    ).toEqual([
      '"travel" cannot be deleted, since it is used by 3 ledger rows.',
      '"postage" stays in the operating or taxes bucket, since 2 owner advances carry it and an advance counts only as an operating cost or a tax.',
    ])
    expect(categoryChangeRefusals([{ sheetRow: 3, before: { slug: 'postage', bucket: 'operating' }, after: { slug: 'postage', bucket: 'taxes' } }], [], uses)).toEqual([])
  })
})

describe('the accounts tab', () => {
  const checks = { named: new Map([['main', ['12 ledger rows']]]), clientIbans: new Map([[OTHER_IBAN, 'acme']]) }

  it('takes a valid IBAN no other account and no client has', () => {
    const untouched = [{ sheetRow: 2, slug: 'main', iban: VALID_IBAN }]
    const added = (iban: string) => [{ sheetRow: null, before: null, after: { slug: 'savings', iban } }]

    expect(accountChangeRefusals(added('XX23FAKE0000000097'), untouched, checks)).toEqual([])
    expect(accountChangeRefusals(added(''), untouched, checks)).toEqual([])
    expect(accountChangeRefusals(added('XX24FAKE0000000097'), untouched, checks)).toEqual(['"XX24FAKE0000000097" is not a valid IBAN.'])
    expect(accountChangeRefusals(added(VALID_IBAN), untouched, checks)).toEqual([
      `${VALID_IBAN} is already the IBAN of the main account, on row 2, and the Apps Script stops on an IBAN the tab names twice.`,
    ])
    expect(accountChangeRefusals(added(OTHER_IBAN), untouched, checks)).toEqual([
      `${OTHER_IBAN} is the IBAN of the client acme, so the rules would read its payments as transfers between your own accounts.`,
    ])
  })

  it('leaves an IBAN that did not change alone, and keeps at least one IBAN on the tab', () => {
    const main = { slug: 'main', iban: 'XX00FAKE0000000001' }

    expect(accountChangeRefusals([{ sheetRow: 2, before: main, after: main }], [], checks)).toEqual([])
    const spare = { slug: 'spare', iban: 'XX00FAKE0000000002' }
    expect(accountChangeRefusals([{ sheetRow: 3, before: spare, after: { ...spare, iban: '' } }], [{ sheetRow: 2, ...main }], checks)).toEqual([])
    expect(accountChangeRefusals([{ sheetRow: 3, before: spare, after: { ...spare, iban: '' } }], [], checks)).toEqual([
      'The accounts tab would name no IBAN, and the Apps Script stops its morning run without one. Keep at least one account with its IBAN.',
    ])
    expect(accountChangeRefusals([{ sheetRow: 3, before: { slug: 'cash', iban: '' }, after: null }], [], checks)).toEqual([])
  })

  it('keeps the IBAN of an account the ledger names', () => {
    const main = { slug: 'main', iban: 'XX00FAKE0000000001' }
    const savings = { slug: 'savings', iban: VALID_IBAN }

    expect(accountChangeRefusals([{ sheetRow: 2, before: main, after: { ...main, iban: '' } }], [{ sheetRow: 3, ...savings }], checks)).toEqual([
      '"main" keeps its IBAN, since ledger rows name the account and the Apps Script refuses a statement whose IBAN the accounts tab does not name.',
    ])
    expect(accountChangeRefusals([{ sheetRow: 2, before: main, after: { ...main, iban: 'XX23FAKE0000000097' } }], [], checks)).toEqual([])
  })
})

describe('the clients tab', () => {
  const checks = { named: new Map([['acme', ['2 invoices']]]), accountIbans: new Map([['XX23FAKE0000000097', 'main']]) }
  const acme = { sheetRow: 2, slug: 'acme', name: 'Acme Studio', iban: VALID_IBAN }

  it('takes a second IBAN of a client under its name or none, and refuses another name', () => {
    const second = (name: string) => [{ sheetRow: null, before: null, after: { slug: 'acme', name, iban: OTHER_IBAN } }]

    expect(clientChangeRefusals(second(''), [acme], checks)).toEqual([])
    expect(clientChangeRefusals(second('acme studio'), [acme], checks)).toEqual([])
    expect(clientChangeRefusals(second('Acme Ltd'), [acme], checks)).toEqual(['acme is called "Acme Studio" on row 2. Give this row the same name, or leave it blank.'])
  })

  it('refuses an IBAN on another row, one of your own accounts, or one that is not valid', () => {
    const globex = (iban: string) => [{ sheetRow: null, before: null, after: { slug: 'globex', name: 'Globex', iban } }]

    expect(clientChangeRefusals(globex(VALID_IBAN), [acme], checks)).toEqual([`${VALID_IBAN} is already on the clients tab for acme, on row 2.`])
    expect(clientChangeRefusals(globex('XX23FAKE0000000097'), [acme], checks)).toEqual([
      'XX23FAKE0000000097 is the IBAN of your main account, so a transfer between your own accounts would read as a payment from a client.',
    ])
    expect(clientChangeRefusals(globex('XX00FAKE0000000001'), [acme], checks)).toEqual(['"XX00FAKE0000000001" is not a valid IBAN.'])
  })

  it('keeps a client with invoices while it has no other row', () => {
    expect(clientChangeRefusals([{ sheetRow: 2, before: acme, after: null }], [], checks)).toEqual(['"acme" cannot be deleted, since it is used by 2 invoices.'])
    expect(clientChangeRefusals([{ sheetRow: 2, before: acme, after: null }], [{ ...acme, sheetRow: 3, iban: OTHER_IBAN }], checks)).toEqual([])
  })
})

describe('the invoices tab', () => {
  it('uses each number once, whatever the client, and takes an amount above zero', () => {
    const untouched = [{ sheetRow: 2, number: '1-1-26' }]

    expect(invoiceChangeRefusals([{ sheetRow: null, before: null, after: { number: '2-1-26', amount: 4200 } }], untouched)).toEqual([])
    expect(invoiceChangeRefusals([{ sheetRow: null, before: null, after: { number: ' 1-1-26 ', amount: 4200 } }], untouched)).toEqual([
      'Invoice 1-1-26 is already on the invoices tab, on row 2, and each number is used once.',
    ])
    expect(invoiceChangeRefusals([{ sheetRow: 3, before: { number: '2-1-26', amount: 10 }, after: { number: '2-1-26', amount: -10 } }], untouched)).toEqual([
      'Invoice 2-1-26 is for -10, and an invoice is for an amount above zero.',
    ])
    expect(invoiceChangeRefusals([{ sheetRow: 2, before: { number: '1-1-26', amount: 10 }, after: { number: '1-1-26', amount: 20 } }], [])).toEqual([])
  })

  it('starts a new invoice due a month later, for the month it is issued in', () => {
    expect(newInvoiceDates(civil('2026-10-31'))).toEqual({ due: '2026-11-30', periodFrom: '2026-10-01', periodTo: '2026-10-31' })
    expect(newInvoiceDates(civil('2026-01-15'))).toEqual({ due: '2026-02-15', periodFrom: '2026-01-01', periodTo: '2026-01-31' })
  })
})

describe('an editor save', () => {
  const rows = [
    { sheetRow: 2, cells: { asset: 'Laptop', cost_net: 1519.199999, note: 'Office' } },
    { sheetRow: 4, cells: { asset: 'Desk', cost_net: 300 } },
  ]
  const opened = new Map([
    [2, { asset: 'Laptop', cost_net: 1519.2, note: 'Office' }],
    [4, { asset: 'Desk', cost_net: 300 }],
  ])

  it('changes the fields that changed, keeps the cell of a field left alone, adds new drafts and deletes rows no draft holds', () => {
    const change = rowsChangeOf(rows, ['asset', 'cost_net', 'note'], [{ sheetRow: 2, cells: { asset: 'Laptop', cost_net: 1519.2, note: 'Home' } }, { sheetRow: null, cells: { asset: 'Chair', cost_net: 90 } }], opened)

    expect(change).toEqual({
      added: [{ asset: 'Chair', cost_net: 90, note: '' }],
      changed: [{ sheetRow: 2, before: { asset: 'Laptop', cost_net: 1519.199999, note: 'Office' }, after: { asset: 'Laptop', cost_net: 1519.199999, note: 'Home' } }],
      removed: [{ sheetRow: 4, cells: { asset: 'Desk', cost_net: 300, note: '' } }],
    })
  })
})
