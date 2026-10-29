import { describe, expect, it } from 'vitest'

import { browserLanguage, intlLocale, language, languageChoiceFrom, languageFromQuery, resolveLanguage } from '../src/shared/text/language'
import { plural } from '../src/shared/text/translation'

describe('language', () => {
  it('pins the language from ?lang= and ignores anything else', () => {
    expect(languageFromQuery('?lang=hr')).toBe('hr')
    expect(languageFromQuery('?theme=dark&lang=en')).toBe('en')
    expect(languageFromQuery('?lang=de')).toBeNull()
    expect(languageFromQuery('')).toBeNull()
  })

  it('reads a stored English or Hrvatski as the choice, and anything else as Browser language', () => {
    expect(languageChoiceFrom('en')).toBe('en')
    expect(languageChoiceFrom('hr')).toBe('hr')
    expect(languageChoiceFrom(null)).toBe('browser')
    expect(languageChoiceFrom('de')).toBe('browser')
  })

  it("takes Croatian only when it is the browser's first language", () => {
    expect(browserLanguage(['hr-HR', 'en'])).toBe('hr')
    expect(browserLanguage(['hr'])).toBe('hr')
    expect(browserLanguage(['en-GB', 'hr'])).toBe('en')
    expect(browserLanguage(['hrx'])).toBe('en')
    expect(browserLanguage([])).toBe('en')
  })

  it('lets a pin win over the choice, and the choice over the browser', () => {
    expect(resolveLanguage('en', 'hr', 'hr')).toBe('en')
    expect(resolveLanguage(null, 'hr', 'en')).toBe('hr')
    expect(resolveLanguage(null, 'browser', 'hr')).toBe('hr')
  })

  it('is English outside a browser, whatever languages the machine has', () => {
    expect(language).toBe('en')
    expect(intlLocale).toBe('en-GB')
  })

  it('writes a count with the form English takes for it', () => {
    const days = (count: number) => ({ one: `${count} day`, other: `${count} days` })

    expect([1, 2, 21, 1.5].map((count) => plural(days(count), count))).toEqual(['1 day', '2 days', '21 days', '1.5 days'])
  })
})
