import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

import { TASKS_README, indexedTasksReadme, taskFile, taskPaths } from '../scripts/tasks-index.mjs'

const root = join(import.meta.dirname, '..')
const docsDir = join(root, 'docs')
const lawDir = join(docsDir, 'law')
const featuresDir = join(docsDir, 'features')

/** Every Markdown file under docs, docs/law left out, since tests/lawDocs.spec.ts checks its links. */
function markdownFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      return path === lawDir ? [] : markdownFiles(path)
    }
    return entry.name.endsWith('.md') ? [path] : []
  })
}

/** The relative link targets of a Markdown file, outside fenced and inline code. */
function relativeLinks(path: string): string[] {
  let fenced = false
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter((line) => {
      if (line.startsWith('```')) {
        fenced = !fenced
        return false
      }
      return !fenced
    })
    .map((line) => line.replace(/`[^`]*`/g, ''))
    .flatMap((line) => [...line.matchAll(/\]\(([^)\s]+)\)/g)].map((match) => match[1]!))
    .filter((link) => !/^(https?:|mailto:)/.test(link))
}

describe('docs', () => {
  it('keeps the index in docs/tasks/README.md in step with the tasks, so run npm run tasks-index after changing one', async () => {
    expect(readFileSync(TASKS_README, 'utf8')).toBe(await indexedTasksReadme())
  })

  it.each(taskPaths().map((path) => relative(root, path)))('has frontmatter in %s that names a known status and feature', (file) => {
    const task = taskFile(join(root, file))
    const featureDir = join(featuresDir, task.feature)
    expect(
      task.feature === 'architecture' || (existsSync(featureDir) && statSync(featureDir).isDirectory()),
      `${file} names the feature ${task.feature}, which has no folder under docs/features`,
    ).toBe(true)
  })

  it.each(markdownFiles(docsDir).map((path) => relative(root, path)))('has links in %s that reach a file', (file) => {
    const path = join(root, file)
    const missing = relativeLinks(path).filter((link) => {
      const target = decodeURIComponent(link.split('#')[0]!)
      return target !== '' && !existsSync(join(dirname(path), target))
    })
    expect(missing, `${file} links to missing files`).toEqual([])
  })
})
