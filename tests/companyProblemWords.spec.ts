import { describe, expect, it } from 'vitest'

import { en } from '../src/apps/company/workbook/domain/words'
import { moneyFromCents } from '../src/shared/money/money'

/** What each argument of a sentence takes, by its name: a day for `date`, money for an amount, a count, invoice numbers, and else a word. */
function argumentOf(name: string): unknown {
  if (name === 'date') return '2026-03-09'
  if (['amount', 'balance', 'total', 'row'].includes(name)) return moneyFromCents(-6000)
  if (['count', 'rows'].includes(name)) return 2
  if (name === 'invoices') return ['1-3-26']
  if (name === 'deleted') return false
  return 'word'
}

/** The names of a function's parameters, as its source spells them. */
function parameterNames(sentence: (...args: never[]) => unknown): string[] {
  const head = /^\(?([^)=]*)\)?\s*=>/.exec(sentence.toString())?.[1] ?? ''
  return head
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name !== '')
}

/** Every sentence of the English words but the record labels, which quote the file's cells, each rendered with made-up arguments, by its path. */
function sentences(words: object, path = ''): [string, string][] {
  return Object.entries(words).flatMap(([key, value]): [string, string][] => {
    const at = path === '' ? key : `${path}.${key}`
    if (at === 'labels') return []
    if (typeof value === 'string') return [[at, value]]
    if (typeof value === 'function') {
      const said: unknown = value(...parameterNames(value as (...args: never[]) => unknown).map(argumentOf))
      return typeof said === 'string' ? [[at, said]] : sentences(said as object, at)
    }
    return typeof value === 'object' && value !== null ? sentences(value, at) : []
  })
}

describe("Company's English problem reasons", () => {
  it('show a day and an amount as people read them, never an ISO day or a bare amount', () => {
    const said = sentences(en)

    expect(said.length).toBeGreaterThan(30)
    expect(said.filter(([, sentence]) => /\d{4}-\d{2}-\d{2}/.test(sentence) || /(?<![€\d.,])-?\d+\.\d{2}\b/.test(sentence))).toEqual([])
  })
})
