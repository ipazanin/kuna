import type { ElementNode, RootNode, TemplateChildNode } from '@vue/compiler-dom'

const ELEMENT = 1
const ATTRIBUTE = 6
const DIRECTIVE = 7

/** The element itself, when it is one, and every element inside it. */
export function elementsOf(node: RootNode | TemplateChildNode): ElementNode[] {
  const children = 'children' in node ? (node.children as TemplateChildNode[]) : []
  return [...(node.type === ELEMENT ? [node as ElementNode] : []), ...children.flatMap((child) => (typeof child === 'object' ? elementsOf(child) : []))]
}

/** What an element says about a prop, written as it stands or bound, with `v-if` read as the prop `if`. */
export function propText(element: ElementNode, name: string): string | null {
  for (const prop of element.props) {
    if (prop.type === ATTRIBUTE && prop.name === name) return prop.value?.content ?? ''
    if (prop.type !== DIRECTIVE) continue
    const expression = prop.exp && 'content' in prop.exp ? prop.exp.content : ''
    if (name === 'if' && prop.name === 'if') return expression
    if (prop.name === 'bind' && prop.arg !== undefined && 'content' in prop.arg && prop.arg.content === name) return expression
  }
  return null
}
