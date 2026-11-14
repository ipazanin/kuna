export const meta = {
  name: 'build-wave',
  description: 'Build, review and fix up to four Kuna lanes, each in a worktree the lead made at the pushed main',
  whenToUse: 'Step 3 of the drive-feature skill. Pass args { scratch, base, books, lanes: [{ key, issue, worktree, port, brief }] }, where books is a read-only scratch copy of the real books.',
  phases: [
    { title: 'Build', detail: 'one builder per lane in its own worktree' },
    { title: 'Review', detail: 'design-reviewer for visible lanes, correctness review always' },
    { title: 'Fix', detail: 'only lanes whose review blocks' },
  ],
}

const { scratch, base, books, lanes } = args

const BUILD = {
  type: 'object',
  required: ['visible', 'commit_subject', 'checks', 'figures', 'screenshots', 'decisions_taken', 'owner_questions', 'proposals'],
  properties: {
    visible: { type: 'boolean' },
    commit_subject: { type: 'string' },
    checks: { type: 'string', description: 'Each check run and its real result' },
    figures: { type: 'string', description: 'Groups that moved in check:figures and why, or none' },
    screenshots: { type: 'string', description: 'Absolute folder, or none' },
    decisions_taken: { type: 'string' },
    owner_questions: { type: 'string', description: 'Only what the owner must decide, each with a concrete example, or empty' },
    proposals: { type: 'string', description: 'Out-of-scope proposals, or empty' },
  },
}
const REVIEW = {
  type: 'object',
  required: ['blocks_push', 'findings'],
  properties: { blocks_push: { type: 'boolean' }, findings: { type: 'string', description: 'Each with file:line and the smallest fix' } },
}

const common = (lane) =>
  `You work on the Kuna repo in the worktree ${lane.worktree}, which the lead made at ${base}. Check git log -1 first and stop if it differs. Work only there. Git is read-only for you: no add, commit, stash, reset, checkout or worktree commands. Read AGENTS.md, .claude/rules/, and the kuna-domain or kuna-design skill when the lane touches domain or UI. Read the issue: gh issue view ${lane.issue} --comments. Never join clauses with a semicolon in prose you write.`

const checks = (lane) =>
  `Validate and report only what you ran: npm run check must exit 0. Run npm run check:figures and compare it with the same command run read-only on main in /Users/ivan/Projects/personal/kuna, naming each group that moves and why. If anything a person sees changes, run npm run build:fake and npm run preview:fake -- --port ${lane.port} (only that port), run the visual and touch flows of every screen you changed plus any new flow (read scripts/visual-check.mjs and scripts/touch-check.mjs for the flags), copy screenshots at 360, 640, 1024 and 1440 px, both languages and both themes, to ${scratch}/shots/${lane.key}/, and stop the server. Scratch goes in ${scratch}/${lane.key}/.`

const build = (lane, blockers) =>
  agent(
    `${common(lane)}\n\nYour lane: ${lane.brief}\n${blockers ? `\nThe review blocked the push. Fix every blocker and should-fix item:\n${blockers}\n` : ''}\n${checks(lane)}\n\nReturn the commit subject in Kuna's plain-sentence style ending with (#${lane.issue}).`,
    { label: `${blockers ? 'fix' : 'build'} ${lane.key}`, phase: blockers ? 'Fix' : 'Build', schema: BUILD },
  )

const review = (lane, built) =>
  agent(
    `${common(lane)}\n\nReview the uncommitted diff in ${lane.worktree} against ${base}, untracked files included. The lane: ${lane.brief}\nThe builder reported: ${JSON.stringify(built).slice(0, 4000)}\n${built.visible ? `Review it as the design reviewer and for correctness. The builder's fake-build screenshots are in ${scratch}/shots/${lane.key}/. Also run the lane on the real books: KUNA_REAL_BOOKS_DIR=${books}, port ${lane.port + 100}, shots into ${scratch}/real-shots/${lane.key}/, and never copy a real figure or name into a finding.` : 'Review it for correctness, regressions, one owner per rule, unused code left behind and test quality.'} Run npm run check yourself. Do not edit. blocks_push is true only for a real bug, a failing check, a broken design rule or a figure that moves without a reason.`,
    { label: `review ${lane.key}`, phase: 'Review', schema: REVIEW, agentType: built.visible ? 'design-reviewer' : 'general-purpose' },
  )

return await pipeline(
  lanes,
  (lane) => build(lane),
  (built, lane) => (built ? review(lane, built).then((verdict) => ({ built, verdict })) : null),
  async (result, lane) => {
    if (!result || !result.verdict || !result.verdict.blocks_push) return { key: lane.key, ...result }
    const fixed = await build(lane, result.verdict.findings)
    return { key: lane.key, ...result, fixed }
  },
)
