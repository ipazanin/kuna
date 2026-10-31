import { globSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from '@vue/compiler-sfc'
import type { ElementNode, RootNode, TemplateChildNode } from '@vue/compiler-dom'
import { describe, expect, it } from 'vitest'

import { trackWrite, writesInFlight } from '../src/shared/storage/application/writesInFlight'

const root = join(import.meta.dirname, '..')
const ELEMENT = 1
const DIRECTIVE = 7

function elementsOf(node: RootNode | TemplateChildNode): ElementNode[] {
  const children = 'children' in node ? (node.children as TemplateChildNode[]) : []
  return [...(node.type === ELEMENT ? [node as ElementNode] : []), ...children.flatMap((child) => (typeof child === 'object' ? elementsOf(child) : []))]
}

/** The elements of a component that disable themselves on a busy flag and have no loading state beside it. */
function disabledWithoutLoading(source: string): string[] {
  const ast = parse(source).descriptor.template?.ast
  if (ast === undefined || ast === null) return []
  return elementsOf(ast)
    .filter((element) => {
      const bound = element.props.flatMap((prop) =>
        prop.type === DIRECTIVE && prop.name === 'bind' && prop.arg !== undefined && 'content' in prop.arg
          ? [{ name: prop.arg.content, expression: prop.exp && 'content' in prop.exp ? prop.exp.content : '' }]
          : [],
      )
      const disabledOnBusy = bound.some((prop) => prop.name === 'disabled' && /\bbusy\b/.test(prop.expression))
      return disabledOnBusy && !bound.some((prop) => prop.name === 'loading')
    })
    .map((element) => `<${element.tag}> at line ${element.loc.start.line}`)
}

describe('write feedback', () => {
  it('counts overlapping writes until both are done', async () => {
    let finishFirst: () => void = () => {}
    let finishSecond: () => void = () => {}
    const first = trackWrite(() => new Promise<void>((resolve) => (finishFirst = resolve)))
    const second = trackWrite(() => new Promise<void>((resolve) => (finishSecond = resolve)))
    expect(writesInFlight.value).toBe(2)
    finishFirst()
    await first
    expect(writesInFlight.value).toBe(1)
    finishSecond()
    await second
    expect(writesInFlight.value).toBe(0)
  })

  it('counts a failed write down and passes its failure on', async () => {
    await expect(trackWrite(() => Promise.reject(new Error('refused')))).rejects.toThrow('refused')
    expect(writesInFlight.value).toBe(0)
  })

  it('returns what the write returns', async () => {
    await expect(trackWrite(() => Promise.resolve('receipt'))).resolves.toBe('receipt')
  })

  const components = globSync('src/**/*.vue', { cwd: root })

  it.each(components)('%s disables no control on a busy flag without a loading state beside it', (file) => {
    expect(disabledWithoutLoading(readFileSync(join(root, file), 'utf8'))).toEqual([])
  })
})
