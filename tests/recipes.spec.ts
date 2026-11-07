// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

import type { Recipe, RecipeSection } from '../src/shared/recipes/domain/recipe'
import { runRecipe } from '../src/shared/recipes/domain/runRecipe'
import type { RecipeRow, RecipeRun } from '../src/shared/recipes/domain/runRecipe'
import { fileNameFits, readRecipeFile } from '../src/shared/recipes/infrastructure/recipeFile'
import { decimalOfText } from '../src/shared/money/decimal'

const ROWS: RecipeSection = {
  name: 'Rows',
  rows: 'Rows/Row',
  keep: [{ column: 'level', is: ['DETAIL'] }],
  shown: ['when', 'what', 'absent'],
  fields: {
    key: { from: 'id', as: 'text' },
    day: { from: 'when', as: 'date', formats: ['yyyyMMdd;HHmmss', 'yyyyMMdd'] },
    time: { from: 'when', as: 'time', formats: ['yyyyMMdd;HHmmss', 'yyyyMMdd'], blank: true },
    amount: { from: 'amount', as: 'decimal' },
    note: { from: 'note', as: 'text', blank: true },
  },
  kinds: [
    {
      kind: 'in',
      when: [
        { column: 'what', is: ['Pay'] },
        { column: 'amount', sign: 'above-zero' },
        { column: 'codes', partsWithin: ['A', 'B'], separator: ';' },
      ],
      fields: { money: { from: 'pair', as: 'currency', part: { separator: '.', at: 0 } } },
    },
    {
      kind: 'out',
      when: [
        { column: 'what', is: ['Pay'] },
        { column: 'amount', sign: 'below-zero' },
        { column: 'codes', partsWithin: ['A', 'B'], separator: ';' },
      ],
      fields: {},
    },
  ],
}

const XML_RECIPE: Recipe = { id: 'test', name: 'Test report', mail: { senders: [], subject: '', contents: '' }, file: { format: 'xml', root: 'Report' }, sections: [ROWS] }

function bytesOf(text: string): ArrayBuffer {
  return new TextEncoder().encode(text).buffer as ArrayBuffer
}

function row(attributes: Readonly<Record<string, string>>): string {
  const all = { id: '1', level: 'DETAIL', when: '20261102;093000', what: 'Pay', amount: '1.5', codes: '', pair: 'EUR.USD', note: '', ...attributes }
  return `<Row ${Object.entries(all)
    .map(([name, text]) => `${name}="${text}"`)
    .join(' ')} />`
}

function runXml(body: string, recipe: Recipe = XML_RECIPE): RecipeRun {
  const file = readRecipeFile(recipe, bytesOf(`<Report><Inner><Rows>${body}</Rows></Inner></Report>`))
  return file.kind === 'misfit' ? { kind: 'misfit', misfit: file.misfit } : runRecipe(recipe, file.rows)
}

function readRows(run: RecipeRun): readonly RecipeRow[] {
  if (run.kind !== 'read') throw new Error(`Expected rows, got ${run.misfit.kind}`)
  return run.rows
}

