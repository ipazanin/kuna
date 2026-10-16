import { readonly, shallowRef } from 'vue'

/**
 * Dark is the designed default. `?theme=light` or `?theme=dark` pins the rendering for one visit,
 * so a screenshot or a link can show either. Without a pin, the choice made on Settings decides,
 * and without one of those the system preference does.
 */

export type Theme = 'dark' | 'light'

const STORED_THEME_KEY = 'ledgerboard.theme'

/** The `--surface-page` of each theme, for the browser bar of the installed app. */
const PAGE_COLOURS: Readonly<Record<Theme, string>> = { dark: '#0d1219', light: '#eef1f4' }

const active = shallowRef<Theme>('dark')

/** The theme on screen. Charts read it, so they redraw in the new colours when it changes. */
export const activeTheme = readonly(active)

function isTheme(candidate: unknown): candidate is Theme {
  return candidate === 'dark' || candidate === 'light'
}

export function themeFromQuery(search: string): Theme | null {
  const requested = new URLSearchParams(search).get('theme')
  return isTheme(requested) ? requested : null
}

export function resolveTheme(pinned: Theme | null, prefersLight: boolean): Theme {
  return pinned ?? (prefersLight ? 'light' : 'dark')
}

/**
 * Runs before the app mounts. index.html ships with the `dark` class already on `<html>`, so a
 * light visitor sees the switch before anything is painted rather than a frame later.
 */
export function applyInitialTheme(): Theme {
  const theme = resolveTheme(
    themeFromQuery(window.location.search) ?? storedTheme(),
    window.matchMedia('(prefers-color-scheme: light)').matches,
  )
  paint(theme)
  return theme
}

/** Switches the theme now and remembers it on this device. */
export function chooseTheme(theme: Theme): void {
  try {
    localStorage.setItem(STORED_THEME_KEY, theme)
  } catch {
    // Storage denied: the switch still holds for this visit.
  }
  paint(theme)
}

function storedTheme(): Theme | null {
  try {
    const stored = localStorage.getItem(STORED_THEME_KEY)
    return isTheme(stored) ? stored : null
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
