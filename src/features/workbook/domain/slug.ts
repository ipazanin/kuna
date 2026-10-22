/** Lower-case letters and digits in words joined by single hyphens, such as `ai-services` or `main`. */
const SLUG_FORMAT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * Why a name cannot serve as a category, account, client or grant, or null when it can. A comma
 * would split it on a year-end konto row, and a space or a capital reads differently in the Sheet's
 * dropdowns and the Apps Script's file names, so a new name keeps to the format the seed uses.
 */
export function slugProblem(slug: string, noun: string): string | null {
  if (slug === '') {
    return `${capitalised(withArticle(noun))} needs a name`
  }
  return SLUG_FORMAT.test(slug) ? null : `"${slug}" is not ${withArticle(noun)} name the app can use: write it in lower-case letters and digits with single hyphens, such as ai-services`
}

/** "a category", "an account". */
function withArticle(noun: string): string {
  return `${/^[aeiou]/.test(noun) ? 'an' : 'a'} ${noun}`
}

function capitalised(text: string): string {
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`
}

/** Where something outside its own tab names a slug, such as "3 ledger rows" or "the rule merchant-model". */
export type SlugUses = ReadonlyMap<string, readonly string[]>

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
export function slugChangeRefusals(noun: string, change: SlugChange, uses: SlugUses, oneRowEach: boolean): string[] {
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
      refusals.push(held === 'added' ? `"${edit.to}" is added twice.` : `"${edit.to}" is already ${withArticle(noun)}.`)
    }
  }
  const remaining = new Set([...change.untouched.map((row) => row.slug), ...change.edits.flatMap((edit) => (edit.to === null ? [] : [edit.to]))])
  for (const edit of change.edits) {
    if (edit.from === null || edit.from === edit.to || remaining.has(edit.from)) {
      continue
    }
    const users = uses.get(edit.from) ?? []
    if (users.length > 0) {
      refusals.push(`"${edit.from}" cannot be ${edit.to === null ? 'deleted' : 'renamed'}, since it is used by ${listInWords(users)}.`)
    }
  }
  return refusals
}

/** "a, b and c". */
export function listInWords(parts: readonly string[]): string {
  return parts.length <= 1 ? (parts[0] ?? '') : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`
}
