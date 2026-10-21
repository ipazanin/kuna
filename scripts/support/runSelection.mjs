/**
 * The options that limit the visual and the touch check to some screens, flows or steps and to some
 * widths, for a quick look while working. A run without them is the full check.
 *
 *   --only billing,owner   a name picks what is called that, and whatever is called that and a hyphen and more
 *   --widths 360,1440      only these of the check's widths
 */

import { parseArgs } from 'node:util'

/**
 * Reads the base address and the options from the command line. `widths` are the widths the check
 * knows, and a width it does not know stops the run.
 */
export function runSelection(widths) {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: { only: { type: 'string' }, widths: { type: 'string' } } })
  const listOf = (text) => (text ?? '').split(',').map((entry) => entry.trim()).filter((entry) => entry !== '')
  const only = values.only === undefined ? null : listOf(values.only)
  const chosenWidths = values.widths === undefined ? null : listOf(values.widths).map(Number)
  const unknownWidths = (chosenWidths ?? []).filter((width) => !widths.includes(width))
  if (unknownWidths.length > 0 || chosenWidths?.length === 0 || only?.length === 0) {
    console.error(`--widths takes a comma-separated list of ${widths.join(', ')}, and --only a comma-separated list of names.`)
    process.exit(2)
  }
  const matched = new Set()
  const seen = new Set()
  return {
    base: positionals[0] ?? 'http://localhost:4173/ledgerboard/',
    limited: only !== null || chosenWidths !== null,
    /** Whether the run takes this width. */
    takesWidth: (width) => chosenWidths === null || chosenWidths.includes(width),
    /** Whether the run takes what this name stands for. Every name asked about is remembered for `unmatched`. */
    takes(name) {
      seen.add(name)
      if (only === null) return true
      const entry = only.find((candidate) => name === candidate || name.startsWith(`${candidate}-`))
      if (entry !== undefined) matched.add(entry)
      return entry !== undefined
    },
    /** The `--only` names nothing was called, each with the names there are, as a sentence. */
    unmatched() {
      const missing = (only ?? []).filter((entry) => !matched.has(entry))
      return missing.length === 0 ? null : `--only named ${missing.join(', ')}, which nothing of this run is called. The names are ${[...seen].join(', ')}.`
    },
    /** What the run was limited to, for its last line. */
    summary: () => [only === null ? '' : `--only ${only.join(',')}`, chosenWidths === null ? '' : `--widths ${chosenWidths.join(',')}`].filter((part) => part !== '').join(' '),
  }
}