describe('a recipe run', () => {
  it('reads a row into its fields by type, with its kind from the first rule it passes', () => {
    const [read] = readRows(runXml(row({})))
    expect(read).toMatchObject({ section: 'Rows', kind: 'in', texts: { key: '1', time: '09:30:00', note: null }, dates: { day: '2026-11-02' }, currencies: { money: 'EUR' } })
    expect(read!.decimals.amount).toBe(decimalOfText('1.5'))
  })

  it('takes a date with no time, whose time is blank', () => {
    const [read] = readRows(runXml(row({ when: '20261102' })))
    expect(read).toMatchObject({ dates: { day: '2026-11-02' }, texts: { time: '' } })
  })

  it('tells kinds apart by the sign of a number and passes over rows the section does not keep', () => {
    const rows = readRows(runXml([row({ amount: '-3' }), row({ id: '2', level: 'SUMMARY' })].join('')))
    expect(rows.map((read) => [read.kind, read.texts.key])).toEqual([['out', '1']])
  })

  it.each([
    ['another type', { what: 'Other' }],
    ['a code outside the list', { codes: 'A;Ca' }],
    ['a zero amount, which neither sign takes', { amount: '0' }],
  ])('asks about a row no kind takes: %s', (_case, attributes) => {
    const run = runXml(row(attributes))
    expect(run).toMatchObject({ kind: 'read', rows: [], asked: [{ section: 'Rows', why: { kind: 'no-kind' } }] })
  })

  it.each([
    ['a date in no format', { when: '02.11.2026' }, 'day'],
    ['a month that does not exist', { when: '20261302' }, 'day'],
    ['a blank field that may not be blank', { id: '' }, 'key'],
    ['a number that is not one', { amount: '1,5', what: 'Pay', codes: 'A' }, null],
    ['a currency Kuna does not know', { pair: 'XXQ.USD' }, 'money'],
  ])('asks about a row whose field cannot be read rather than guess: %s', (_case, attributes, field) => {
    const run = runXml(row(attributes))
    if (run.kind !== 'read') throw new Error('It fits.')
    expect(run.rows).toEqual([])
    if (field !== null) expect(run.asked[0]?.why).toMatchObject({ kind: 'unreadable', field })
    else expect(run.asked[0]?.why).toEqual({ kind: 'no-kind' })
  })

  it('gives a row asked about the same key in a later file, and shows only the columns it has', () => {
    const [first, second] = [runXml(row({ what: 'Other' })), runXml(row({ what: 'Other' }))]
    if (first.kind !== 'read' || second.kind !== 'read') throw new Error('It fits.')
    expect(first.asked[0]?.key).toBe(second.asked[0]?.key)
    expect(first.asked[0]?.shown).toEqual([
      ['when', '20261102;093000'],
      ['what', 'Other'],
    ])
  })

  it('gives a row asked about the dates its section reads, and null for one it cannot read', () => {
    const [noKind, badDate] = [runXml(row({ what: 'Other' })), runXml(row({ when: '02.11.2026' }))]
    if (noKind.kind !== 'read' || badDate.kind !== 'read') throw new Error('It fits.')
    expect(noKind.asked[0]?.dates).toEqual({ day: '2026-11-02' })
    expect(badDate.asked[0]?.dates).toEqual({ day: null })
  })

  it('fails a file with no such section, even when its other sections fit', () => {
    const file = readRecipeFile(XML_RECIPE, bytesOf('<Report><Other /></Report>'))
    expect(file.kind === 'read' && runRecipe(XML_RECIPE, file.rows)).toEqual({ kind: 'misfit', misfit: { kind: 'no-section', section: 'Rows' } })
  })

  it('takes an empty section as no rows', () => {
    expect(runXml('')).toEqual({ kind: 'read', rows: [], asked: [] })
  })

  it('fails a file whose rows lack a column the section reads, since a blank would be a guess', () => {
    const run = runXml('<Row id="1" level="DETAIL" when="20261102" what="Pay" codes="" pair="EUR.USD" note="" />')
    expect(run).toEqual({ kind: 'misfit', misfit: { kind: 'no-column', section: 'Rows', column: 'amount' } })
  })

  it('fails a file with another root, and one that is not XML', () => {
    expect(readRecipeFile(XML_RECIPE, bytesOf('<Other />'))).toEqual({ kind: 'misfit', misfit: { kind: 'no-root', root: 'Report' } })
    expect(readRecipeFile(XML_RECIPE, bytesOf('not xml at all'))).toEqual({ kind: 'misfit', misfit: { kind: 'not-readable' } })
  })
})

describe('the file a recipe reads', () => {
  it.each([
    ['report.XML', true],
    ['report.pdf', false],
  ])('tells whether an attachment is XML by its name: %s', (name, fits) => {
    expect(fileNameFits({ file: { format: 'xml', root: 'R' } }, name)).toBe(fits)
  })
})
