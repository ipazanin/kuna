// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { SPENDING_OPERATIONS } from '../src/apps/spending/assistant/operations/spendingOperations'
import { attachedFile } from '../src/shared/ai/application/chatFiles'
import type { ChatAttachment } from '../src/shared/ai/domain/chatAttachments'
import { RECIPE_RECORDS } from '../src/apps/spending/workbook/domain/spendingKinds'
import { accountMoneyFromAmount } from '../src/shared/money/accountMoney'
import { DESK_ACCOUNTS, DESK_RECIPE, spendingDesk } from './fixtures/spendingDesk'
import { stepOf } from './fixtures/operationSteps'
import { forgetCaches } from './fixtures/writeBack'

const used = new Set<string>()
afterEach(async () => forgetCaches(used))

async function held(name: string, contents: string, id = 'a1'): Promise<ChatAttachment> {
  const file = await attachedFile(new File([contents], name), id, 0, () => Promise.reject(new Error('no photos here')))
  if ('reason' in file) throw new Error(`refused: ${file.reason}`)
  return file
}

/** A made-up bank's export: a title line, then a header, with money out and in in two columns and a decimal comma. */
const STATEMENT = [
  'Promet po računu',
  'Datum;Opis;Isplata;Uplata;Status',
  '02.11.2026;Corner market;12,50;;Proknjiženo',
  '03.11.2026;Salary;;1.200,00;Proknjiženo',
  '04.11.2026;Harbour bistro;8,00;;Odbijeno',
].join('\n')

const RECIPE = {
  bank: 'OTP banka',
  currency: 'EUR',
  name: 'OTP statement export',
  dateColumn: 'Datum',
  dateFormat: 'dd.MM.yyyy',
  amountColumn: null,
  debitColumn: 'Isplata',
  creditColumn: 'Uplata',
  decimalMark: 'comma',
  columns: { description: 'Opis', fee: null, currency: null },
  kinds: [
    { kind: 'payment', column: 'Status', equals: ['Proknjiženo'] },
    { kind: 'not-completed', column: 'Status', equals: ['Odbijeno'] },
  ],
}

describe('a recipe the chat writes', () => {
  it('reads every row of the file with the recipe, and keeps the recipe with the rows it imports in one write', async () => {
    const desk = await spendingDesk(used)
    const file = await held('promet.csv', STATEMENT)

    const proposed = await desk.propose([stepOf(SPENDING_OPERATIONS, 'save-recipe', { ...RECIPE, file: file.id })], [file])
    expect(proposed.isError).toBe(false)
    const card = desk.cards[0]!
    const recipeGroup = card.groups.find((group) => group.noun.en.one === RECIPE_RECORDS.noun.en.one)!
    expect(recipeGroup.verb).toBe('add')
    expect(JSON.stringify(recipeGroup.lines[0])).toContain('OTP statement export')
    expect(JSON.stringify(recipeGroup.lines[0])).toContain('Day from Datum, as 31.12.2026')

    expect(await desk.accept()).toMatchObject({ kind: 'done' })
    const book = desk.store.state.workbook!
    expect(book.recipes.filter((saved) => saved.id !== DESK_RECIPE.id).map((saved) => [saved.recipe.name, saved.bank, saved.currency])).toEqual([['OTP statement export', 'OTP banka', 'EUR']])
    const imported = book.transactions.filter((row) => row.account === DESK_ACCOUNTS.CURRENT.id && row.statement === 'promet.csv')
    expect(imported.map((row) => [row.date, row.amount, row.payee])).toEqual([
      ['2026-11-02', accountMoneyFromAmount(-12.5), 'Corner market'],
      ['2026-11-03', accountMoneyFromAmount(1200), 'Salary'],
    ])
  })

  it('names only the values no kind took when a row fits no kind', async () => {
    const desk = await spendingDesk(used)
    const file = await held('promet.csv', STATEMENT)
    const kinds = [{ kind: 'payment', column: 'Status', equals: ['Proknjiženo'] }]

    const refused = await desk.propose([stepOf(SPENDING_OPERATIONS, 'save-recipe', { ...RECIPE, kinds, file: file.id })], [file])
    expect(refused.isError).toBe(true)
    expect(refused.text).toContain('Status: "Odbijeno" on 1')
    expect(refused.text).not.toContain('Harbour bistro')
  })

  it("refuses a file Revolut's recipe reads already, since Import reads it with no AI", async () => {
    const desk = await spendingDesk(used)
    const revolut =
      'Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance\nCARD_PAYMENT,Current,2026-11-02 10:00:00,2026-11-02 10:01:00,Corner market,-12.50,0.00,EUR,COMPLETED,87.50\n'
    const file = await held('account-statement.csv', revolut)

    const refused = await desk.propose([stepOf(SPENDING_OPERATIONS, 'save-recipe', { ...RECIPE, file: file.id })], [file])
    expect(refused.text).toContain('The recipe Revolut reads this file already')
  })

  it('changes a saved recipe to read a renamed column, and reads the file with it', async () => {
    const desk = await spendingDesk(used)
    const file = await held('promet.csv', STATEMENT)
    await desk.propose([stepOf(SPENDING_OPERATIONS, 'save-recipe', { ...RECIPE, file: file.id })], [file])
    await desk.accept()
    const recipe = desk.ref('recipe', desk.store.state.workbook!.recipes.find((saved) => saved.id !== DESK_RECIPE.id)!.id)
    const renamed = await held('promet-2.csv', STATEMENT.replace('Datum;', 'Datum valute;').replace('02.11.2026', '05.11.2026'), 'a2')

    const changed = await desk.propose([stepOf(SPENDING_OPERATIONS, 'change-recipe', { ...RECIPE, dateColumn: 'Datum valute', recipe, file: renamed.id })], [renamed])
    expect(changed.isError).toBe(false)
    expect(await desk.accept()).toMatchObject({ kind: 'done' })
    expect(desk.store.state.workbook!.transactions.some((row) => row.statement === 'promet-2.csv' && row.date === '2026-11-05')).toBe(true)
  })
})
