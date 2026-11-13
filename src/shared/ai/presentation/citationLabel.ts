import { dayLabel } from '../../calendar/dayLabel'
import type { LawCitation } from '../domain/chatRefs'
import { words } from './words'

/** A cited law section by its file and heading, in English as the research writes them in every language. */
export function citationSource(citation: LawCitation): string {
  return citation.heading === null ? citation.file : `${citation.file}: ${citation.heading}`
}

/** The day a cited section's law was checked, in the screen's language. */
export function citationChecked(citation: LawCitation): string {
  return words.answer.checked(dayLabel(citation.checked))
}

/** A cited law section as one line of text, such as a kept chat writes it. */
export function citationLabel(citation: LawCitation): string {
  return `${citationSource(citation)}, ${citationChecked(citation)}`
}
