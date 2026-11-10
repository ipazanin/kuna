import 'fake-indexeddb/auto'
import { FILE_OPEN } from './fixtures/browserFile'
import { afterEach, describe, expect, it } from 'vitest'

import { companyAssistant } from '../src/apps/company/assistant/companyAssistant'
import { companyOperations, companyProposer } from '../src/apps/company/assistant/operations/companyOperations'
import { HR_DOO_ASSISTANT } from '../src/apps/company/packs/hr-doo/assistant/hrDooAssistant'
import { catalogueOf } from '../src/shared/ai/application/catalogue'
import { kunaAssistant } from '../src/shell/assistant/kunaAssistant'
import { KUNA_CHAT } from '../src/shell/assistant/kunaChat'
import { INVOICING_OPERATIONS } from '../src/apps/company/assistant/operations/invoicingOperations'
import { KEPT_BY_KUNA } from '../src/apps/company/assistant/operations/proposalLines'
import { installedPack } from '../src/apps/company/packs/packContribution'
import { settingName } from '../src/apps/company/assistant/operations/settingNames'
import { hrDooOperations } from '../src/apps/company/packs/hr-doo/assistant/operations/packOperations'
import { packDescriber } from '../src/apps/company/packs/hr-doo/assistant/operations/proposalLines'
import { words } from '../src/apps/company/assistant/operations/words'
import { transcribedStatement } from '../src/apps/company/imports/domain/importedStatement'
import { ACCOUNT_RECORDS, CATEGORY_RECORDS, LEDGER_RECORDS, RULE_RECORDS } from '../src/apps/company/workbook/domain/coreKinds'
import type { AssistantOperation } from '../src/shared/app/assistantOperations'
import { words as sharedWords } from '../src/shared/app/words'
import { parseCivilDate } from '../src/shared/calendar/civilDate'
import { moneyFromAmount } from '../src/shared/money/money'
import type { RuledChange } from '../src/shared/storage/application/recordWrites'
import { companyDesk, deskPorts, mailDraftsHeld } from './fixtures/companyDesk'
import type { CompanyDesk } from './fixtures/companyDesk'
import { fakeCompanyBooks, readingOf } from './fixtures/companyChatBooks'
import { forgetCaches } from './fixtures/writeBack'
import { expectCountsOfChanges } from './fixtures/cardCounts'

const used = new Set<string>()
afterEach(async () => forgetCaches(used))

/** A statement the last folder sync held back: the account with no rows yet, which it starts at its opening. */
const HELD = [
  {
    statement: transcribedStatement(
      'fresh',
      'fresh-statement-001',
      moneyFromAmount(200),
      moneyFromAmount(150),
      [{ date: parseCivilDate('2026-10-20')!, amount: moneyFromAmount(-50), counterparty: 'Supplier', counterpartyIban: '', description: 'Goods' }],
      'ask',
    ),
  },
]

/** The record each operation's example names, by the name it gives it, as the reader's ids: a row's id, and a category's, an account's or a rule's short name. */
function exampleRecords(desk: CompanyDesk): Readonly<Record<string, string>> {
  return {
    'ledger-row-waiting': desk.row('REF-9').id,
    'ledger-row': desk.row('REF-6').id,
    'ledger-row-confirmed': desk.row('REF-7').id,
    'ledger-row-dismissed': desk.row('REF-6').id,
    'ledger-row-split': desk.row('REF-7').id,
    category: 'equipment',
    'category-other': 'office',
    'category-unused': 'spare',
    account: 'main',
    'account-unused': 'fresh',
    rule: 'merchant-model',
  }
}

/** The example's input with each record it names as a ref the chat handed out, inside a list of parts too. */
function exampleInput(desk: CompanyDesk, operation: AssistantOperation): Record<string, unknown> {
  const records = exampleRecords(desk)
  const refOf = (kind: string | undefined, value: unknown) => (kind !== undefined && typeof value === 'string' && records[value] !== undefined ? desk.ref(kind, records[value]) : value)
  return Object.fromEntries(
    Object.entries(operation.example).map(([field, value]) => {
      if (Array.isArray(value)) {
        return [field, value.map((item: Readonly<Record<string, unknown>>) => Object.fromEntries(Object.entries(item).map(([name, held]) => [name, refOf(operation.refs[`${field}.${name}`], held)])))]
      }
      return [field, refOf(operation.refs[field], value)]
    }),
  )
}

