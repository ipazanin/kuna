export const meta = {
  name: 'plan-feature',
  description: 'Plan the next stages of Kuna issues, read-only, with the files each stage touches, clashes and owner decisions',
  whenToUse: 'Step 2 of the drive-feature skill. Pass args { scratch, issues: [numbers], inFlight: "what other lanes are changing now" }.',
  phases: [
    { title: 'Plan', detail: 'one planner per issue' },
    { title: 'Check', detail: 'a second reader checks each plan against the code' },
  ],
}

const { scratch, issues, inFlight } = args

const PLAN = {
  type: 'object',
  required: ['issue', 'plan_path', 'stages', 'decisions', 'proposals'],
  properties: {
    issue: { type: 'number' },
    plan_path: { type: 'string' },
    stages: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name', 'size', 'visible', 'files', 'depends_on', 'ready'],
        properties: {
          name: { type: 'string' },
          size: { type: 'string' },
          visible: { type: 'boolean' },
          files: { type: 'array', items: { type: 'string' } },
          depends_on: { type: 'string' },
          ready: { type: 'boolean', description: 'Buildable now with no open owner decision' },
        },
      },
    },
    decisions: {
      type: 'array',
      items: {
        type: 'object',
        required: ['question', 'example', 'options', 'recommended'],
        properties: { question: { type: 'string' }, example: { type: 'string' }, options: { type: 'array', items: { type: 'string' } }, recommended: { type: 'string' } },
      },
    },
    proposals: { type: 'string' },
  },
}
const CHECKED = {
  type: 'object',
  required: ['sound', 'corrections'],
  properties: { sound: { type: 'boolean' }, corrections: { type: 'string', description: 'Each wrong claim with file:line and the correction' } },
}

return await pipeline(
  issues,
  (issue) =>
    agent(
      `Plan the remaining work of Kuna issue #${issue} in /Users/ivan/Projects/personal/kuna, read-only: no edits, no mutating Git. Read gh issue view ${issue} --comments, AGENTS.md, docs/architecture/modules.md, .claude/rules/ and the kuna-domain skill, plus law-research when the issue rests on law. Work now in flight elsewhere: ${inFlight || 'none'}. Reuse existing concepts before proposing a new type, kind or component, and say when reuse changes meaning. Cut the work into stages a builder can finish and review alone, each with the files it touches. Mark a stage ready only when nothing waits on the owner. Each owner decision gets a concrete example in euros or on a named screen, the options as consequences for the person, and your recommendation. Write the full plan to ${scratch}/plan-${issue}.md. Never join clauses with a semicolon.`,
      { label: `plan #${issue}`, phase: 'Plan', schema: PLAN },
    ),
  (plan, issue) =>
    plan
      ? agent(
          `Check the plan at ${plan.plan_path} for Kuna issue #${issue} against the code in /Users/ivan/Projects/personal/kuna, read-only. Open every file and line it cites. Say which claims are wrong, which stages miss a file they must touch, and which clash with: ${inFlight || 'nothing'}.`,
          { label: `check #${issue}`, phase: 'Check', schema: CHECKED },
        ).then((checked) => ({ ...plan, checked }))
      : null,
)
