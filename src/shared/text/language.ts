/**
 * Settings offers Browser language, English and Hrvatski. Browser language is the default and shows
 * Croatian when the browser lists Croatian first. English or Hrvatski is remembered on this device,
 * and Browser language forgets it. `?lang=en` or `?lang=hr` pins the language for one visit, so a
 * screenshot or a link can show either. The language is read once when the app loads, and a new
 * choice reloads the page.
 */

export type Language = 'en' | 'hr'

export type LanguageChoice = 'browser' | Language

const STORED_LANGUAGE_KEY = 'kuna.language'

/** The tag each language writes dates, numbers and sorted lists with. */
const INTL_LOCALES: Readonly<Record<Language, string>> = { en: 'en-GB', hr: 'hr-HR' }

function isLanguage(candidate: unknown): candidate is Language {
  return candidate === 'en' || candidate === 'hr'
}

export function languageFromQuery(search: string): Language | null {
  const requested = new URLSearchParams(search).get('lang')
  return isLanguage(requested) ? requested : null
}

/** A stored value other than English or Hrvatski, or none, is Browser language. */
export function languageChoiceFrom(stored: string | null): LanguageChoice {
  return isLanguage(stored) ? stored : 'browser'
}

/** Croatian when the browser's first language is Croatian, otherwise English. */
export function browserLanguage(languages: readonly string[]): Language {
  const first = languages[0] ?? ''
  return first === 'hr' || first.startsWith('hr-') ? 'hr' : 'en'
}

/** A pin from the address wins, then the choice made on Settings, and Browser language takes the browser's. */
export function resolveLanguage(pin: Language | null, choice: LanguageChoice, browser: Language): Language {
  return pin ?? (choice === 'browser' ? browser : choice)
}

function storedLanguage(): string | null {
  try {
    return localStorage.getItem(STORED_LANGUAGE_KEY)
  } catch {
    return null
  }
}

/** What Settings shows as picked on this device. */
export const languageChoice: LanguageChoice = languageChoiceFrom(storedLanguage())

/**
 * The language on screen. Outside a browser it is English, since Node gives scripts and specs a
 * navigator that follows the machine's own languages.
 */
export const language: Language =
  typeof window === 'undefined' ? 'en' : resolveLanguage(languageFromQuery(window.location.search), languageChoice, browserLanguage(navigator.languages))

/** The BCP 47 tag that dates, numbers and sorted lists in the language are written with. */
export const intlLocale = INTL_LOCALES[language]

/** Runs before the app mounts, so screen readers and `:lang()` read the language on screen. */
export function applyLanguage(): void {
  document.documentElement.lang = language
}

/**
 * Remembers the choice on this device and loads the app again in it. Browser language forgets the
 * choice. A pin in the address is dropped, so the choice shows.
 */
export function chooseLanguage(choice: LanguageChoice): void {
  const address = new URL(window.location.href)
  address.searchParams.delete('lang')
  try {
    if (choice === 'browser') {
      localStorage.removeItem(STORED_LANGUAGE_KEY)
    } else {
      localStorage.setItem(STORED_LANGUAGE_KEY, choice)
    }
  } catch {
    // Storage denied: the address pins the choice for this visit instead.
    if (choice !== 'browser') address.searchParams.set('lang', choice)
  }
  // The router keeps the screen after the #, so only a reload, not a new address, loads the page again.
  history.replaceState(history.state, '', address)
  window.location.reload()
}
