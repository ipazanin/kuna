import type { AiTask, TaskResult, ToolAnswer } from '../domain/aiTask'
import type { AiUsage } from '../domain/modelUsage'
import { schemaProblems } from '../domain/strictSchema'
import type { StrictSchema } from '../domain/strictSchema'
import type { ModelPort } from './modelPort'
import { runModelLoop } from './runModelLoop'

/** The most tool rounds one task may take before it stops. */
export const MAX_TOOL_ROUNDS = 6
/** The largest prompt one request of a task may send, cached tokens included, as Haiku 5.5's higher price counts them per request too. */
export const MAX_REQUEST_TOKENS = 100_000
/** What the requests of one task may weigh together before it sends no more, so a tool loop stays under about $3 on the dearest preset. A single request always goes. */
export const MAX_RUN_TOKENS = 100_000

export interface RunPorts {
  /** The model of the provider in use, or null while this browser keeps no key for it. */
  readonly model: ModelPort | null
  /** Whether the app's switch is on. */
  readonly appOn: boolean
  /** Whether this run would send rows about employees or their pay, and whether Anonymise, which keeps them on the device, is on. */
  readonly employees: { readonly sends: boolean; readonly anonymising: boolean }
  /** Aborts the request under way, which then ends as `failed`. */
  readonly signal?: AbortSignal
}

/**
 * Runs one task: sends what it built through the model loop, answers the tools the model asks for, and checks the final
 * answer against the task's schema and then the task's own rules. Nothing is sent while a switch is off or no key is
 * kept, and nothing is written: the result is a draft for a screen to show.
 */
export async function runTask<Input, Output>(task: AiTask<Input, Output>, input: Input, ports: RunPorts): Promise<TaskResult<Output>> {
  if (!ports.appOn) {
    return { kind: 'switched-off', which: 'app' }
  }
  if (ports.employees.sends && ports.employees.anonymising) {
    return { kind: 'switched-off', which: 'employees' }
  }
  const model = ports.model
  if (model === null) {
    return { kind: 'no-key' }
  }
  const parts = task.input(input)
  if (!model.readsPdf && parts.some((part) => part.kind === 'pdf')) {
    return { kind: 'no-pdf' }
  }
  const output = task.output(input)
  const answers: ToolAnswer[] = []
  const end = await runModelLoop({
    model,
    system: task.system(),
    turns: [{ role: 'user', parts }],
    output,
    tools: task.tools.map(({ name, description, input: schema }) => ({ name, description, input: schema })),
    runTool: async (call) => {
      const answer = await toolAnswer(task, call.name, call.args)
      if (typeof answer === 'string') return { text: answer, parts: [], isError: true }
      answers.push(answer)
      return { text: answer.text, parts: [], isError: false }
    },
    effort: task.effort,
    signal: ports.signal,
    limits: { rounds: MAX_TOOL_ROUNDS, requestTokens: MAX_REQUEST_TOKENS, runTokens: MAX_RUN_TOKENS },
  })
  return end.kind === 'answer' ? checkedAnswer(task, input, output, end.text, answers, end.usage) : end
}

function checkedAnswer<Input, Output>(task: AiTask<Input, Output>, input: Input, schema: StrictSchema, text: string, answers: readonly ToolAnswer[], usage: AiUsage | null): TaskResult<Output> {
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
