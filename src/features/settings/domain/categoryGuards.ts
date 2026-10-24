import { OWNER_SHARE_ROLES } from '../../owner-share/domain/ownerShare'
import type { OwnerShare } from '../../owner-share/domain/ownerShare'
import { RECEIVABLE_ROLES } from '../../receivables/domain/invoiceMatching'
import { isPaletteColour } from '../../workbook/domain/categoryColour'
import { listInWords, slugChangeRefusals } from '../../workbook/domain/slug'
import type { SlugUses } from '../../workbook/domain/slug'
import { ADVANCE_BUCKETS } from '../../workbook/domain/workbook'

/** One categories row before and after a change, as the fields a check reads. `before` is null for an added row, `after` for a deleted one. */
export interface CategoryEdit<Cells extends { readonly slug: string }> {
  readonly before: Cells | null
  readonly after: Cells | null
}

export interface CategoryUses {
  /** What names each category outside its tab: ledger rows, rules, owner advances, split parts, year-end konto rows and plan rows. */
  readonly named: SlugUses
  /** How many owner advances each category carries. */
  readonly advances: ReadonlyMap<string, number>
}

/**
 * A category in use keeps its name and its row, since the ledger's chips, the rules and the other
 * tabs name it. A new name keeps to the slug format and is on one row only. A category owner advances carry stays in the operating or taxes bucket, where an advance
 * counts.
 */
export function categoryChangeRefusals(
  edits: readonly CategoryEdit<{ readonly slug: string; readonly bucket: string }>[],
  untouched: readonly { readonly slug: string }[],
  uses: CategoryUses,
): string[] {
  const refusals = slugChangeRefusals(
    'category',
    { edits: edits.map((edit) => ({ from: edit.before?.slug ?? null, to: edit.after?.slug ?? null })), untouched },
    uses.named,
    true,
  )
  for (const edit of edits) {
    if (edit.before === null || edit.after === null || edit.before.slug !== edit.after.slug || edit.before.bucket === edit.after.bucket) {
      continue
    }
    const advances = uses.advances.get(edit.after.slug) ?? 0
    if (advances > 0 && !(ADVANCE_BUCKETS as readonly string[]).includes(edit.after.bucket)) {
      refusals.push(
        `"${edit.after.slug}" stays in the operating or taxes bucket, since ${advances === 1 ? 'an owner advance carries it' : `${advances} owner advances carry it`} and an advance counts only as an operating cost or a tax.`,
      )
    }
  }
  return refusals
}

/**
 * A colour a change gives a category is a swatch of the palette, or blank for the bucket's colour,
 * so the app can draw it in both themes. A colour the change leaves alone stays as stored.
 */
export function categoryColourRefusals(edits: readonly CategoryEdit<{ readonly slug: string; readonly colour: string }>[]): string[] {
  return edits.flatMap((edit) =>
    edit.after === null || edit.after.colour === edit.before?.colour || isPaletteColour(edit.after.colour)
      ? []
      : [`"${edit.after.slug}" takes one of the nine colours of the palette, or none for its bucket's colour, not "${edit.after.colour}".`],
  )
}

/** The roles a category may carry: core's and the installed pack's, in that order. */
export function knownRoles(packRoles: readonly string[]): readonly string[] {
  return [...new Set([...Object.values(RECEIVABLE_ROLES), ...Object.values(OWNER_SHARE_ROLES), ...packRoles])]
}

interface ShareFields {
  readonly slug: string
  readonly bucket: string
  readonly roles: readonly string[]
  readonly ownerShare: OwnerShare | null
}

/**
 * A new or changed default owner share sits on an operating category while a category carries the
 * owner-benefit role, where the owner's part counts. That role sits on one owner-pay category only.
 * A default left outside operating, or without the role, counts as 0, so a change that leaves one
 * there is let through. `after` is every category the tab holds once the change is made.
 */
export function categoryShareRefusals(edits: readonly CategoryEdit<ShareFields>[], after: readonly ShareFields[]): string[] {
  const role = OWNER_SHARE_ROLES.ownerBenefit
  const carrying = after.filter((category) => category.roles.includes(role))
  const benefitCategory = carrying.length > 0
  const refusals: string[] = []
  for (const { before, after: changed } of edits) {
    if (changed === null || !changed.roles.includes(role)) continue
    const givesRole = before === null || !before.roles.includes(role)
    if ((givesRole || before.bucket !== changed.bucket) && changed.bucket !== 'owner-pay') {
      refusals.push(`"${changed.slug}" is in the ${changed.bucket} bucket, and only an owner-pay category carries the ${role} role, since the owner's part of a shared cost counts there.`)
    }
    const others = carrying.filter((category) => category.slug !== changed.slug).map((category) => `"${category.slug}"`)
    if (givesRole && others.length > 0) {
      refusals.push(`"${changed.slug}" takes the ${role} role only once no other category carries it, and ${listInWords(others)} ${others.length === 1 ? 'does' : 'do'}.`)
    }
  }
  for (const { before, after: changed } of edits) {
    if (changed === null || changed.ownerShare === null || before?.ownerShare === changed.ownerShare) continue
    if (changed.bucket !== 'operating') {
      refusals.push(`"${changed.slug}" is in the ${changed.bucket} bucket, and only an operating category holds an owner share.`)
    }
    if (!benefitCategory) {
      refusals.push(`"${changed.slug}" holds an owner share only once a category carries the ${role} role, where the owner's part counts.`)
    }
  }
  return refusals
}

/** A role a change gives a category is one core or the pack picks categories by, so a typo never leaves a category out of a figure unnoticed. */
export function categoryRoleRefusals(edits: readonly CategoryEdit<{ readonly slug: string; readonly roles: readonly string[] }>[], known: readonly string[]): string[] {
  return edits.flatMap((edit) => {
    const unknown = (edit.after?.roles ?? []).filter((role) => !known.includes(role) && !(edit.before?.roles ?? []).includes(role))
    return edit.after === null || unknown.length === 0 ? [] : [`"${edit.after.slug}" takes only roles the app knows, not ${unknown.map((role) => `"${role}"`).join(', ')}.`]
  })
}
