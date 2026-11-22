/** How many rows that go the warning lists by name before it counts the rest. */
const LISTED_ROWS = 6

/** What giving an account's days to another source takes out, in the words its warning shows before the change is saved. */
export interface HandoverWords {
  readonly title: string
  /** One line for each run of days that changes source. */
  readonly days: readonly string[]
  /** The rows that go, the first few by day, name and amount, then a line that counts the rest. */
  readonly rows: readonly string[]
  /** What else follows, one sentence each. */
  readonly notes: readonly string[]
}

/** The first rows that go, and a last line from `more` that counts the others. */
export function listedRows(lines: readonly string[], more: (count: number) => string): readonly string[] {
  return lines.length > LISTED_ROWS ? [...lines.slice(0, LISTED_ROWS), more(lines.length - LISTED_ROWS)] : lines
}
