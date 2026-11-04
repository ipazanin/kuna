/**
 * Regenerates the index in docs/tasks/README.md from each task file's frontmatter. tests/docsIndex.spec.ts fails while it is stale.
 *
 *   npm run tasks-index
 */

import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as prettier from 'prettier'

export const TASKS_DIR = join(dirname(fileURLToPath(import.meta.url)), '../docs/tasks')
export const TASKS_README = join(TASKS_DIR, 'README.md')
const KEYS = ['status', 'feature', 'summary']
/** The statuses in the order the index lists them. */
export const STATUSES = ['researching', 'planned', 'waiting', 'idea', 'done']
const HEADINGS = { researching: 'Researching', planned: 'Planned', waiting: 'Waiting', idea: 'Ideas', done: 'Done' }
const START = '<!-- TASKS-INDEX:START -->'
const END = '<!-- TASKS-INDEX:END -->'

/** Every task file, the README left out. */
export function taskPaths() {
  return readdirSync(TASKS_DIR)
    .filter((name) => name.endsWith('.md') && name !== 'README.md')
    .map((name) => join(TASKS_DIR, name))
}

/** A task file's frontmatter and title. Throws on a missing, unknown or malformed field, so the index never hides one. */
export function taskFile(path) {
  const name = basename(path)
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
  const missing = KEYS.filter((key) => !fields[key])
  if (missing.length > 0) {
    throw new Error(`${name}: ${missing.join(', ')} missing`)
  }
  if (!STATUSES.includes(fields.status)) {
    throw new Error(`${name}: status "${fields.status}" is not one of ${STATUSES.join(', ')}`)
  }
  const title = text.slice(block[0].length).match(/^# (.+)$/m)?.[1]
  if (title === undefined) {
    throw new Error(`${name}: no # heading`)
  }
  return { name, title, status: fields.status, feature: fields.feature, summary: fields.summary }
}

function table(tasks) {
  const rows = tasks.map((task) => `| [${task.title}](${task.name}) | ${task.feature} | ${task.summary} |`)
  return ['| Task | Feature | Summary |', '| --- | --- | --- |', ...rows].join('\n')
}

/** The README as the index should leave it, formatted as Prettier formats it. */
export async function indexedTasksReadme() {
  const tasks = taskPaths()
    .map(taskFile)
    .sort((first, second) => first.name.localeCompare(second.name))
  const byStatus = Map.groupBy(tasks, (task) => task.status)
  const block = STATUSES.filter((status) => byStatus.has(status))
    .map((status) => `### ${HEADINGS[status]}\n\n${table(byStatus.get(status))}`)
    .join('\n\n')
  const current = readFileSync(TASKS_README, 'utf8')
  const from = current.indexOf(START)
  const to = current.indexOf(END)
  if (from < 0 || to < from) {
    throw new Error(`docs/tasks/README.md: expected ${START} before ${END}`)
  }
  const next = `${current.slice(0, from + START.length)}\n\n${block}\n\n${current.slice(to)}`
  return prettier.format(next, { ...(await prettier.resolveConfig(TASKS_README)), filepath: TASKS_README })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(TASKS_README, await indexedTasksReadme())
  console.log('Regenerated docs/tasks/README.md')
}
