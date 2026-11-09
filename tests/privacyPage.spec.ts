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

  it("states the limits a file read keeps to, as the chat's code sets them", async () => {
    const { MOST_CHARACTERS_A_READ, MOST_INFLATED_BYTES, MOST_PAGES_A_READ, MOST_ROWS_A_READ, MOST_WAITING } = await import('../src/shared/ai/domain/chatAttachments')
    const { MOST_CELL_CHARACTERS, KEY_REMOVED } = await import('../src/shared/ai/domain/fileCells')
    const text = section('The assistant').replace(/\s+/g, ' ')
    expect(text).toContain(`at most ${MOST_ROWS_A_READ} rows and ${MOST_CHARACTERS_A_READ.toLocaleString('en')} characters a read`)
    expect(text).toContain(`cuts a cell past ${MOST_CELL_CHARACTERS} characters`)
    expect(text).toContain(`<code>${KEY_REMOVED}</code>`)
    expect(text).toContain(`unpacks past ${MOST_INFLATED_BYTES / 1024 / 1024} MB`)
    expect(text).toContain(`up to ${MOST_PAGES_A_READ} pages a read`)
    expect(text).toContain(`up to ${['', 'one', 'two', 'three', 'four'][MOST_WAITING]} files`)
  })
})
