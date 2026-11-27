import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { shotIndex } from '../scripts/support/shotIndex.mjs'

// The index writes its list into its folder as the process exits, after the spec has removed the folder.
vi.mock('../scripts/support/runEnd.mjs', () => ({ whenRunEnds: () => () => undefined }))

const made: string[] = []

function freshIndex() {
  const folder = mkdtempSync(join(tmpdir(), 'kuna-shot-index-spec-'))
  made.push(folder)
  return shotIndex(folder, false)
}

afterEach(() => {
  for (const folder of made.splice(0)) rmSync(folder, { recursive: true, force: true })
})

describe("a check's shot index", () => {
  it('refuses a file another flow wrote in the same run, so the later shot never replaces the earlier', () => {
    const shots = freshIndex()
    shots.begin('statements-held')
    shots.path('phone-drive-sync-steps-dark.png')
    shots.begin('statements-sync')

    expect(() => shots.path('phone-drive-sync-steps-dark.png')).toThrow("phone-drive-sync-steps-dark.png is statements-held's shot already, so statements-sync would replace it")
  })

  it('lets a flow write its own file again, as a flow begun again at another width or theme does', () => {
    const shots = freshIndex()
    shots.begin('statements-held')
    shots.path('phone-drive-sync-steps-dark.png')
    shots.begin('statements-sync')
    shots.path('phone-drive-mail-step-dark.png')
    shots.begin('statements-held')

    expect(() => shots.path('phone-drive-sync-steps-dark.png')).not.toThrow()
  })
})
