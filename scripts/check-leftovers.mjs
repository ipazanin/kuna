/**
 * Lists what a run in this checkout may have left on the machine, and fails when it finds any: a process listening on a
 * port from this checkout, a browser profile of this checkout's checks, the screenshots in visual-check/ and a container
 * or volume labelled kuna. A worktree under .claude/worktrees is a checkout of its own, so another lane's server is not
 * this checkout's leftover.
 *   npm run check:leftovers
 *   npm run check:leftovers -- --with-shots   for a CI job, whose shots go with its machine
 */

import { spawnSync } from 'node:child_process'
import { existsSync, lstatSync, readdirSync, readlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

import { checkoutProfilePrefix } from './support/browsers.mjs'

const CHECKOUT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const WORKTREES = join(CHECKOUT, '.claude', 'worktrees')
const { values } = parseArgs({ options: { 'with-shots': { type: 'boolean' } } })

const found = []
const notes = []

for (const listener of listeners()) found.push(`process ${listener.pid} (${listener.command}) listens on ${listener.ports.join(', ')} from ${listener.cwd}`)

const prefix = checkoutProfilePrefix()
for (const profile of readdirSync(tmpdir()).filter((name) => name.startsWith(prefix))) found.push(`browser profile ${join(tmpdir(), profile)}`)

const shots = join(CHECKOUT, 'visual-check')
if (existsSync(shots)) {
  const { files, bytes } = folderSize(shots)
  const line = `visual-check/ holds ${files} files, ${(bytes / 1024 / 1024).toFixed(1)} MB`
  if (values['with-shots']) notes.push(line)
  else found.push(`${line}. npm run clean removes it`)
}

for (const [kind, list] of [
  ['container', ['container', 'ls', '--all', '--filter', 'label=kuna', '--format', '{{.Names}}']],
  ['volume', ['volume', 'ls', '--filter', 'label=kuna', '--format', '{{.Name}}']],
]) {
  const listed = docker(list)
  if (listed === null) {
    notes.push(`no ${kind}s checked, since Docker is not running here`)
    continue
  }
  for (const name of listed) found.push(`${kind} ${name} labelled kuna`)
}

for (const note of notes) console.log(`  ${note}`)
if (found.length > 0) {
  console.error(`${found.length} leftover(s) of a run in ${CHECKOUT}:`)
  for (const leftover of found) console.error(`  ✗ ${leftover}`)
  process.exit(1)
}
console.log(`Nothing left over from a run in ${CHECKOUT}.`)

/** The processes listening on a TCP port whose working folder is this checkout, not a worktree inside it. */
function listeners() {
  const listed = spawnSync('lsof', ['-nP', '-iTCP', '-sTCP:LISTEN', '-Fpcn'], { encoding: 'utf8' })
  if (listed.error) {
    notes.push('no listening processes checked, since lsof is not installed')
    return []
  }
  const byPid = new Map()
  let current = null
  for (const line of listed.stdout.split('\n')) {
    if (line.startsWith('p')) current = byPid.get(line.slice(1)) ?? byPid.set(line.slice(1), { pid: line.slice(1), command: '', ports: [] }).get(line.slice(1))
    else if (line.startsWith('c') && current) current.command = line.slice(1)
    else if (line.startsWith('n') && current) current.ports.push(line.slice(1))
  }
  return [...byPid.values()].map((listener) => ({ ...listener, cwd: workingFolder(listener.pid) })).filter((listener) => listener.cwd !== null && fromThisCheckout(listener.cwd))
}

function workingFolder(pid) {
  if (process.platform === 'linux') {
    try {
      return readlinkSync(`/proc/${pid}/cwd`)
    } catch {
      return null
    }
  }
  const listed = spawnSync('lsof', ['-a', '-p', pid, '-d', 'cwd', '-Fn'], { encoding: 'utf8' })
  return (
    listed.stdout
      ?.split('\n')
      .find((line) => line.startsWith('n'))
      ?.slice(1) ?? null
  )
}

function fromThisCheckout(folder) {
  const inside = (parent) => folder === parent || folder.startsWith(parent + sep)
  return inside(CHECKOUT) && !inside(WORKTREES)
}

function folderSize(folder) {
  let files = 0
  let bytes = 0
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    const path = join(folder, entry.name)
    if (entry.isDirectory()) {
      const inner = folderSize(path)
      files += inner.files
      bytes += inner.bytes
    } else if (entry.isFile()) {
      files += 1
      bytes += lstatSync(path).size
    }
  }
  return { files, bytes }
}

/** The lines Docker answers, or null when Docker is not installed or not running. */
function docker(args) {
  const listed = spawnSync('docker', args, { encoding: 'utf8' })
  if (listed.error || listed.status !== 0) return null
  return listed.stdout.split('\n').filter((line) => line.trim() !== '')
}
