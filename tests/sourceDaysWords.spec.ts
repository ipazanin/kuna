import { readFileSync } from 'node:fs'

import { afterEach, describe, expect, it, vi } from 'vitest'

import type { HandedDays } from '../src/shared/app/accountSource'
import { givenDaysLine, handedDaysLine } from '../src/shared/app/sourceDaysWords'
import { civil } from './fixtures/ledger'

const NAMES = { 'provider-file': 'Statement file', 'by-hand': 'By hand' } as const
const HR_NAMES = { 'provider-file': 'Datoteka izvoda', 'by-hand': 'Ručno' } as const

function run(from: string | null, to: string | null): HandedDays<'provider-file' | 'by-hand'> {
  return { from: from === null ? null : civil(from), to: to === null ? null : civil(to), before: 'by-hand', after: 'provider-file' }
}

async function inCroatian(): Promise<typeof import('../src/shared/app/sourceDaysWords')> {
  vi.resetModules()
  vi.doMock('../src/shared/text/language', () => ({ language: 'hr', intlLocale: 'hr-HR' }))
  return import('../src/shared/app/sourceDaysWords')
}

afterEach(() => {
  vi.doUnmock('../src/shared/text/language')
})

describe('the line for a run of days that changes source', () => {
  it('names the days as a run of days reads, the first day as short as the last allows', () => {
    expect(handedDaysLine(run('2026-03-01', '2026-03-14'), NAMES)).toBe('1–14 Mar 2026: “By hand” gives way to “Statement file”.')
    expect(handedDaysLine(run('2026-02-20', '2026-03-14'), NAMES)).toBe('20 Feb – 14 Mar 2026: “By hand” gives way to “Statement file”.')
    expect(handedDaysLine(run('2025-12-30', '2026-01-02'), NAMES)).toBe('30 Dec 2025 – 2 Jan 2026: “By hand” gives way to “Statement file”.')
    expect(handedDaysLine(run('2026-03-14', '2026-03-14'), NAMES)).toBe('14 Mar 2026: “By hand” gives way to “Statement file”.')
  })

  it('names a run with an open end from its day on, up to its day, or every day', () => {
    expect(handedDaysLine(run('2026-03-14', null), NAMES)).toBe('From 14 Mar 2026 on: “By hand” gives way to “Statement file”.')
    expect(handedDaysLine(run(null, '2026-03-14'), NAMES)).toBe('Up to 14 Mar 2026: “By hand” gives way to “Statement file”.')
    expect(handedDaysLine(run(null, null), NAMES)).toBe('Every day: “By hand” gives way to “Statement file”.')
    expect(givenDaysLine({ from: null, to: civil('2026-03-14'), after: 'provider-file' }, NAMES)).toBe('Up to 14 Mar 2026: “Statement file” brings its rows.')
  })

  it('opens the Croatian sentence with the days and names the month in the genitive after a day', async () => {
    const { handedDaysLine: croatian } = await inCroatian()

    expect(croatian(run('2026-03-01', '2026-03-14'), HR_NAMES)).toBe('Od 1. do 14. ožujka 2026. izvor „Ručno” ustupa mjesto izvoru „Datoteka izvoda”.')
    expect(croatian(run('2026-02-20', '2026-03-14'), HR_NAMES)).toBe('Od 20. veljače do 14. ožujka 2026. izvor „Ručno” ustupa mjesto izvoru „Datoteka izvoda”.')
    expect(croatian(run('2025-12-30', '2026-01-02'), HR_NAMES)).toBe('Od 30. prosinca 2025. do 2. siječnja 2026. izvor „Ručno” ustupa mjesto izvoru „Datoteka izvoda”.')
    expect(croatian(run('2026-03-14', '2026-03-14'), HR_NAMES)).toBe('14. ožujka 2026. izvor „Ručno” ustupa mjesto izvoru „Datoteka izvoda”.')
  })

  it('names a Croatian run with an open end from its day on, up to its day, or every day', async () => {
    const { givenDaysLine: croatianGiven, handedDaysLine: croatian } = await inCroatian()

    expect(croatian(run('2026-03-14', null), HR_NAMES)).toBe('Od 14. ožujka 2026. nadalje izvor „Ručno” ustupa mjesto izvoru „Datoteka izvoda”.')
    expect(croatian(run(null, '2026-03-14'), HR_NAMES)).toBe('Do 14. ožujka 2026. izvor „Ručno” ustupa mjesto izvoru „Datoteka izvoda”.')
    expect(croatian(run(null, null), HR_NAMES)).toBe('Svih dana izvor „Ručno” ustupa mjesto izvoru „Datoteka izvoda”.')
    expect(croatianGiven({ from: null, to: civil('2026-03-14'), after: 'provider-file' }, HR_NAMES)).toBe('Do 14. ožujka 2026. dane puni izvor „Datoteka izvoda”.')
  })
})

describe('the apps that warn of a source handover', () => {
  const APP_FILES = ['spending/accounts', 'company/settings', 'investments/settings'].map((folder) => `../src/apps/${folder}/presentation`)

  it('word their runs of days through the shared line and keep no day-run sentence of their own', () => {
    for (const folder of APP_FILES) {
      expect(readFileSync(new URL(`${folder}/sourceHandoverWords.ts`, import.meta.url), 'utf8')).toContain("from '../../../../shared/app/sourceDaysWords'")
      const words = readFileSync(new URL(`${folder}/words.ts`, import.meta.url), 'utf8')
      for (const phrase of ['gives way to', 'ustupa mjesto', '” brings its rows', '” donosi svoje', '” dane puni']) expect(words, `${folder}/words.ts`).not.toContain(phrase)
    }
  })
})

describe('Croatian words', () => {
  const WORDS = import.meta.glob<string>('../src/**/words.ts', { eager: true, query: '?raw', import: 'default' })

  it('write a run of days inside a sentence through dayRunInText, never as od and do around two numeric days', () => {
    const numericRuns = Object.entries(WORDS).filter(([, source]) => /od \$\{dayLabel\([^}]*\)\} do \$\{dayLabel\(/.test(source))

    expect(numericRuns.map(([path]) => path)).toEqual([])
  })
})
