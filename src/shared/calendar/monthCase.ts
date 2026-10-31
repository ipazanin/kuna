/** The cases a Croatian preposition puts a month in: `od lipnja`, `za veljaču`, `u listopadu`. */
export type MonthCase = 'genitive' | 'accusative' | 'locative'

/** Each Croatian month name as Intl writes it, with its forms in the three cases. */
const MONTH_FORMS: Readonly<Record<string, Readonly<Record<MonthCase, string>>>> = {
  siječanj: { genitive: 'siječnja', accusative: 'siječanj', locative: 'siječnju' },
  veljača: { genitive: 'veljače', accusative: 'veljaču', locative: 'veljači' },
  ožujak: { genitive: 'ožujka', accusative: 'ožujak', locative: 'ožujku' },
  travanj: { genitive: 'travnja', accusative: 'travanj', locative: 'travnju' },
  svibanj: { genitive: 'svibnja', accusative: 'svibanj', locative: 'svibnju' },
  lipanj: { genitive: 'lipnja', accusative: 'lipanj', locative: 'lipnju' },
  srpanj: { genitive: 'srpnja', accusative: 'srpanj', locative: 'srpnju' },
  kolovoz: { genitive: 'kolovoza', accusative: 'kolovoz', locative: 'kolovozu' },
  rujan: { genitive: 'rujna', accusative: 'rujan', locative: 'rujnu' },
  listopad: { genitive: 'listopada', accusative: 'listopad', locative: 'listopadu' },
  studeni: { genitive: 'studenoga', accusative: 'studeni', locative: 'studenome' },
  prosinac: { genitive: 'prosinca', accusative: 'prosinac', locative: 'prosincu' },
}

const MONTH_NAME = new RegExp(`(?<!\\p{L})(${Object.keys(MONTH_FORMS).join('|')})(?!\\p{L})`, 'giu')

/**
 * A Croatian month label with each month name in the case the word before it asks for, so
 * `lipanj 2025.` becomes `lipnja 2025.` after `od`. A capital stays a capital, and text without a
 * Croatian month name, such as `20. 9. 2026.`, comes back as it was.
 */
export function monthCase(label: string, grammaticalCase: MonthCase): string {
  return label.replace(MONTH_NAME, (name) => {
    const form = MONTH_FORMS[name.toLowerCase()]![grammaticalCase]
    return name[0] === name[0]!.toLowerCase() ? form : `${form[0]!.toUpperCase()}${form.slice(1)}`
  })
}
