import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, describe, expect, it } from 'vitest'

import { CLEANED, cleanCheckout } from '../scripts/clean.mjs'
import { checkoutProfilePrefix, PROFILE_PREFIX, sweepStaleProfiles } from '../scripts/support/browsers.mjs'

const SCRIPTS = fileURLToPath(new URL('../scripts', import.meta.url))
const DAY_MS = 24 * 60 * 60 * 1000
const made: string[] = []

function scratchFolder(): string {
  const folder = mkdtempSync(join(tmpdir(), 'kuna-cleanup-spec-'))
  made.push(folder)
  return folder
}

function folderAged(parent: string, name: string, ageMs: number): string {
  const path = join(parent, name)
  mkdirSync(path)
  writeFileSync(join(path, 'prefs.js'), '')
  const at = (Date.now() - ageMs) / 1000
  utimesSync(path, at, at)
  return path
}

afterEach(() => {
  for (const folder of made.splice(0)) rmSync(folder, { recursive: true, force: true })
})

describe('the stale profile sweep', () => {
  it('removes only browser profiles older than a day', () => {
    const folder = scratchFolder()
    folderAged(folder, `${PROFILE_PREFIX}old`, 2 * DAY_MS)
    folderAged(folder, `${PROFILE_PREFIX}fresh`, 60_000)
    folderAged(folder, 'puppeteer_dev_chrome_profile-old', 2 * DAY_MS)
    folderAged(folder, 'someone-else-old', 2 * DAY_MS)

    expect(sweepStaleProfiles(folder)).toEqual([`${PROFILE_PREFIX}old`])
    expect(readdirSync(folder).sort()).toEqual([`${PROFILE_PREFIX}fresh`, 'puppeteer_dev_chrome_profile-old', 'someone-else-old'])
  })

  it('leaves a symbolic link with the profile prefix and what it points at alone', () => {
    const folder = scratchFolder()
    const target = folderAged(scratchFolder(), 'kept', 2 * DAY_MS)
    symlinkSync(target, join(folder, `${PROFILE_PREFIX}link`))

    expect(sweepStaleProfiles(folder, Date.now() + 2 * DAY_MS)).toEqual([])
    expect(existsSync(join(target, 'prefs.js'))).toBe(true)
  })

  it('names each checkout its own profiles under the shared prefix', () => {
    expect(checkoutProfilePrefix('/one/kuna').startsWith(PROFILE_PREFIX)).toBe(true)
    expect(checkoutProfilePrefix('/one/kuna')).not.toBe(checkoutProfilePrefix('/one/kuna/.claude/worktrees/lane'))
  })
})

describe('npm run clean', () => {
  it('removes the shots, both builds and the Vite cache', () => {
    const checkout = scratchFolder()
    for (const folder of CLEANED) mkdirSync(join(checkout, folder), { recursive: true })
    mkdirSync(join(checkout, 'src'))

    expect(cleanCheckout(checkout)).toEqual(CLEANED)
    expect(readdirSync(checkout).sort()).toEqual(['node_modules', 'src'])
  })

  it('leaves the Vite cache alone when node_modules is a link to another checkout', () => {
    const checkout = scratchFolder()
    const mainCheckout = scratchFolder()
    mkdirSync(join(mainCheckout, 'node_modules', '.vite'), { recursive: true })
    symlinkSync(join(mainCheckout, 'node_modules'), join(checkout, 'node_modules'))
    mkdirSync(join(checkout, 'dist'))

    expect(cleanCheckout(checkout)).toEqual(['dist'])
    expect(existsSync(join(mainCheckout, 'node_modules', '.vite'))).toBe(true)
  })

  it('leaves a cleaned name that is a link alone', () => {
    const checkout = scratchFolder()
    const elsewhere = scratchFolder()
    writeFileSync(join(elsewhere, 'kept.png'), '')
    symlinkSync(elsewhere, join(checkout, 'visual-check'))

    expect(cleanCheckout(checkout)).toEqual([])
    expect(existsSync(join(elsewhere, 'kept.png'))).toBe(true)
  })
})

describe('browser launches', () => {
  it('go through withBrowser, so every check removes its profile', () => {
    const scripts = [...readdirSync(SCRIPTS).map((name) => join(SCRIPTS, name)), ...readdirSync(join(SCRIPTS, 'support')).map((name) => join(SCRIPTS, 'support', name))]
    const launching = scripts
      .filter((path) => path.endsWith('.mjs') && !path.endsWith(join('support', 'browsers.mjs')))
      .filter((path) => /\blaunch\s*\(|import\s*\{[^}]*\blaunch\b[^}]*\}\s*from\s*'puppeteer-core'/.test(readFileSync(path, 'utf8')))

    expect(launching).toEqual([])
  })
})