/** A field's value as the card reads it, where an empty text and a missing value both say nothing. */
function said(value: unknown): unknown {
  return value === undefined || value === '' ? null : value
}

/** The card's names of the fields a change sets, leaving out the ones Kuna keeps by itself. */
function namesSet(before: Readonly<Record<string, unknown>> | null, after: Readonly<Record<string, unknown>>): string[] {
  const fields = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after)])].filter((field) => !KEPT_BY_KUNA.has(field))
  const altered = fields.filter((field) => JSON.stringify(said(before?.[field])) !== JSON.stringify(said(after[field])))
  return altered.map((field) => (words.fields as Readonly<Record<string, string>>)[field] ?? field)
}

/** Company's own ledger, import and settings operations. The invoicing and pack operations have specs of their own over books that hold what their examples name. */
const OPERATIONS = companyOperations(deskPorts({ heldStatements: () => HELD, pack: null })).filter(
  (operation) => !INVOICING_OPERATIONS.operations.some((invoicing) => invoicing.name === operation.name),
)

describe('every Company operation', () => {
  it.each(OPERATIONS.map((operation) => [operation.name, operation] as const))(
    'has an example that passes the checks of the books, and a card that names every field it sets: %s',
    async (_name, operation) => {
      const desk = await companyDesk(used, { heldStatements: () => HELD })

      const answer = await desk.propose([{ op: operation.name, input: exampleInput(desk, operation) }])

      expect(answer.text).toContain('The card shows')
      expect(answer.isError).toBe(false)
      const [card] = desk.cards
      expectCountsOfChanges(card!)
      const { changes } = (card!.held as { readonly changes?: readonly RuledChange[] }).changes === undefined ? { changes: [] } : (card!.held as { readonly changes: readonly RuledChange[] })
      const linesTaken = new Map<string, number>()
      for (const { change } of changes) {
        if (change.verb === 'repair' || change.verb === 'discard') continue
        const group = card!.groups.find((candidate) => candidate.verb === change.verb && candidate.noun === change.kind.noun)!
        const at = linesTaken.get(`${change.verb}/${change.kind.name}`) ?? 0
        linesTaken.set(`${change.verb}/${change.kind.name}`, at + 1)
        if (change.verb === 'remove') continue
        const before = change.verb === 'change' ? (change.before as Readonly<Record<string, unknown>>) : null
        expect(group.lines[at]!.fields.map((field) => field.name)).toEqual(expect.arrayContaining(namesSet(before, change.after as Readonly<Record<string, unknown>>)))
      }
      const accepted = await desk.accept()
      expect(accepted.kind).toBe('done')
      if (accepted.kind === 'done') expect(await accepted.undo!()).toEqual({ kind: 'undone' })
    },
  )
})

describe('filing rows', () => {
  it('files a waiting row as a person would, and Undo puts it back', async () => {
    const desk = await companyDesk(used)
    const waiting = desk.row('REF-9')
    await desk.propose([{ op: 'file-row', input: { row: desk.ref(LEDGER_RECORDS.name, waiting.id), category: desk.ref(CATEGORY_RECORDS.name, 'office') } }])
    const accepted = await desk.accept()
    expect(desk.row('REF-9')).toMatchObject({ category: 'office', flaggedBy: 'ivan' })
    if (accepted.kind === 'done') await accepted.undo!()
    expect(desk.row('REF-9')).toMatchObject({ category: 'unknown', flaggedBy: 'ai' })
  })

  it('refuses a category for money in on money out', async () => {
    const desk = await companyDesk(used)
    const answer = await desk.propose([{ op: 'file-row', input: { row: desk.ref(LEDGER_RECORDS.name, desk.row('REF-9').id), category: desk.ref(CATEGORY_RECORDS.name, 'revenue') } }])
    expect(answer.isError).toBe(true)
    expect(answer.text).toContain('revenue takes money in')
  })

  it('warns on a confirmed row it files elsewhere', async () => {
    const desk = await companyDesk(used)
    await desk.propose([{ op: 'file-row', input: { row: desk.ref(LEDGER_RECORDS.name, desk.row('REF-6').id), category: desk.ref(CATEGORY_RECORDS.name, 'office') } }])
    const lines = desk.cards[0]!.groups.flatMap((group) => group.lines)
    expect(lines.map((line) => line.warning)).toContain(sharedWords.confirmedRowMoves)
  })
})

