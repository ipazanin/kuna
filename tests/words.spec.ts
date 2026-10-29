import { describe, expect, it } from 'vitest'

/**
 * The type of each Croatian dictionary already fails the build on a missing or extra key, but a
 * spread or a cast slips past it, so the keys are compared here too. Each counted phrase is called
 * with counts that take every Croatian form.
 */

const DICTIONARIES = Object.entries(import.meta.glob<{ en: unknown; hr: unknown }>('../src/**/words.ts', { eager: true }))
const COUNTS = [1, 2, 5, 21, 1.5]
const RULES = { en: new Intl.PluralRules('en-GB'), hr: new Intl.PluralRules('hr-HR') }
const NUMBERS = { en: new Intl.NumberFormat('en-GB'), hr: new Intl.NumberFormat('hr-HR') }

/** Every word of a dictionary by its dotted key: a string, or the function that words a phrase. */
function wordsOf(dictionary: unknown, prefix = ''): Map<string, unknown> {
  const words = new Map<string, unknown>()
  for (const [key, word] of Object.entries(dictionary as Record<string, unknown>)) {
    const path = prefix === '' ? key : `${prefix}.${key}`
    if (typeof word === 'object' && word !== null) {
      for (const [inner, innerWord] of wordsOf(word, path)) words.set(inner, innerWord)
    } else {
      words.set(path, word)
    }
  }
  return words
}

/** The forms a counted phrase gives for `count`, or null for a word that takes no count first. */
function formsOf(word: unknown, count: number): Readonly<Record<string, string>> | null {
  if (typeof word !== 'function') return null
  try {
    const forms: unknown = word(count)
    return typeof forms === 'object' && forms !== null && 'other' in forms ? (forms as Record<string, string>) : null
  } catch {
    // A phrase whose first parameter is not a count fails on a bare number, and is no counted phrase.
    return null
  }
}

/** The form the language writes `count` with, and whether it shows the count. */
function pickedFor(forms: Readonly<Record<string, string>>, count: number, language: 'en' | 'hr'): { readonly text: string; readonly showsCount: boolean } {
  const text = forms[RULES[language].select(count)] ?? forms.other ?? ''
  return { text, showsCount: text.includes(String(count)) || text.includes(NUMBERS[language].format(count)) }
}

describe('dictionaries', () => {
  it('finds every words.ts', () => {
    expect(DICTIONARIES.length).toBeGreaterThan(0)
  })

  it.each(DICTIONARIES)('%s has the same keys in English and Croatian', (_file, dictionary) => {
    const english = [...wordsOf(dictionary.en).keys()]
    const croatian = [...wordsOf(dictionary.hr).keys()]

    expect(english.filter((key) => !croatian.includes(key))).toEqual([])
    expect(croatian.filter((key) => !english.includes(key))).toEqual([])
  })

  it.each(DICTIONARIES)('%s writes every Croatian count with all three forms, showing the count where English does', (_file, dictionary) => {
    const croatian = wordsOf(dictionary.hr)
    const wrong: string[] = []
    for (const [key, word] of wordsOf(dictionary.en)) {
      for (const count of COUNTS) {
        const english = formsOf(word, count)
        if (english === null) continue
        const forms = formsOf(croatian.get(key), count)
        if (forms === null || typeof forms.one !== 'string' || typeof forms.few !== 'string' || typeof forms.other !== 'string') {
          wrong.push(`${key} has no one, few and other in Croatian`)
          break
        }
        const picked = pickedFor(forms, count, 'hr')
        if (pickedFor(english, count, 'en').showsCount && !picked.showsCount) {
          wrong.push(`${key}(${count}) reads "${picked.text}" in Croatian, without the count`)
        }
      }
    }

    expect(wrong).toEqual([])
  })
})
