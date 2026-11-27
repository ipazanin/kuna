import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { realBooksPath, realSyncDefine } from '../scripts/devRealBooks'

describe('KUNA_REAL_SYNC on npm run dev:real', () => {
  it('adds nothing to the env while the variable is unset or empty', () => {
    expect(realSyncDefine(undefined)).toEqual({})
    expect(realSyncDefine('')).toEqual({})
  })

  it('turns on the fake build and names the app whose real books go on its Drive', () => {
    expect(realSyncDefine('spending')).toEqual({
      'import.meta.env.VITE_FAKE_WORKBOOK': '"true"',
      'import.meta.env.VITE_REAL_SYNC': '"spending"',
    })
  })

  it('refuses a name that is no app with books, such as the rates file', () => {
    expect(() => realSyncDefine('rates')).toThrow('KUNA_REAL_SYNC names no app: rates.')
  })
})

describe('where npm run dev:real finds a real books file', () => {
  const made: string[] = []

  afterEach(() => {
    for (const folder of made.splice(0)) rmSync(folder, { recursive: true, force: true })
  })

  function booksFolder(files: readonly string[]): string {
    const folder = mkdtempSync(join(tmpdir(), 'kuna-dev-real-books-spec-'))
    made.push(folder)
    for (const file of files) {
      mkdirSync(dirname(join(folder, file)), { recursive: true })
      writeFileSync(join(folder, file), '{}')
    }
    return folder
  }

  it('reads a flat copy from the top of the folder', async () => {
    const folder = booksFolder(['kuna-company.json', 'kuna-rates.json'])
    expect(await realBooksPath(folder, 'kuna-company.json')).toBe(join(folder, 'kuna-company.json'))
    expect(await realBooksPath(folder, 'kuna-rates.json')).toBe(join(folder, 'kuna-rates.json'))
  })

  it('reads a book from its app folder, as the Drive keeps it, with the prices beside the Investments book', async () => {
    const folder = booksFolder(['company/kuna-company.json', 'investments/kuna-investments.json', 'investments/kuna-investments-prices.json'])
    expect(await realBooksPath(folder, 'kuna-company.json')).toBe(join(folder, 'company', 'kuna-company.json'))
    expect(await realBooksPath(folder, 'kuna-investments-prices.json')).toBe(join(folder, 'investments', 'kuna-investments-prices.json'))
  })

  it('takes the flat file when the folder holds both', async () => {
    const folder = booksFolder(['kuna-loans.json', 'loans/kuna-loans.json'])
    expect(await realBooksPath(folder, 'kuna-loans.json')).toBe(join(folder, 'kuna-loans.json'))
  })

  it('finds nothing for a missing book, a book in another app folder, a folder named like the file or an unknown name', async () => {
    const folder = booksFolder(['spending/kuna-assets.json', 'other.json'])
    mkdirSync(join(folder, 'kuna-loans.json'))
    expect(await realBooksPath(folder, 'kuna-company.json')).toBeNull()
    expect(await realBooksPath(folder, 'kuna-assets.json')).toBeNull()
    expect(await realBooksPath(folder, 'kuna-loans.json')).toBeNull()
    expect(await realBooksPath(folder, 'other.json')).toBeNull()
  })
})
