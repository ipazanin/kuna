import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const page = readFileSync(fileURLToPath(new URL('../public/privacy.html', import.meta.url)), 'utf8')
const appsFolder = fileURLToPath(new URL('../src/apps', import.meta.url))

function section(heading: string): string {
  return page.slice(page.indexOf(`<h2>${heading}</h2>`)).split('</section>')[0]!
}

function sourcesUnder(folder: string): readonly string[] {
  return readdirSync(folder, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
    .map((entry) => readFileSync(join(entry.parentPath, entry.name), 'utf8'))
}

/** The apps that hand the chat a reader, found by the function that builds one, so a new reader fails this spec until the page names it. */
const APPS_WITH_A_READER = readdirSync(appsFolder, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .filter((app) => sourcesUnder(join(appsFolder, app)).some((source) => /\):\s*AppReader\b/.test(source)))

describe('the privacy page', () => {
  it('says where bank rows go', () => {
    expect(section('Where your data goes')).toContain('api.enablebanking.com')
    expect(section('Where your data goes')).toContain('IBANs')
  })

  it('says removing Kuna does not end a bank link, and how to', () => {
    expect(section('How to revoke access')).toContain('Script')
    expect(section('How to revoke access')).toContain('at your bank')
  })

  it('names what the browser keeps for a link', () => {
    for (const key of ['kuna.bank-link', 'kuna.bank-return', 'kuna.bank-sync-fetched']) expect(page).toContain(key)
  })

  it('finds the apps the chat reads', () => {
    expect(APPS_WITH_A_READER).toEqual(['assets', 'company', 'investments', 'loans', 'spending'])
  })

  it.each(APPS_WITH_A_READER)('says what the chat reads of %s, on a line of its own', async (app) => {
    const { en } = (await import(`../src/apps/${app}/words.ts`)) as { en: { name: string } }
    expect(section('The assistant')).toMatch(new RegExp(`<li>\\s*${en.name}:`))
  })
})
