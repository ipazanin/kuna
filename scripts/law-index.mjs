/**
 * Regenerates the index in docs/law/README.md from each law file's frontmatter. tests/lawDocs.spec.ts fails while it is stale.
 *
 *   npm run law-index
 */

import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as prettier from 'prettier'

const LAW_DIR = join(dirname(fileURLToPath(import.meta.url)), '../docs/law')
export const LAW_README = join(LAW_DIR, 'README.md')
const KEYS = ['checked', 'nn_through', 'summary']
const START = '<!-- LAW-INDEX:START -->'
const END = '<!-- LAW-INDEX:END -->'

function lawFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      return lawFiles(path)
    }
    return entry.name.endsWith('.md') && path !== LAW_README ? [path] : []
  })
}

/** A law file's frontmatter and title. Throws on a missing or malformed field, so the index never hides one. */
export function lawFile(path) {
  const name = relative(LAW_DIR, path)
  const text = readFileSync(path, 'utf8')
  const block = text.match(/^---\n([\s\S]*?)\n---\n/)
  if (block === null) {
    throw new Error(`${name}: missing frontmatter`)
  }
  const fields = Object.fromEntries(
    block[1].split('\n').map((line) => {
      const pair = line.match(/^([a-z_]+): (.+)$/)
      if (pair === null || !KEYS.includes(pair[1])) {
        throw new Error(`${name}: cannot read frontmatter line "${line}". The keys are ${KEYS.join(', ')}`)
      }
      return [pair[1], pair[2].trim()]
    }),
  )
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fields.checked ?? '')) {
    throw new Error(`${name}: checked must be the day the law was last verified, as 2026-11-04`)
  }
  if (!/^\d{1,3}\/\d{2}$/.test(fields.nn_through ?? '')) {
    throw new Error(`${name}: nn_through must be the last Narodne novine issue checked, as 126/26`)
  }
  if (!fields.summary) {
    throw new Error(`${name}: summary is missing`)
  }
  const title = text.slice(block[0].length).match(/^# (.+)$/m)?.[1]
  if (title === undefined) {
    throw new Error(`${name}: no # heading`)
  }
  return { name, title, checked: fields.checked, nnThrough: fields.nn_through, summary: fields.summary }
}

function table(files) {
  const rows = files.map((file) => `| [${file.title}](${file.name}) | NN ${file.nnThrough}, ${file.checked} | ${file.summary} |`)
  return ['| File | Checked through | Covers |', '| --- | --- | --- |', ...rows].join('\n')
}

/** The README as the index should leave it, formatted as Prettier formats it. */
export async function indexedReadme() {
  const files = lawFiles(LAW_DIR)
    .map(lawFile)
    .sort((first, second) => first.name.localeCompare(second.name))
  const folders = Map.groupBy(files, (file) => dirname(file.name))
  const block = [...folders]
    .sort(([first], [second]) => Number(first !== '.') - Number(second !== '.') || first.localeCompare(second))
    .map(([folder, folderFiles]) => `### ${folder === '.' ? 'Rules' : `\`${folder}/\``}\n\n${table(folderFiles)}`)
    .join('\n\n')
  const current = readFileSync(LAW_README, 'utf8')
  const from = current.indexOf(START)
  const to = current.indexOf(END)
  if (from < 0 || to < from) {
    throw new Error(`docs/law/README.md: expected ${START} before ${END}`)
  }
  const next = `${current.slice(0, from + START.length)}\n\n${block}\n\n${current.slice(to)}`
  return prettier.format(next, { ...(await prettier.resolveConfig(LAW_README)), filepath: LAW_README })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(LAW_README, await indexedReadme())
  console.log('Regenerated docs/law/README.md')
}