describe('filing rows against a rule', () => {
  it('says on the card when a rule files rows like this one elsewhere, as Change category does', async () => {
    const desk = await companyDesk(used)
    await desk.propose([{ op: 'file-row', input: { row: desk.ref(LEDGER_RECORDS.name, desk.row('REF-5').id), category: desk.ref(CATEGORY_RECORDS.name, 'office') } }])
    const warnings = desk.cards[0]!.groups.flatMap((group) => group.notes).map((note) => note.text)
    expect(warnings.some((warning) => warning.includes('merchant-model'))).toBe(true)
  })
})

describe('rules', () => {
  const ruleInput = (desk: CompanyDesk, fields: Record<string, unknown>) => ({
    row: null,
    category: desk.ref(CATEGORY_RECORDS.name, 'office'),
    name: null,
    on: null,
    before: null,
    payeeWords: null,
    descriptionWords: null,
    iban: null,
    direction: null,
    confidence: null,
    note: null,
    ...fields,
  })

  it('adds a rule and files the waiting rows it settles in the same write, with one Undo', async () => {
    const desk = await companyDesk(used)
    await desk.propose([{ op: 'add-rule', input: ruleInput(desk, { payeeWords: 'MARKET' }) }])
    const card = desk.cards[0]!
    expect(card.groups.map((group) => group.noun)).toEqual([RULE_RECORDS.noun, LEDGER_RECORDS.noun])
    const accepted = await desk.accept()
    expect(desk.row('REF-8')).toMatchObject({ category: 'office', flaggedBy: 'rule' })
    expect(desk.store.state.workbook!.rules.map((rule) => rule.id)).toContain('office-market')
    if (accepted.kind === 'done') await accepted.undo!()
    expect(desk.row('REF-8')).toMatchObject({ flaggedBy: 'ai' })
    expect(desk.store.state.workbook!.rules.map((rule) => rule.id)).not.toContain('office-market')
  })

  it('re-files each confirmed row the rule now files elsewhere, each on its own warned line, with one Undo', async () => {
    const desk = await companyDesk(used)
    await desk.propose([{ op: 'add-rule', input: ruleInput(desk, { payeeWords: 'Desk' }) }])
    const ledger = desk.cards[0]!.groups.find((group) => group.noun === LEDGER_RECORDS.noun)!
    expect(ledger.lines.map((line) => [line.label, line.warning])).toEqual([['Desk Co', sharedWords.confirmedRowMoves]])
    const accepted = await desk.accept()
    expect(desk.row('REF-6')).toMatchObject({ category: 'office', flaggedBy: 'rule' })
    if (accepted.kind === 'done') expect((await accepted.undo!()).kind).toBe('undone')
    expect(desk.row('REF-6')).toMatchObject({ category: 'equipment', flaggedBy: 'ivan' })
    expect(desk.store.state.workbook!.rules.map((rule) => rule.id)).not.toContain('office-desk')
  })

  it('warns on a confirmed row another rule now decides, and leaves it filed', async () => {
    const desk = await companyDesk(used)
    await desk.propose([{ op: 'add-rule', input: ruleInput(desk, { payeeWords: 'Desk', confidence: 'review' }) }])
    const warned = desk.cards[0]!.groups.flatMap((group) => group.notes)
    expect(warned.map((note) => note.label)).toEqual(['Desk Co'])
    expect(warned[0]!.text).toBe(words.ruleDisagrees('Office'))
    await desk.accept()
    expect(desk.row('REF-6').category).toBe('equipment')
  })

  it('names a rule from its category and payee, unique among the rules and the earlier steps of its card, and shows the name with no order', async () => {
    const desk = await companyDesk(used)
    await desk.propose([
      { op: 'add-rule', input: ruleInput(desk, { payeeWords: 'Market One Čakovec d.o.o.' }) },
      { op: 'add-rule', input: ruleInput(desk, { payeeWords: 'Market One Čakovec d.o.o.', descriptionWords: 'Card' }) },
    ])
    const rules = desk.cards[0]!.groups.find((group) => group.noun === RULE_RECORDS.noun)!
    expect(rules.lines.map((line) => line.label)).toEqual(['office-market-one-cakovec', 'office-market-one-cakovec-2'])
    expect(rules.lines[0]!.fields.map((field) => field.after).join(' ')).not.toMatch(/tried at \d/)
  })

  it('takes the name a step gives, and refuses one another rule has', async () => {
    const desk = await companyDesk(used)
    await desk.propose([{ op: 'add-rule', input: ruleInput(desk, { name: 'office-market-one', payeeWords: 'MARKET' }) }])
    expect(desk.cards[0]!.groups[0]!.lines[0]!.label).toBe('office-market-one')
    const answer = await desk.propose([{ op: 'add-rule', input: ruleInput(desk, { name: 'Merchant-Model', payeeWords: 'MARKET' }) }])
    expect(answer).toMatchObject({ isError: true })
    expect(answer.text).toContain('already named Merchant-Model')
  })

  it("drafts a rule from a waiting row by that row's payee under the category given, never by its direction alone", async () => {
    const desk = await companyDesk(used)
    await desk.propose([{ op: 'add-rule', input: ruleInput(desk, { row: desk.ref(LEDGER_RECORDS.name, desk.row('REF-9').id), direction: 'out' }) }])
    await desk.accept()
    const rule = desk.store.state.workbook!.rules.find((candidate) => candidate.id === 'office-new-shop')!
    expect(rule.conditions.map((condition) => condition.column)).toContain('counterparty_contains')
    const answer = await desk.propose([{ op: 'add-rule', input: ruleInput(desk, { direction: 'out' }) }])
    expect(answer).toMatchObject({ isError: true })
  })

  it('adds a rule switched off, which files no row', async () => {
    const desk = await companyDesk(used)
    await desk.propose([{ op: 'add-rule', input: ruleInput(desk, { on: 'no', payeeWords: 'MARKET' }) }])
    await desk.accept()
    expect(desk.store.state.workbook!.rules.find((rule) => rule.id === 'office-market')!.enabled).toBe(false)
    expect(desk.row('REF-8')).toMatchObject({ flaggedBy: 'ai' })
  })

  it('renames a rule', async () => {
    const desk = await companyDesk(used)
    const rule = desk.ref(RULE_RECORDS.name, 'merchant-model')
    await desk.propose([
      {
        op: 'change-rule',
        input: {
          rule,
          name: 'ai-services-model-api',
          category: null,
          on: null,
          before: null,
          last: null,
          payeeWords: null,
          descriptionWords: null,
          iban: null,
          direction: null,
          confidence: null,
          note: null,
        },
      },
    ])
    expect((await desk.accept()).kind).toBe('done')
    expect(desk.store.state.workbook!.rules.map((candidate) => candidate.id)).toEqual(['ai-services-model-api'])
  })

  it('switches a rule off and moves it last, and deletes one', async () => {
    const desk = await companyDesk(used)
    const rule = desk.ref(RULE_RECORDS.name, 'merchant-model')
    await desk.propose([
      {
        op: 'change-rule',
        input: { rule, name: null, category: null, on: 'no', before: null, last: 'yes', payeeWords: null, descriptionWords: null, iban: null, direction: null, confidence: null, note: null },
      },
    ])
    expect((await desk.accept()).kind).toBe('done')
    expect(desk.store.state.workbook!.rules.find((candidate) => candidate.id === 'merchant-model')!.enabled).toBe(false)
    await desk.propose([{ op: 'delete-rule', input: { rule } }])
    await desk.accept()
    expect(desk.store.state.workbook!.rules).toEqual([])
  })
})

