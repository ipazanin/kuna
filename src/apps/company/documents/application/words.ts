import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. A file or folder name keeps its spelling, such as 2026-10.

export const en = {
  /** The line Google's Picker shows above the folders beside a path folder. */
  pickerTitle: (segment: string) => `Pick the existing ${segment} folder. Pick every folder you see beside it too, so the app does not ask again.`,
}

export const hr: Translation<typeof en> = {
  pickerTitle: (segment) => `Odaberite postojeću mapu ${segment}. Odaberite i sve mape koje vidite pokraj nje, da aplikacija ne pita ponovno.`,
}

export const words = language === 'hr' ? hr : en
