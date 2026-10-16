/**
 * Lets a plain `node` script import this repo's TypeScript modules by their source specifier.
 *
 * Node strips the types out of a `.ts` file on its own, but it will not guess at an extension the
 * specifier does not carry, and every relative import in `src/` is written without one. Only
 * extensionless relative specifiers from this repo's own files are touched, never one inside a
 * package, whose extensionless requires mean `.js`. A bare package name, a `node:` builtin and
 * anything that already names a file go to the next resolver untouched, so a mistyped import
 * still fails as a mistyped import rather than as a missing `.ts`.
 *
 *   node --import ./scripts/support/typescriptResolve.mjs scripts/<script>.mjs
 */

import { registerHooks } from 'node:module'

const RELATIVE = /^\.\.?\//
const HAS_EXTENSION = /\.[^./]+$/

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (RELATIVE.test(specifier) && !HAS_EXTENSION.test(specifier) && !context.parentURL?.includes('/node_modules/')) {
      return nextResolve(`${specifier}.ts`, context)
    }
    return nextResolve(specifier, context)
  },
})