describe('splits and owner shares', () => {
  it('splits a row by shares with no cent lost, and Undo takes the split off', async () => {
    const desk = await companyDesk(used)
    const row = desk.row('REF-6')
    await desk.propose([
      {
        op: 'split-row',
        input: {
          row: desk.ref(LEDGER_RECORDS.name, row.id),
          by: 'share',
          parts: [
            { amount: 1, category: desk.ref(CATEGORY_RECORDS.name, 'equipment'), note: '' },
            { amount: 1, category: desk.ref(CATEGORY_RECORDS.name, 'office'), note: '' },
            { amount: 1, category: desk.ref(CATEGORY_RECORDS.name, 'travel'), note: '' },
          ],
        },
      },
    ])
    const accepted = await desk.accept()
    const split = desk.store.state.workbook!.splits.find((candidate) => candidate.row.id === row.id)!
    expect(split.parts.map((part) => part.amount).reduce((sum, amount) => sum + amount, 0)).toBe(row.amount)
    expect(split.parts.map((part) => part.amount)).toEqual([-2000, -2000, -2000])
    if (accepted.kind === 'done') await accepted.undo!()
    expect(desk.store.state.workbook!.splits.some((candidate) => candidate.row.id === row.id)).toBe(false)
  })

  it("refuses a part's category that is no ref Kuna handed out", async () => {
    const desk = await companyDesk(used)
    const answer = await desk.propose([
      {
        op: 'split-row',
        input: {
          row: desk.ref(LEDGER_RECORDS.name, desk.row('REF-6').id),
          by: 'share',
          parts: [
            { amount: 1, category: 'equipment', note: '' },
            { amount: 1, category: desk.ref(CATEGORY_RECORDS.name, 'office'), note: '' },
          ],
        },
      },
    ])
    expect(answer.text).toContain('parts.category is not a ref')
  })

  it('refuses amounts that do not add up to the row', async () => {
    const desk = await companyDesk(used)
    const answer = await desk.propose([
      {
        op: 'split-row',
        input: {
          row: desk.ref(LEDGER_RECORDS.name, desk.row('REF-6').id),
          by: 'amount',
          parts: [
            { amount: 40, category: desk.ref(CATEGORY_RECORDS.name, 'equipment'), note: '' },
            { amount: 10, category: desk.ref(CATEGORY_RECORDS.name, 'office'), note: '' },
          ],
        },
      },
    ])
    expect(answer.text).toContain('add up to the whole row')
  })

  it("sets a split part's share, and refuses a share on a row still waiting", async () => {
    const desk = await companyDesk(used)
    await desk.propose([{ op: 'set-owner-share', input: { row: desk.ref(LEDGER_RECORDS.name, desk.row('REF-7').id), part: 2, share: 50 } }])
    await desk.accept()
    expect(desk.store.state.workbook!.splits.find((split) => split.row.reference === 'REF-7')!.parts[1]!.ownerShare).toBe(50)
    const waiting = await desk.propose([{ op: 'set-owner-share', input: { row: desk.ref(LEDGER_RECORDS.name, desk.row('REF-8').id), part: null, share: 50 } }])
    expect(waiting.text).toContain('still waits on To review')
  })
})

