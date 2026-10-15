/**
 * Fails the build if the fake workbook or the spike screen reached the production bundle.
 *
 * Both are dropped only because their guards are written inline (`import.meta.env.VITE_FAKE_WORKBOOK
 * === 'true'` in main.ts, `import.meta.env.DEV` in the router), which the build folds to false.
 * Moving a guard into a shared constant can stop that folding without any visible change in the
 * source, so the proof is taken from the output.
 *
 * Runs as the tail of `npm run build`. With no `dist/` there is nothing to inspect.
 *
 *   node scripts/assert-no-fake-bytes.mjs
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import { FAKE_WORKBOOK_MARKER, SPIKE_LOG_PREFIX } from './support/devOnlyMarkers.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const BUNDLE = join(ROOT, 'dist')

if (!existsSync(BUNDLE)) process.exit(0)

function* filesUnder(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) yield* filesUnder(path)
    else if (entry.isFile()) yield path
  }
}

const bundledFiles = [...filesUnder(BUNDLE)].map((path) => ({ path, text: readFileSync(path, 'utf8') }))

let failed = false
for (const marker of [FAKE_WORKBOOK_MARKER, SPIKE_LOG_PREFIX]) {
  const contaminated = bundledFiles.filter((file) => file.text.includes(marker))
  if (contaminated.length === 0) continue
  failed = true
  console.error(`Dev-only bytes shipped: ${marker} appears in ${contaminated.length} bundled file(s).`)
  for (const file of contaminated) console.error(`  dist/${relative(BUNDLE, file.path)}`)
}

if (failed) {
  console.error('Check that the VITE_FAKE_WORKBOOK and import.meta.env.DEV guards are still written inline.')
  process.exit(1)
}
