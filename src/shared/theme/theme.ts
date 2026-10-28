import { readonly, shallowRef } from 'vue'

/**
 * Settings offers System, Light and Dark. System is the default and follows the device's setting,
 * also when it changes while the app is open. Light or Dark is remembered on this device, and
 * System forgets it. `?theme=light` or `?theme=dark` pins the rendering for one visit, so a
 * screenshot or a link can show either.
 */

export type Theme = 'dark' | 'light'

export type ThemeChoice = 'system' | Theme

const STORED_THEME_KEY = 'kuna.theme'
const LIGHT_QUERY = '(prefers-color-scheme: light)'

/** The `--surface-page` of each theme, for the browser bar of the installed app. */
const PAGE_COLOURS: Readonly<Record<Theme, string>> = { dark: '#0d1219', light: '#eef1f4' }

const active = shallowRef<Theme>('dark')
const chosen = shallowRef<ThemeChoice>('system')
let pinned: Theme | null = null

/** The theme on screen. Charts read it, so they redraw in the new colours when it changes. */
export const activeTheme = readonly(active)

/** What Settings shows as picked on this device. */
export const themeChoice = readonly(chosen)

function isTheme(candidate: unknown): candidate is Theme {
  return candidate === 'dark' || candidate === 'light'
}

export function themeFromQuery(search: string): Theme | null {
  const requested = new URLSearchParams(search).get('theme')
  return isTheme(requested) ? requested : null
}

/** A stored value other than Light or Dark, or none, is System. */
export function themeChoiceFrom(stored: string | null): ThemeChoice {
  return isTheme(stored) ? stored : 'system'
}

/** A pin from the address wins, then the choice made on Settings, and System takes the device's setting. */
export function resolveTheme(pin: Theme | null, choice: ThemeChoice, prefersLight: boolean): Theme {
  return pin ?? (choice === 'system' ? (prefersLight ? 'light' : 'dark') : choice)
}

/**
 * Runs before the app mounts. index.html ships with the `dark` class already on `<html>`, and its
 * inline script picks the theme the same way, so a light visitor sees the switch before anything
 * is painted. From then on a change of the device's setting repaints while the choice is System.
 */
export function applyInitialTheme(): Theme {
  pinned = themeFromQuery(window.location.search)
  chosen.value = themeChoiceFrom(storedTheme())
  const device = window.matchMedia(LIGHT_QUERY)
  device.addEventListener('change', (change) => paint(resolveTheme(pinned, chosen.value, change.matches)))
  const theme = resolveTheme(pinned, chosen.value, device.matches)
  paint(theme)
  return theme
}

/** Switches the theme now. Light or Dark is remembered on this device, and System forgets the choice. */
export function chooseTheme(choice: ThemeChoice): void {
  try {
    if (choice === 'system') {
      localStorage.removeItem(STORED_THEME_KEY)
    } else {
      localStorage.setItem(STORED_THEME_KEY, choice)
    }
  } catch {
    // Storage denied: the switch still holds for this visit.
  }
  chosen.value = choice
  pinned = null
  paint(resolveTheme(null, choice, window.matchMedia(LIGHT_QUERY).matches))
}

function storedTheme(): string | null {
  try {
    return localStorage.getItem(STORED_THEME_KEY)
  } catch {
    return null
  }
}

function paint(theme: Theme): void {
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  root.classList.toggle('light', theme === 'light')
  root.style.colorScheme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', PAGE_COLOURS[theme])
  active.value = theme
}