describe('settings, categories and accounts', () => {
  it('never sets a key only a person sets', async () => {
    const desk = await companyDesk(used)
    for (const key of ['person_payees', 'review_label', 'invoice_folder_id', 'statements_folder', 'statements_sync', 'statements_mail_from', 'template_version']) {
      const answer = await desk.propose([{ op: 'set-setting', input: { key, value: 'x' } }])
      expect(answer.isError, key).toBe(true)
    }
    expect(desk.cards).toEqual([])
  })

  it("sets the subject of the bank's mail and the day mail is read from, which need no Google consent", async () => {
    const desk = await companyDesk(used)

    const answer = await desk.propose([
      { op: 'set-setting', input: { key: 'statements_mail_subject', value: 'Izvadak' } },
      { op: 'set-setting', input: { key: 'mail_since', value: '2026-01-01' } },
    ])

    expect(answer.isError, answer.text).toBe(false)
    expect(desk.cards[0]!.groups.flatMap((group) => group.lines).map((line) => line.label)).toEqual(['Subject words', 'Mail since'])
  })

  it('warns on a value that says where money goes, and on currency with a line of its own', async () => {
    const desk = await companyDesk(used)
    await desk.propose([
      { op: 'set-setting', input: { key: 'invoice_iban', value: 'HR1210010051863000160' } },
      { op: 'set-setting', input: { key: 'currency', value: 'USD' } },
    ])
    const lines = desk.cards[0]!.groups.flatMap((group) => group.lines)
    expect(lines.filter((line) => line.fields.some((field) => field.warns)).map((line) => line.label)).toEqual(['IBAN', 'Currency'])
    expect(desk.cards[0]!.groups.flatMap((group) => group.notes).map((note) => note.text)).toEqual([words.everyFigure.currency])
  })

  it('names every key it may set as its screen does, never by the key the settings tab stores', () => {
    const setSetting = companyOperations(deskPorts({ pack: hrDooOperations(() => false) })).find((operation) => operation.name === 'set-setting')!
    const key = setSetting.input.type === 'object' ? setSetting.input.properties['key'] : undefined
    const keys = key !== undefined && 'enum' in key ? (key.enum as readonly string[]) : []
    const names = packDescriber(fakeCompanyBooks().workbook).settingNames

    expect(keys.length).toBeGreaterThan(30)
    expect(keys.filter((proposed) => settingName(proposed, names) === proposed)).toEqual([])
  })

  it("lists the pack's tax classes as add-category's taxClass, each with the name the categories editor gives it, and keeps them out of roles", () => {
    const addCategory = OPERATIONS.find((operation) => operation.name === 'add-category')!
    const fields = addCategory.input.type === 'object' ? addCategory.input.properties : {}
    const taxClass = fields['taxClass']!
    const roles = fields['roles']!
    const classes = installedPack().workbook!.categoryClasses.map((candidate) => candidate.role)

    const otherRoles = roles.type === 'array' && 'enum' in roles.items ? (roles.items.enum ?? []) : []

    expect('enum' in taxClass ? taxClass.enum : []).toEqual(classes)
    expect(taxClass.description).toContain(`deductible-cost: ${installedPack().categoryClassHelp('deductible-cost', parseCivilDate('2026-11-07')!)!.name}`)
    expect(otherRoles).toContain('watched')
    expect(otherRoles.filter((role) => role !== null && classes.includes(role))).toEqual([])
  })

  it('adds a category with its tax class first among its roles, and the card names the class as the categories editor does', async () => {
    const desk = await companyDesk(used)

    const answer = await desk.propose([
      {
        op: 'add-category',
        input: {
          category: 'client-lunches',
          label: 'Client lunches',
          family: 'operating',
          bucket: 'operating',
          taxClass: 'representation',
          roles: ['watched'],
          vat: 'representation',
          colour: '#2A78D6',
          ownerShare: '',
        },
      },
    ])

    expect(answer.isError, answer.text).toBe(false)
    const roles = desk.cards[0]!.groups.flatMap((group) => group.lines).flatMap((line) => line.fields.filter((field) => field.name === words.fields.roles))
    expect(roles[0]!.after).toMatch(/^Representation: .+, watched$/)
    expect(desk.cards[0]!.groups.flatMap((group) => group.lines).flatMap((line) => line.fields.map((field) => field.name))).toContain(words.fields.colour)
  })

  it('refuses a tax class the pack lacks by naming every class, and points at the operation page', async () => {
    const desk = await companyDesk(used)

    const answer = await desk.propose([
      { op: 'add-category', input: { category: 'donations', label: 'Donations', family: 'operating', bucket: 'operating', taxClass: 'donation', roles: [], vat: '', colour: null, ownerShare: '' } },
    ])

    expect(answer.isError).toBe(true)
    for (const role of installedPack().workbook!.categoryClasses.map((candidate) => candidate.role)) expect(answer.text).toContain(role)
    expect(answer.text).toContain('company/op/add-category')
  })

  it('refuses a class among the other roles of a change, and a role Kuna does not know by naming those it does', async () => {
    const desk = await companyDesk(used)
    const change = (roles: string) => ({
      op: 'change-category',
      input: {
        category: desk.ref(CATEGORY_RECORDS.name, 'equipment'),
        name: null,
        label: null,
        family: null,
        bucket: null,
        taxClass: null,
        roles,
        vat: null,
        colour: null,
        ownerShare: null,
        fillRows: null,
      },
    })

    expect((await desk.propose([change('revenue')])).text).toContain('Name it in taxClass')
    const unknown = await desk.propose([change('made-up')])
    expect(unknown.isError).toBe(true)
    expect(unknown.text).toContain('watched')
  })

  it('refuses to delete a category or an account something names', async () => {
    const desk = await companyDesk(used)
    expect((await desk.propose([{ op: 'delete-category', input: { category: desk.ref(CATEGORY_RECORDS.name, 'equipment') } }])).isError).toBe(true)
    expect((await desk.propose([{ op: 'delete-account', input: { account: desk.ref(ACCOUNT_RECORDS.name, 'main') } }])).isError).toBe(true)
  })

  it('gives a new default share to the rows that hold none, in the same write as the category', async () => {
    const desk = await companyDesk(used)
    await desk.propose([
      {
        op: 'change-category',
        input: {
          category: desk.ref(CATEGORY_RECORDS.name, 'equipment'),
          name: null,
          label: null,
          family: null,
          bucket: null,
          taxClass: null,
          roles: null,
          vat: null,
          colour: null,
          ownerShare: '20',
          fillRows: 'yes',
        },
      },
    ])
    const accepted = await desk.accept()
    expect(desk.row('REF-6').ownerShare).toBe(20)
    if (accepted.kind === 'done') await accepted.undo!()
    expect(desk.row('REF-6').ownerShare).toBe(null)
  })

  it('answers a set-up question on this device alone, and Undo asks it again', async () => {
    const desk = await companyDesk(used)
    expect(
      (
        await desk.propose([
          { op: 'answer-set-up', input: { answer: 'categories-look-right' } },
          { op: 'answer-set-up', input: { answer: 'statements-by-hand' } },
        ])
      ).isError,
    ).toBe(true)
    await desk.propose([{ op: 'answer-set-up', input: { answer: 'categories-look-right' } }])
    const accepted = await desk.accept()
    expect(desk.ports.setUpAnswers.given('categories-look-right')).toBe(true)
    if (accepted.kind === 'done') await accepted.undo!()
    expect(desk.ports.setUpAnswers.given('categories-look-right')).toBe(false)
  })
})

