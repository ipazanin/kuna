import { language } from '../../../../shared/text/language'
import type { CroatianForms, EnglishForms, Translation } from '../../../../shared/text/translation'
import type { SuggestionConfidence } from '../application/suggestCategories'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.

export const en = {
  suggest: {
    title: 'Suggest categories',
    sends: 'names, descriptions, amounts, months and accounts of the rows waiting for review, and your categories. IBANs and OIBs are masked, and Anonymise keeps rows about employees out.',
    heldBack: 'Every row waiting here is about an employee, so nothing goes while Anonymise is on in Kuna settings.',
    suggested: (category: string, confidence: string) => `Suggested: ${category}, ${confidence}`,
    confidence: { high: 'sure', medium: 'likely', low: 'unsure' } satisfies Record<SuggestionConfidence, string>,
    use: (category: string) => `Use ${category}`,
    outcome: (count: number): EnglishForms => ({ one: `Suggested a category for ${count} row. Open a row to use it.`, other: `Suggested a category for ${count} rows. Open a row to use it.` }),
    none: (count: number): EnglishForms => ({ one: `No suggestion for ${count} row`, other: `No suggestion for ${count} rows` }),
  },
}

export const hr: Translation<typeof en> = {
  suggest: {
    title: 'Predloži kategorije',
    sends: 'nazivi, opisi, iznosi, mjeseci i računi redaka koji čekaju pregled te vaše kategorije. IBAN-ovi i OIB-i su skriveni, a anonimizacija izostavlja retke o zaposlenicima.',
    heldBack: 'Svaki redak koji ovdje čeka odnosi se na zaposlenika, pa se ništa ne šalje dok je anonimizacija uključena u postavkama Kune.',
    suggested: (category, confidence) => `Prijedlog: ${category}, ${confidence}`,
    confidence: { high: 'sigurno', medium: 'vjerojatno', low: 'nesigurno' },
    use: (category) => `Koristi ${category}`,
    outcome: (count): CroatianForms => ({
      one: `Predložena je kategorija za ${count} redak. Otvorite redak da je upotrijebite.`,
      few: `Predložena je kategorija za ${count} retka. Otvorite redak da je upotrijebite.`,
      other: `Predložena je kategorija za ${count} redaka. Otvorite redak da je upotrijebite.`,
    }),
    none: (count): CroatianForms => ({ one: `Nema prijedloga za ${count} redak`, few: `Nema prijedloga za ${count} retka`, other: `Nema prijedloga za ${count} redaka` }),
  },
}

export const words = language === 'hr' ? hr : en
