import type { AppAssistant } from '../../app/appContribution'
import { language } from '../../text/language'

/** Where a person writes down what Kuna cannot do. The chat links here and nothing more: no draft and no token. */
export const KUNA_ISSUES_ADDRESS = 'https://github.com/ipazanin/kuna/issues'

/** What `show_screen` takes in place of an address, for the link to the issues page. */
export const ISSUES_ROUTE = 'issues'

/** A screen the catalogue reads: its name and address, and nothing a person's books decide. */
export interface CatalogueScreen {
  readonly path: `/${string}`
  readonly title: string
}

/** One app as the catalogue reads it. */
export interface CatalogueApp {
  readonly id: string
  readonly name: string
  readonly purpose: string
  readonly screens: readonly CatalogueScreen[]
  readonly assistant: AppAssistant
}

/** What a chat knows about this version of Kuna, built once from what the code declares. */
export interface Catalogue {
  /** The instructions, which stay the same through a chat so they can be cached. */
  readonly system: string
  /** Each page `kuna_docs` can open, by its path. */
  readonly pages: ReadonlyMap<string, string>
  /** Each address `show_screen` can link to, with the words on its link. */
  readonly routes: ReadonlyMap<string, string>
  /** Each place inside a screen, such as a tab, by its address, with the title it goes by on screen. */
  readonly places: ReadonlyMap<string, string>
}

function kindNoun(kind: AppAssistant['kinds'][number]): string {
  return language === 'hr' ? kind.noun.hr.one : kind.noun.en.one
}

function section(title: string, lines: readonly string[]): readonly string[] {
  return lines.length === 0 ? [] : [`## ${title}`, ...lines]
}

function appPage(app: CatalogueApp): string {
  const { assistant } = app
  return [
    `# ${app.name}`,
    app.purpose,
    ...section(
      'Screens',
      app.screens.map((screen) => `- ${screen.title}: ${screen.path}`),
    ),
    ...section(
      'Places inside screens',
      assistant.places.map((place) => `- ${place.title}: ${place.route}`),
    ),
    ...section(
      'What it keeps',
      assistant.kinds.map((kind) => `- ${kindNoun(kind)} (${kind.name})`),
    ),
    ...section(
      'Settings',
      assistant.settings.map((setting) => `- ${setting.key}: ${setting.note}`),
    ),
    ...section(
      'Guides',
      assistant.guides.map((guide) => `- ${app.id}/guide/${guide.id}: ${guide.title}`),
    ),
  ].join('\n')
}

function kunaPage(screens: readonly CatalogueScreen[]): string {
  return ['# Kuna', 'Screens that belong to no one app.', ...section('Screens', [...screens.map((screen) => `- ${screen.title}: ${screen.path}`)])].join('\n')
}

function systemOf(apps: readonly CatalogueApp[]): string {
  return [
    "You are the assistant inside Kuna, an app that keeps a person's company books, loans, investments, assets and spending in their own files, computed in the browser.",
    '',
    '# What you can do',
    '- You explain what this version of Kuna does and how to use it. The tool kuna_docs opens its pages, which come from the code of the version running. Read a page before you say how something works, and never describe a screen or a setting no page names.',
    '- The tool show_screen puts a link to a screen under your answer. Use it whenever you send the person somewhere. Take the address from a page. It does not move them there.',
    '- Never write an address in your answer. Name the screen or tab as it is called on screen, and link it with show_screen.',
    '',
    '# What you cannot do',
    "- You cannot see the person's records, figures, files or settings values, and you cannot change anything. Never guess them. If an answer depends on them, say what to look at and link the screen.",
    '- When Kuna cannot do what the person wants, say so plainly, then call show_screen with the route "issues", which links the page where they can write it down. Do not write that report for them, and do not offer to send it. You have no access to it.',
    '- Keys, passwords, tokens and the files that hold them are out of your reach. Never ask for one. If someone pastes one, tell them to replace it.',
    '',
    '# How you answer',
    '- Answer in the language the person writes in, in short plain sentences. You may use short lists, **bold** and `code`, and nothing else from Markdown.',
    '- A line at the start of a message in <context> tags says where the person is now. It comes from Kuna and it is not something they typed. It can name one element they tagged, by its label only.',
    '- When the person is already on the screen or tab your answer is about, say they are there instead of sending them to it, and point at what is on it.',
    '',
    '# Pages',
    '- kuna: screens that belong to no one app',
    ...apps.map((app) => `- ${app.id}: ${app.name}. ${app.purpose}`),
  ].join('\n')
}

/** Builds what a chat knows. Given the same apps it gives the same bytes, with no dates and nothing from a person's books. */
export function catalogueOf(apps: readonly CatalogueApp[], kunaScreens: readonly CatalogueScreen[]): Catalogue {
  const pages = new Map<string, string>([['kuna', kunaPage(kunaScreens)]])
  const routes = new Map<string, string>(kunaScreens.map((screen) => [screen.path, screen.title]))
  const places = new Map<string, string>()
  for (const app of apps) {
    pages.set(app.id, appPage(app))
    for (const guide of app.assistant.guides) pages.set(`${app.id}/guide/${guide.id}`, [`# ${guide.title}`, guide.body, ...section('Places', [...guide.places])].join('\n'))
    for (const screen of app.screens) routes.set(screen.path, `${app.name}: ${screen.title}`)
    for (const place of app.assistant.places) {
      routes.set(place.route, `${app.name}: ${place.title}`)
      places.set(place.route, place.title)
    }
  }
  return { system: systemOf(apps), pages, routes, places }
}

/** The declared place a person is on, matched by its path and every query value its address names. No other part of the query is read, as filters can hold names. */
export function placeAt(catalogue: Catalogue, path: string, query: Readonly<Record<string, unknown>>): { readonly address: string; readonly title: string } | null {
  for (const [address, title] of catalogue.places) {
    const [placePath, placeQuery = ''] = address.split('?')
    if (placePath === path && [...new URLSearchParams(placeQuery)].every(([key, wanted]) => query[key] === wanted)) return { address, title }
  }
  return null
}
