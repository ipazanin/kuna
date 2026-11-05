import { words } from './words'
import { plural } from '../../../../shared/text/translation'

/** The line under a figure that counts rows in another currency as nothing, since the rates do not reach them, or null when it counts every row. */
export function unratedNote(count: number): string | null {
  return count === 0 ? null : plural(words.unrated(count), count)
}