describe('switching invoice drafts', () => {
  it('turns drafts on alone on this device, refuses a switch changed since, and Undo puts it back only while it is what the card set', async () => {
    const drafts = mailDraftsHeld()
    const desk = await companyDesk(used, { mailDrafts: drafts })
    const waiting = { op: 'file-row', input: { row: desk.ref(LEDGER_RECORDS.name, desk.row('REF-9').id), category: desk.ref(CATEGORY_RECORDS.name, 'office') } }
    expect((await desk.propose([{ op: 'switch-mail-drafts', input: { drafts: 'on' } }, waiting])).isError).toBe(true)
    expect((await desk.propose([{ op: 'switch-mail-drafts', input: { drafts: 'off' } }])).text).toContain('already off')

    await desk.propose([{ op: 'switch-mail-drafts', input: { drafts: 'on' } }])
    expect(desk.cards[0]!.outside).toEqual([])
    drafts.switchTo(true)
    expect(await desk.accept()).toEqual({ kind: 'refused', reason: words.mailDrafts.changedSince })
    drafts.switchTo(false)

    const accepted = await desk.accept()
    expect(drafts.on()).toBe(true)
    expect(drafts.asked).toBe(0)
    drafts.switchTo(false)
    if (accepted.kind === 'done') expect(await accepted.undo!()).toEqual({ kind: 'refused', reason: sharedWords.proposalUndoEnded })
    drafts.switchTo(true)
    if (accepted.kind === 'done') expect(await accepted.undo!()).toEqual({ kind: 'undone' })
    expect(drafts.on()).toBe(false)
  })

  it("asks Google for Gmail within Accept's click when the page lacks it, says so on the card, and leaves drafts off when Google refuses", async () => {
    const refused = await companyDesk(used, { mailDrafts: mailDraftsHeld('asks', 'Google gave no Gmail.') })
    await refused.propose([{ op: 'switch-mail-drafts', input: { drafts: 'on' } }])
    expect(refused.cards[0]!.outside).toEqual([words.mailDrafts.asksGmail])
    expect(await refused.accept()).toEqual({ kind: 'refused', reason: 'Google gave no Gmail.' })
    expect(refused.ports.mailDrafts.on()).toBe(false)

    const drafts = mailDraftsHeld('asks')
    const granted = await companyDesk(used, { mailDrafts: drafts })
    await granted.propose([{ op: 'switch-mail-drafts', input: { drafts: 'on' } }])
    const accepted = await granted.accept()
    expect(accepted.kind).toBe('done')
    expect(drafts.asked).toBe(1)
    expect(drafts.on()).toBe(true)
    if (accepted.kind === 'done') await accepted.undo!()
    expect(drafts.on()).toBe(false)
  })

  it('refuses turning drafts on where asking Google would leave the page, and turns them off with no ask', async () => {
    const drafts = mailDraftsHeld('leaves')
    const desk = await companyDesk(used, { mailDrafts: drafts })
    const answer = await desk.propose([{ op: 'switch-mail-drafts', input: { drafts: 'on' } }])
    expect(answer.isError).toBe(true)
    expect(answer.text).toContain('/company/invoicing?tab=invoices')

    drafts.switchTo(true)
    await desk.propose([{ op: 'switch-mail-drafts', input: { drafts: 'off' } }])
    expect((await desk.accept()).kind).toBe('done')
    expect(drafts.on()).toBe(false)
    expect(drafts.asked).toBe(0)
  })
})

