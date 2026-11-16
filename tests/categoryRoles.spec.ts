import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

import { codecOfSpendingKind } from '../src/apps/spending/workbook/application/spendingCodecs'
import { CATEGORY_RECORDS } from '../src/apps/spending/workbook/domain/spendingKinds'
import type { Category } from '../src/apps/spending/workbook/domain/category'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import type { RecordFields } from '../src/shared/storage/domain/recordFields'
import { storedFieldsOfValues } from '../src/shared/storage/domain/storedFields'

const GROUP = '5e000000-0000-4000-8000-000000000001'
const codec = codecOfSpendingKind(CATEGORY_RECORDS)

function read(fields: RecordFields): Category {
  return codec.make(storedFieldsOfValues(fields), recordIdOf(CATEGORY_RECORDS, '5e000000-0000-4000-8000-000000000002'))
}

const child = (name: string, fields: RecordFields = {}): RecordFields => ({ name, kind: 'spending', parent: GROUP, order: '1', ...fields })

describe('the role of a category Kuna fills', () => {
  it('is given once by its starter name in either language to a file from before roles, the older Loan instalments too', () => {
    expect(['Bank fees', 'Bankovne naknade', 'Loan interest', 'Kamate na kredit', 'Loan instalments', 'Rate kredita'].map((name) => read(child(name)).role)).toEqual([
      'bank-fees',
      'bank-fees',
      'loan-interest',
      'loan-interest',
      'loan-interest',
      'loan-interest',
    ])
  })

  it('is none for another name, a group, or a category that is not spending', () => {
    expect([read(child('Groceries')), read({ name: 'Loan interest', kind: 'spending', order: '1' }), read(child('Bank fees', { kind: 'income' }))].map((category) => category.role)).toEqual([
      null,
      null,
      null,
    ])
  })

  it('is stored when the category is next written, so a rename after it keeps the role', () => {
    const renamed = { ...read(child('Kamate na kredit')), name: 'Kamate stambenog' }

    expect(codec.fieldsOf(renamed)).toMatchObject({ name: 'Kamate stambenog', role: 'loan-interest' })
    expect(read(codec.fieldsOf(renamed)).role).toBe('loan-interest')
  })

  it('is refused when the file names a role Kuna does not know', () => {
    expect(() => read(child('Fees', { role: 'fees' }))).toThrow('role of category')
  })
})

/** Every TypeScript and Vue file under the folder. */
function sourcesUnder(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name)
    if (entry.isDirectory()) return sourcesUnder(path)
    return /\.(ts|vue)$/.test(entry.name) ? [path] : []
  })
}

describe('finding a Spending category', () => {
  // Reading a file from before roles is the one place a name gives a category its role.
  const READS_NAMES_BEFORE_ROLES = 'src/apps/spending/workbook/domain/categoryReading.ts'
  const BY_NAME = /\b\w*(?:[cC]ategor\w*|group|child|held)\.name\s*[!=]==|\.includes\(\s*\w*(?:[cC]ategor\w*|group|child|held)\.name\s*\)/

  it('goes by its id, kind or role, never by its name', () => {
    const root = join(__dirname, '..')
    const byName = sourcesUnder(join(root, 'src/apps/spending'))
      .map((path) => relative(root, path))
      .filter((path) => path !== READS_NAMES_BEFORE_ROLES)
      .flatMap((path) =>
        readFileSync(join(root, path), 'utf8')
          .split('\n')
          .flatMap((line, place) => (BY_NAME.test(line) ? [`${path}:${place + 1}`] : [])),
      )

    expect(byName).toEqual([])
  })
})
