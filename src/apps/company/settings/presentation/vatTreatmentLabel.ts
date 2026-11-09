import { words } from './words'

/** A VAT treatment as the categories editor names it, or as stored for one it does not know. */
export function vatTreatmentLabel(treatment: string): string {
  return Object.entries(words.categories.vatTreatments).find(([value]) => value === treatment)?.[1] ?? treatment
}
