import type { SetUpLine } from './appContribution'

/** Whether the app is still new: a line is left that the file shows only while it holds none of what the app keeps. */
export function stillNew(lines: readonly SetUpLine[]): boolean {
  return lines.some((line) => line.whileEmpty === true)
}