describe('one card', () => {
  it('changes a row two steps touch once, from the row as read to the last step', async () => {
    const desk = await companyDesk(used)
    const row = desk.ref(LEDGER_RECORDS.name, desk.row('REF-9').id)
    await desk.propose([
      { op: 'file-row', input: { row, category: desk.ref(CATEGORY_RECORDS.name, 'office') } },
      { op: 'file-row', input: { row, category: desk.ref(CATEGORY_RECORDS.name, 'travel') } },
    ])
    expect(desk.cards[0]!.count).toBe(1)
    await desk.accept()
    expect(desk.row('REF-9').category).toBe('travel')
  })
})

describe("the catalogue of Company's operations", () => {
  it('lists every operation of the ledger, import, settings, invoicing and the pack once, each with a page of its own', async () => {
    const desk = await companyDesk(used)
    const assistant = { ...companyAssistant(HR_DOO_ASSISTANT, readingOf(fakeCompanyBooks()), () => []), proposer: companyProposer(desk.store, desk.ports, FILE_OPEN) }
    const names = assistant.proposer.operations.map((operation) => operation.name)

    const catalogue = catalogueOf([{ id: 'company', name: 'Company', purpose: 'The company books.', screens: [{ path: '/company', title: 'Company' }], assistant }], {
      ...KUNA_CHAT,
      assistant: kunaAssistant(),
    })

    expect(new Set(names).size).toBe(names.length)
    expect(names).toEqual(
      expect.arrayContaining(['file-row', 'import-statement', 'set-setting', 'add-invoice', 'fill-billing-year', 'add-owner-advance', 'add-employee', 'answer-set-up', 'switch-mail-drafts']),
    )
    expect(names.filter((name) => name === 'set-setting')).toHaveLength(1)
    expect(catalogue.proposers.get('company')).toBe(assistant.proposer)
    expect([...catalogue.pages.keys()].filter((path) => path.startsWith('company/op/'))).toEqual(names.map((name) => `company/op/${name}`))
  })
})
