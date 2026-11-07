import { describe, expect, it } from 'vitest'

import { fileKeptNote } from '../src/shared/storage/presentation/fileKeptNote'
import { words } from '../src/shared/storage/presentation/words'

const NOTE = { onDrive: (name: string) => `on Drive as ${name}`, inBrowser: 'in this browser' }
const NOUN = { en: { one: 'loan', article: 'a' }, hr: { one: 'kredit' } } as never

describe('where an app says its file is kept', () => {
  it('names the file on Drive, and says this browser otherwise', () => {
    expect(fileKeptNote({ source: 'drive', id: 'one', name: 'kuna-loans.json' }, NOTE)).toBe('on Drive as kuna-loans.json')
    expect(fileKeptNote({ source: 'browser', id: 'one', name: 'kuna-loans.json' }, NOTE)).toBe('in this browser')
    expect(fileKeptNote(null, NOTE)).toBe('in this browser')
  })
})

describe('a problem line in a file', () => {
  it('names the record by its kind and label, and why', () => {
    expect(words.recordProblem(NOUN, 'Home', 'no principal')).toBe('Loan "Home": no principal')
  })
})
