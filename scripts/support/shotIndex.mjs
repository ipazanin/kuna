import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { whenRunEnds } from './runEnd.mjs'

const INDEX_FILE = 'shots.json'

/**
 * The screenshots of a check, kept in `folder` with a list of which screen, flow or step wrote each. A full run starts
 * from an empty folder. A limited run removes the shots a screen wrote last time as it starts that screen, so a shot
 * the screen no longer takes never passes for this run's, and it keeps every other screen's shots.
 */
export function shotIndex(folder, limited) {
  mkdirSync(folder, { recursive: true })
  const indexPath = join(folder, INDEX_FILE)
  const earlier = limited && existsSync(indexPath) ? JSON.parse(readFileSync(indexPath, 'utf8')) : {}
  if (!limited) {
    for (const stale of readdirSync(folder).filter((file) => file.endsWith('.png'))) rmSync(join(folder, stale))
  }
  const written = new Map()
  let current = null
  whenRunEnds(() => {
    const kept = Object.entries(earlier).filter(([name]) => !written.has(name))
    const now = [...written].map(([name, files]) => [name, [...files].sort()])
    writeFileSync(indexPath, `${JSON.stringify(Object.fromEntries([...kept, ...now].sort(([one], [other]) => one.localeCompare(other))), null, 2)}\n`)
  })
  return {
    /** Starts the shots of `name`, removing those it wrote in an earlier run. The shots after it belong to it. */
    begin(name) {
      current = name
      if (written.has(name)) return
      written.set(name, new Set())
      for (const file of earlier[name] ?? []) rmSync(join(folder, file), { force: true })
    },
    /** Where the shot called `file` goes, kept under the screen begun last. */
    path(file) {
      written.get(current)?.add(file)
      return join(folder, file)
    },
  }
}
