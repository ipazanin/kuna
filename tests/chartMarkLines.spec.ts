import { globSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = join(import.meta.dirname, '..')

/** The text of each `markLine` object in a chart builder, from its opening brace to the one that closes it. */
function markLinesOf(source: string): { readonly line: number; readonly text: string }[] {
  return [...source.matchAll(/\bmarkLine:\s*\{/g)].map((match) => {
    const start = match.index + match[0].length - 1
    let depth = 0
    let end = start
    for (; end < source.length; end += 1) {
      if (source[end] === '{') depth += 1
      if (source[end] === '}') depth -= 1
      if (depth === 0) break
    }
    return { line: source.slice(0, match.index).split('\n').length, text: source.slice(start, end + 1) }
  })
}

/**
 * The marker lines drawn in the axis colour. A marker such as today or an average is a mark that needs 3:1 on the card,
 * and the axis colour is a recessive line well below that, kept for axes and grid lines.
 */
function axisMarkLines(source: string): string[] {
  return markLinesOf(source)
    .filter((markLine) => /\btokens\.axis\b|--chart-axis/.test(markLine.text))
    .map((markLine) => `markLine at line ${markLine.line}`)
}

describe('a chart’s marker lines', () => {
  it('are never drawn in the axis colour, which sits below the 3:1 a mark needs', () => {
    const files = globSync('src/**/*.ts', { cwd: root }).filter((file) => readFileSync(join(root, file), 'utf8').includes('markLine'))
    expect(files.length).toBeGreaterThan(3)
    const offenders = files.flatMap((file) => axisMarkLines(readFileSync(join(root, file), 'utf8')).map((markLine) => `${file}: ${markLine}`))
    expect(offenders).toEqual([])
  })

  it('flags a today line in the axis colour and leaves the axis line beside it alone', () => {
    const source = `const series = {
  xAxis: { axisLine: { lineStyle: { color: tokens.axis } } },
  markLine: {
    silent: true,
    lineStyle: { color: tokens.axis, type: 'dashed' },
    data: [{ xAxis: today }],
  },
}`
    expect(axisMarkLines(source)).toEqual(['markLine at line 3'])
    expect(axisMarkLines(source.replace('color: tokens.axis, type', 'color: tokens.inkMuted, type'))).toEqual([])
  })
})
