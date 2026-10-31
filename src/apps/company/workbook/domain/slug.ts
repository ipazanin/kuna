import { listInWords } from '../../../../shared/text/listInWords'
import { plural } from '../../../../shared/text/translation'
import type { CroatianForms, EnglishForms } from '../../../../shared/text/translation'
import { words } from './words'
import type { SlugNoun } from './words'

/** Lower-case letters and digits in words joined by single hyphens, such as `ai-services` or `main`. */
const SLUG_FORMAT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * Why a name cannot serve as a category, account, client or grant, or null when it can. A comma
 * would split it on a year-end konto row, and a space or a capital reads differently in the Sheet's
 * dropdowns and the statement fetch's file names, so a new name keeps to the format the seed uses.
 */
export function slugProblem(slug: string, noun: SlugNoun): string | null {
  if (slug === '') {
    return words.slugs.needsName(noun)
  }
  return SLUG_FORMAT.test(slug) ? null : words.slugs.notAName(slug, noun)
}

/** Where something outside its own tab names a slug, such as "3 ledger rows" or "the rule merchant-model". */
export type SlugUses = ReadonlyMap<string, readonly string[]>

/** Each slug with what names it, in the order the kinds are given. */
export function usesOf(kinds: readonly ReadonlyMap<string, string>[]): SlugUses {
  const uses = new Map<string, string[]>()
  for (const kind of kinds) {
    for (const [slug, use] of kind) {
      uses.set(slug, [...(uses.get(slug) ?? []), use])
    }
  }
  return uses
}

/** A counted phrase of a dictionary as `countedBy` takes it, in the form the language writes the count with. */
export function counted(phrase: (count: number) => EnglishForms | CroatianForms): (count: number) => string {
  return (count) => plural(phrase(count), count)
}

/** How many of these records name each slug, as `counted` words the count, such as "3 ledger rows". */
export function countedBy<Named>(records: readonly Named[], slugsOf: (record: Named) => readonly string[], counted: (count: number) => string): ReadonlyMap<string, string> {
  const counts = new Map<string, number>()
  for (const record of records) {
    for (const slug of new Set(slugsOf(record))) {
      if (slug !== '') counts.set(slug, (counts.get(slug) ?? 0) + 1)
    }
  }
  return new Map([...counts].map(([slug, count]) => [slug, counted(count)]))
}

/** One row's name before and after a change. `from` is null for an added row, `to` for a deleted one. */
export interface SlugEdit {
  readonly from: string | null
  readonly to: string | null
}

export interface SlugChange {
  readonly edits: readonly SlugEdit[]
  /** The names of the rows the change leaves alone. */
  readonly untouched: readonly { readonly slug: string }[]
}

/**
 * The rules every named tab shares. A new or changed name keeps to the slug format and, where a
 * name is one row only, is not on another row already. A name in use elsewhere is never renamed or
 * deleted, since those rows would lose what they name. A name that stays on another row of the tab
 * is not gone, so a client keeps its invoices while one of its IBAN rows goes.
 */
export function slugChangeRefusals(noun: SlugNoun, change: SlugChange, uses: SlugUses, oneRowEach: boolean): string[] {
  const refusals: string[] = []
  /** Whether another row holds the name: one already on the tab, or one this change adds. */
  const holder = (slug: string, skip: SlugEdit): 'saved' | 'added' | null => {
    if (change.untouched.some((row) => row.slug === slug)) return 'saved'
    const edit = change.edits.find((other) => other !== skip && other.to === slug)
    return edit === undefined ? null : edit.from === null ? 'added' : 'saved'
  }
  for (const edit of change.edits) {
    if (edit.to === null || edit.to === edit.from) {
      continue
    }
    const problem = slugProblem(edit.to, noun)
    if (problem !== null) {
      refusals.push(`${problem}.`)
      continue
    }
    const held = holder(edit.to, edit)
    if (oneRowEach && held !== null) {
      refusals.push(held === 'added' ? words.slugs.addedTwice(edit.to) : words.slugs.already(edit.to, noun))
    }
  }
  const remaining = new Set([...change.untouched.map((row) => row.slug), ...change.edits.flatMap((edit) => (edit.to === null ? [] : [edit.to]))])
  for (const edit of change.edits) {
    if (edit.from === null || edit.from === edit.to || remaining.has(edit.from)) {
      continue
    }
    const users = uses.get(edit.from) ?? []
    if (users.length > 0) {
      refusals.push(words.slugs.inUse(edit.from, edit.to === null, listInWords(users)))
    }
  }
  return refusals
}
