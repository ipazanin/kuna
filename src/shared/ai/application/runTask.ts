import type { AiPart, AiTask, AiUsage, TaskResult, ToolAnswer } from '../domain/aiTask'
import { maskIdentifiers } from '../domain/maskIdentifiers'
import { schemaProblems } from '../domain/strictSchema'
import type { StrictSchema } from '../domain/strictSchema'
import type { ModelPort, ModelTokens, ModelTurn } from './modelPort'
import { ModelRequestFailed } from './modelPort'

/** The most tool rounds one run may take before it stops. */
export const MAX_TOOL_ROUNDS = 6
/** The most input tokens one run may send, all its requests together, which keeps every model below a higher price. */
export const MAX_INPUT_TOKENS = 100_000

export interface RunPorts {
  /** The model of the provider in use, or null while this browser keeps no key for it. */
  readonly model: ModelPort | null
  /** Whether the app's switch is on. */
  readonly appOn: boolean
  /** Whether this run would send employee data, and whether the task's switch for it is on. */
  readonly employees: { readonly sends: boolean; readonly on: boolean }
  /** Aborts the request under way, which then ends as `failed`. */
  readonly signal?: AbortSignal
}

/**
 * Runs one task: masks every text part it built, sends it, runs the tools the model asks for, and checks the final
 * answer against the task's schema and then the task's own rules. Nothing is sent while a switch is off or no key is
 * kept, and nothing is written: the result is a draft for a screen to show.
 */
export async function runTask<Input, Output>(task: AiTask<Input, Output>, input: Input, ports: RunPorts): Promise<TaskResult<Output>> {
  if (!ports.appOn) {
    return { kind: 'switched-off', which: 'app' }
  }
  if (ports.employees.sends && !ports.employees.on) {
    return { kind: 'switched-off', which: 'employees' }
  }
  const model = ports.model
  if (model === null) {
    return { kind: 'no-key' }
  }
  const parts = task.input(input).map(masked)
  if (!model.readsPdf && parts.some((part) => part.kind === 'pdf')) {
    return { kind: 'no-pdf' }
  }
  const system = task.system().map((part) => ({ ...part, text: maskIdentifiers(part.text) }))
  const tools = task.tools.map(({ name, description, input: schema }) => ({ name, description, input: schema }))
  const output = task.output(input)
  const turns: ModelTurn[] = [{ role: 'user', parts }]
  const answers: ToolAnswer[] = []
  let used: ModelTokens = { input: 0, output: 0 }
  let lastInput = 0
  const usage = (): AiUsage => usageOf(model, used)

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round += 1) {
    // A conversation only grows, so the next request sends at least what the last one did.
    if (used.input + Math.max(estimatedTokens(system, turns), lastInput) > MAX_INPUT_TOKENS) {
      return { kind: 'too-long', reason: String(MAX_INPUT_TOKENS), usage: used.input === 0 ? null : usage() }
    }
    let reply
    try {
      reply = await model.send({ system, turns, output, tools, effort: task.effort, signal: ports.signal })
    } catch (failure) {
      if (failure instanceof ModelRequestFailed) {
        used = { input: used.input + failure.tokens.input, output: used.output + failure.tokens.output }
        return { kind: 'failed', reason: failure.message, usage: used.input === 0 ? null : usage() }
      }
      throw failure
    }
    used = { input: used.input + reply.tokens.input, output: used.output + reply.tokens.output }
    lastInput = reply.tokens.input
    switch (reply.kind) {
      case 'refused':
        return { kind: 'refused', reason: reply.reason, usage: usage() }
      case 'cut-off':
        return { kind: 'cut-off', reason: '', usage: usage() }
      case 'answer':
        return checkedAnswer(task, input, output, reply.text, answers, usage())
      case 'tool-calls': {
        if (round === MAX_TOOL_ROUNDS) break
        const results = await Promise.all(
          reply.calls.map(async (call) => {
            const answer = await toolAnswer(task, call.name, call.args)
            if (typeof answer === 'string') return { callId: call.id, text: answer, isError: true }
            answers.push(answer)
            return { callId: call.id, text: maskIdentifiers(answer.text), isError: false }
          }),
        )
        turns.push({ role: 'assistant', calls: reply.calls, raw: reply.raw }, { role: 'tool-results', results })
      }
    }
  }
  return { kind: 'failed', reason: `more than ${MAX_TOOL_ROUNDS} rounds of lookups`, usage: usage() }
}

function masked(part: AiPart): AiPart {
  return part.kind === 'text' ? { kind: 'text', text: maskIdentifiers(part.text) } : part
}

function checkedAnswer<Input, Output>(task: AiTask<Input, Output>, input: Input, schema: StrictSchema, text: string, answers: readonly ToolAnswer[], usage: AiUsage): TaskResult<Output> {
  let output: unknown
  try {
    output = JSON.parse(text)
  } catch {
    return { kind: 'failed', reason: 'The answer is not JSON.', usage }
  }
  const problems = schemaProblems(output, schema)
  if (problems.length > 0) {
    return { kind: 'failed', reason: problems.join('. '), usage }
  }
  const checked = task.check(output, input, { answers })
  return { kind: 'draft', draft: checked.draft, problems: checked.problems, usage }
}

/** What a tool answered, or why it could not: an unknown tool, arguments off its schema, or a lookup that found nothing. */
async function toolAnswer<Input, Output>(task: AiTask<Input, Output>, name: string, args: unknown): Promise<ToolAnswer | string> {
  const tool = task.tools.find((candidate) => candidate.name === name)
  if (tool === undefined) {
    return `There is no tool named ${name}.`
  }
  const problems = schemaProblems(args, tool.input)
  if (problems.length > 0) {
    return problems.join('. ')
  }
  try {
    return await tool.run(args)
  } catch (failure) {
    if (failure instanceof RangeError) return failure.message
    throw failure
  }
}

/** A cautious count of the tokens a request sends: three characters a token of text, and a PDF or photo by its size. */
function estimatedTokens(system: readonly { readonly text: string }[], turns: readonly ModelTurn[]): number {
  const characters =
    system.reduce((sum, part) => sum + part.text.length, 0) +
    turns.reduce((sum, turn) => {
      if (turn.role === 'user') return sum + turn.parts.reduce((partSum, part) => partSum + (part.kind === 'text' ? part.text.length : part.base64.length / 4), 0)
      if (turn.role === 'tool-results') return sum + turn.results.reduce((resultSum, result) => resultSum + result.text.length, 0)
      return sum + JSON.stringify(turn.calls).length
    }, 0)
  return Math.ceil(characters / 3)
}

function usageOf(model: ModelPort, tokens: ModelTokens): AiUsage {
  return {
    model: model.model.name,
    inputTokens: tokens.input,
    outputTokens: tokens.output,
    dollars: (tokens.input * model.model.inputPerMillion + tokens.output * model.model.outputPerMillion) / 1_000_000,
  }
}
