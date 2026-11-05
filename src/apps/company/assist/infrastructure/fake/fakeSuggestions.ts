import { registerFakeAnswer } from '../../../../../shared/ai/infrastructure/fake/fakeModel'
import { SUGGEST_CATEGORIES } from '../../application/suggestCategories'

/** Which made-up counterparty the fake model files where, and how sure it says it is. Rows it does not know get no suggestion. */
const FAKE_PICKS: readonly { readonly word: string; readonly category: string; readonly confidence: 'high' | 'medium' | 'low'; readonly why: string }[] = [
  { word: 'GADGET', category: 'equipment', confidence: 'high', why: 'A shop for devices, paid by card.' },
  { word: 'SNACK', category: 'representation', confidence: 'medium', why: 'A small food purchase, most likely for guests.' },
  { word: 'PAPER', category: 'office-supplies', confidence: 'high', why: 'Paper and ink for the office.' },
]

/** The fake build's answer to Suggest categories, read from the rows and categories the request names. */
export function registerFakeSuggestions(): void {
  registerFakeAnswer(SUGGEST_CATEGORIES, (request) => {
    const text = request.turns[0]?.role === 'user' ? request.turns[0].parts.flatMap((part) => (part.kind === 'text' ? [part.text] : [])).join('\n') : ''
    const [, categoriesText = '[]', rowsText = '[]'] = /Categories:\n(.*)\n\nRows:\n(.*)$/s.exec(text) ?? []
    const slugs = new Set((JSON.parse(categoriesText) as { slug: string }[]).map((category) => category.slug))
    const rows = JSON.parse(rowsText) as { ref: string; counterparty: string }[]
    return {
      suggestions: rows.flatMap((row) => {
        const pick = FAKE_PICKS.find((candidate) => row.counterparty.includes(candidate.word) && slugs.has(candidate.category))
        return pick === undefined ? [] : [{ row: row.ref, category: pick.category, confidence: pick.confidence, why: pick.why }]
      }),
    }
  })
}
