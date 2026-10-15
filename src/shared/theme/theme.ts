/**
 * Dark is the designed default. `?theme=light` or `?theme=dark` pins the rendering for one visit,
 * so a screenshot or a link can show either. Without a pin the system preference decides.
 */

export type Theme = 'dark' | 'light'

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
    themeFromQuery(window.location.search),
    window.matchMedia('(prefers-color-scheme: light)').matches,
  )
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  root.classList.toggle('light', theme === 'light')
  root.style.colorScheme = theme
  return theme
}
