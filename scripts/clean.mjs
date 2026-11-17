/**
 * Removes what the builds and the checks leave in this checkout: the screenshots, both builds and Vite's cache.
 *   npm run clean
 * A folder reached through a symbolic link is left alone, since a worktree's node_modules is a link to the main
 * checkout's, whose cache another checkout may be using.
 */

import { lstatSync, rmSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

/** What `npm run clean` removes, relative to the checkout. */
export const CLEANED = ['visual-check', 'dist', 'dist-fake', join('node_modules', '.vite')]

/** Removes each cleaned folder under `checkout` that is there and not reached through a symbolic link, and answers which. */
export function cleanCheckout(checkout) {
  return CLEANED.filter((folder) => {
    if (!reachedDirectly(checkout, folder)) return false
    rmSync(join(checkout, folder), { recursive: true, force: true })
    return true
  })
}

/** Whether `folder` is there under `checkout` with no symbolic link on the way, itself included. */
function reachedDirectly(checkout, folder) {
  const parts = relative(checkout, join(checkout, folder)).split(sep)
  return parts.every((_, index) => lstatSync(join(checkout, ...parts.slice(0, index + 1)), { throwIfNoEntry: false })?.isDirectory() === true)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const removed = cleanCheckout(fileURLToPath(new URL('..', import.meta.url)))
  console.log(removed.length === 0 ? 'Nothing to clean.' : `Removed ${removed.join(', ')}.`)
}
