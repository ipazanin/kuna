import type { AppProposer, CheckedProposal, ProposalStep } from '../../app/assistantOperations'
import { anonymisedText } from '../domain/sensitiveText'
import { schemaProblems } from '../domain/strictSchema'
import type { ChatReads, ChatToolAnswer } from './chatReads'

export interface ProposeInput {
  readonly app: string
  readonly title: string
  readonly steps: readonly { readonly op: string; readonly input: string; readonly as: string | null }[]
}

const TEMPORARY_NAME = /^\$[a-z0-9]+$/i

function refusal(text: string): ChatToolAnswer {
  return { text, isError: true }
}

function parsed(input: string): Readonly<Record<string, unknown>> | null {
  try {
    const value: unknown = JSON.parse(input)
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Readonly<Record<string, unknown>>) : null
  } catch {
    return null
  }
}

/** A step with refs turned into ids and aliases into what they stand for, so a model writes `Person 3` and the record holds the name. Or why not, in a sentence. */
function resolvedStep(app: string, proposer: AppProposer, step: ProposeInput['steps'][number], names: Set<string>, reads: ChatReads): ProposalStep | string {
  const operation = proposer.operations.find((candidate) => candidate.name === step.op)
  if (operation === undefined) return "There is no such operation. Take it from the app's page."
  const input = parsed(step.input)
  if (input === null) return `The input of ${operation.name} is not a JSON object.`
  const problems = schemaProblems(input, operation.input)
  if (problems.length > 0) return `${operation.name}: ${problems.join('. ')}`
  const resolved: Record<string, unknown> = {}
  for (const [field, value] of Object.entries(input)) {
    const kind = operation.refs[field]
    if (kind === undefined || value === null) {
      resolved[field] = typeof value === 'string' ? reads.aliases.restored(value) : value
    } else if (typeof value === 'string' && names.has(value)) {
      resolved[field] = value
    } else {
      const record = typeof value === 'string' ? reads.refs.recordOf(value) : null
      if (record === null || record.app !== app || record.kind !== kind) return `${operation.name}: ${field} is not a ref Kuna handed out for a ${kind}, or a $ name of an earlier step.`
      resolved[field] = record.id
    }
  }
  if (step.as !== null) {
    if (operation.creates === null || !TEMPORARY_NAME.test(step.as)) return `${operation.name}: "as" takes a name starting with $, on a step that makes something.`
    names.add(step.as)
  }
  return { operation: operation.name, input: resolved, as: step.as }
}

/** A dry run of the steps, through the app's own checks. What passes shows as a card, and what the model hears holds nothing the card holds. The title stays as the model wrote it, aliases and all, as it goes back to the model and into the chat kept in this browser. */
export async function proposeChanges(
  input: ProposeInput,
  proposers: ReadonlyMap<string, AppProposer>,
  reads: ChatReads,
  showProposal: (app: string, proposal: CheckedProposal) => void,
): Promise<ChatToolAnswer> {
  const proposer = proposers.get(input.app)
  if (proposer === undefined) return refusal('Nothing can be proposed in that app yet. Say what to do and link its screen.')
  if (input.steps.length === 0) return refusal('A proposal needs at least one step.')
  const names = new Set<string>()
  const steps: ProposalStep[] = []
  for (const step of input.steps) {
    const resolved = resolvedStep(input.app, proposer, step, names, reads)
    if (typeof resolved === 'string') return refusal(resolved)
    steps.push(resolved)
  }
  const alone = steps.filter((step) => proposer.operations.find((operation) => operation.name === step.operation)?.alone === true)
  if (alone.length > 1) return refusal(`${alone[0]!.operation} goes one to a card. Propose the first, and the next once it is answered.`)
  if (!(await reads.mayRead(input.app))) return refusal('The person did not allow this app. Say what to do and link its screen.')
  const checked = await proposer.check(input.title, steps)
  if ('refused' in checked) {
    const reasons = checked.refused.join(' ')
    return refusal(reads.anonymising() ? anonymisedText(reasons, reads.aliases) : reasons)
  }
  showProposal(input.app, checked)
  return { text: `The card shows ${checked.count} changes. Say so in one short line and stop. Nothing is written until the person accepts.`, isError: false }
}
