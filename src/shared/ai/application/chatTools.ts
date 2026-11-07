import { schemaProblems } from '../domain/strictSchema'
import type { Catalogue } from './catalogue'
import { ISSUES_ROUTE } from './catalogue'
import type { ModelTool, ToolCall } from './modelPort'

/** A link under an answer: a screen of Kuna, or the page where a person writes down what Kuna cannot do. */
export type ChatChip = { readonly kind: 'screen'; readonly to: string; readonly label: string } | { readonly kind: 'issues' }

/** Every tool a chat has. Each one looks up the catalogue and nothing else, and neither reads a person's books, a file, an address or browser storage. */
export const CHAT_TOOLS: readonly ModelTool[] = [
  {
    name: 'kuna_docs',
    description:
      'Opens one page about this version of Kuna, by a path the instructions or another page name, such as "spending" or "spending/guide/first-rules". Holds nothing from the person\'s books.',
    input: { type: 'object', properties: { path: { type: 'string', description: 'The path of the page.' } }, required: ['path'], additionalProperties: false },
  },
  {
    name: 'show_screen',
    description: 'Puts a link under your answer: to an address a page lists, or to "issues", the page where the person can write down what Kuna cannot do. It does not move them.',
    input: {
      type: 'object',
      properties: { route: { type: 'string', description: 'An address a page lists, such as "/spending/settings?tab=rules", or "issues".' } },
      required: ['route'],
      additionalProperties: false,
    },
  },
]

/** Answers one tool call of a chat from the catalogue. A name, an argument, a path or an address it does not know gets a refusal and reaches nothing. */
export function runChatTool(catalogue: Catalogue, call: ToolCall, showChip: (chip: ChatChip) => void): { readonly text: string; readonly isError: boolean } {
  const tool = CHAT_TOOLS.find((candidate) => candidate.name === call.name)
  if (tool === undefined) {
    return { text: 'There is no such tool.', isError: true }
  }
  const problems = schemaProblems(call.args, tool.input)
  if (problems.length > 0) {
    return { text: problems.join('. '), isError: true }
  }
  return tool.name === 'kuna_docs' ? openPage(catalogue, (call.args as { readonly path: string }).path) : showRoute(catalogue, (call.args as { readonly route: string }).route, showChip)
}

function openPage(catalogue: Catalogue, path: string): { readonly text: string; readonly isError: boolean } {
  const page = catalogue.pages.get(path)
  return page === undefined ? { text: 'There is no page at that path. Start from one the instructions list.', isError: true } : { text: page, isError: false }
}

function showRoute(catalogue: Catalogue, route: string, showChip: (chip: ChatChip) => void): { readonly text: string; readonly isError: boolean } {
  if (route === ISSUES_ROUTE) {
    showChip({ kind: 'issues' })
    return { text: 'The link to the issues page is under your answer.', isError: false }
  }
  const label = catalogue.routes.get(route)
  if (label === undefined) {
    return { text: 'That address is not one Kuna lists. Take it from a page.', isError: true }
  }
  showChip({ kind: 'screen', to: route, label })
  return { text: `The link to ${label} is under your answer.`, isError: false }
}
