import { language } from '../../../../shared/text/language'
import type { CroatianForms, EnglishForms, Translation } from '../../../../shared/text/translation'
import type { SuggestionConfidence } from '../application/suggestCategories'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.

export const en = {
  suggest: {
    title: 'Suggest categories',
    sends: 'Counterparty names, descriptions, amounts, months and accounts of the rows waiting for review, and your categories. IBANs and OIBs are masked.',
    employees: 'Include rows that name employees',
    heldBack: 'Every row waiting here names an employee, so nothing goes until you switch on Include rows that name employees.',
    employeesWarning: (provider: string) => `This sends their names and the amounts paid to ${provider}.`,
    suggested: (category: string, confidence: string) => `Suggested: ${category}, ${confidence}`,
    confidence: { high: 'sure', medium: 'likely', low: 'unsure' } satisfies Record<SuggestionConfidence, string>,
    use: (category: string) => `Use ${category}`,
    none: (count: number): EnglishForms => ({ one: `No suggestion for ${count} row`, other: `No suggestion for ${count} rows` }),
  },
}

export const hr: Translation<typeof en> = {
  suggest: {
    title: 'Predloži kategorije',
    sends: 'Nazive protustrana, opise, iznose, mjesece i račune redaka koji čekaju pregled te vaše kategorije. IBAN-ovi i OIB-i su skriveni.',
    employees: 'Uključi retke koji navode zaposlenike',
    heldBack: 'Svaki redak koji ovdje čeka navodi zaposlenika, pa se ništa ne šalje dok ne uključite „Uključi retke koji navode zaposlenike”.',
    employeesWarning: (provider) => `Ovo šalje njihova imena i isplaćene iznose pružatelju ${provider}.`,
    suggested: (category, confidence) => `Prijedlog: ${category}, ${confidence}`,
    confidence: { high: 'sigurno', medium: 'vjerojatno', low: 'nesigurno' },
    use: (category) => `Koristi ${category}`,
    none: (count): CroatianForms => ({ one: `Nema prijedloga za ${count} redak`, few: `Nema prijedloga za ${count} retka`, other: `Nema prijedloga za ${count} redaka` }),
  },
}

export const words = language === 'hr' ? hr : en
