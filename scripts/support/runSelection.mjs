/**
 * The options that limit the visual and the touch check to some screens, flows or steps and to some
 * widths, for a quick look while working. A run without them is the full check.
 *
 *   --only billing,owner   a name picks only what is called exactly that, and a name ending in * whatever starts with the rest, such as 'sidebar*' quoted for the shell
 *   --widths 360,1440      only these of the check's widths
 *   --shard 3/8            the third of eight shares of the visual check's screens and flows, so CI runs the shares side by side
 *   --every-theme          the dark and the light theme at every width, as a design review needs, not only at the widths that check both
 *   --classic-scrollbars   scrollbars that take a 15 px gutter, as Linux and Windows draw them, in place of hidden ones
 */

import { parseArgs } from 'node:util'

/**
 * Reads the base address and the options from the command line, or from `args`. `widths` are the widths the check
 * knows, and a width it does not know stops the run.
 */
export function runSelection(widths, args = process.argv.slice(2)) {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: { only: { type: 'string' }, widths: { type: 'string' }, shard: { type: 'string' }, 'every-theme': { type: 'boolean' }, 'classic-scrollbars': { type: 'boolean' } },
  })
  const listOf = (text) =>
    (text ?? '')
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry !== '')
  const only = values.only === undefined ? null : listOf(values.only)
  const chosenWidths = values.widths === undefined ? null : listOf(values.widths).map(Number)
  const unknownWidths = (chosenWidths ?? []).filter((width) => !widths.includes(width))
  const shardParts = values.shard?.match(/^(\d+)\/(\d+)$/)
  const shard = shardParts ? [Number(shardParts[1]), Number(shardParts[2])] : null
  const badShard = values.shard !== undefined && (shard === null || shard[0] < 1 || shard[0] > shard[1])
  if (unknownWidths.length > 0 || chosenWidths?.length === 0 || only?.length === 0 || badShard) {
    console.error(`--widths takes a comma-separated list of ${widths.join(', ')}, --only a comma-separated list of names, and --shard a share and a count, like 3/8.`)
    process.exit(2)
  }
  const everyTheme = values['every-theme'] === true
  const matched = new Set()
  const seen = new Set()
  return {
    base: positionals[0] ?? 'http://localhost:4173/kuna/',
    limited: only !== null || chosenWidths !== null || shard !== null,
    sharded: shard !== null,
    classicScrollbars: values['classic-scrollbars'] === true,
    /** Whether the run takes this width. */
    takesWidth: (width) => chosenWidths === null || chosenWidths.includes(width),
    /** Whether the run takes this theme at a width that checks only `pinned`, or both while `pinned` is undefined. */
    takesTheme(theme, pinned) {
      return everyTheme || pinned === undefined || theme === pinned
    },
    /** Whether the run takes what this name stands for. Every name asked about is remembered for `unmatched`. */
    takes(name) {
      seen.add(name)
      if (only === null) return true
      const entries = only.filter((candidate) => (candidate.endsWith('*') ? name.startsWith(candidate.slice(0, -1)) : name === candidate))
      for (const entry of entries) matched.add(entry)
      return entries.length > 0
    },
    /**
     * The names of this run's share of these. They are dealt out in turn, so the shares get about as many
     * each, and every item of one name lands in the same share.
     */
    share(names) {
      const dealt = [...new Set(names)]
      return new Set(shard === null ? dealt : dealt.filter((name, index) => index % shard[1] === shard[0] - 1))
    },
    /** The `--only` names nothing was called, each with the names there are, as a sentence. */
    unmatched() {
      const missing = (only ?? []).filter((entry) => !matched.has(entry))
      return missing.length === 0 ? null : `--only named ${missing.join(', ')}, which nothing of this run is called. The names are ${[...seen].join(', ')}.`
    },
    /** What the run was limited to, for its last line. */
    summary: () =>
      [
        only === null ? '' : `--only ${only.join(',')}`,
        chosenWidths === null ? '' : `--widths ${chosenWidths.join(',')}`,
        shard === null ? '' : `--shard ${shard.join('/')}`,
        everyTheme ? '--every-theme' : '',
        values['classic-scrollbars'] === true ? '--classic-scrollbars' : '',
      ]
        .filter((part) => part !== '')
        .join(' '),
  }
}
