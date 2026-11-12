import { computed } from 'vue'
import type { ComputedRef } from 'vue'
import type { RouteLocationRaw } from 'vue-router'

import { loanTargets } from '../application/loanTargets'
import type { ShownTarget } from '../application/loanTargets'
import { linkStateOf } from '../domain/linkTarget'
import type { AppTargets, LinkState } from '../domain/linkTarget'
import type { RowLink } from '../../workbook/domain/rowLink'
import { linkText } from './words'

/** How a link shows: its record is there, Loans is still opening or not set up here, or Loans failed or no longer has the record. */
export type LinkLook = 'there' | 'waiting' | 'missing'

/** A row's link in words: the record it names with its page, or why that record is not shown, with the icon that goes with it. */
export interface LinkLine {
  readonly text: string
  readonly look: LinkLook
  /** Left out where the line's warning tone gives the icon. */
  readonly icon: string | undefined
  readonly to: RouteLocationRaw | null
}

const LOOKS: Readonly<Record<LinkState<unknown>['state'], { readonly look: LinkLook; readonly icon: string | undefined }>> = {
  there: { look: 'there', icon: 'i-lucide-link' },
  opening: { look: 'waiting', icon: 'i-lucide-link' },
  'not-set-up': { look: 'waiting', icon: 'i-lucide-info' },
  failed: { look: 'missing', icon: undefined },
  gone: { look: 'missing', icon: undefined },
}

/** The line a link reads as against Loans' records. */
export function linkLineOf(link: RowLink, loans: AppTargets<ShownTarget>): LinkLine {
  const read = linkStateOf(link, loans)
  return { text: linkText(read), ...LOOKS[read.state], to: read.state === 'there' ? read.target.to : null }
}

/** The tone of a link's line by its look: muted while Loans waits, a warning while its record is missing. */
export const LINK_TONE: Readonly<Record<LinkLook, 'muted' | 'warning' | undefined>> = { there: undefined, waiting: 'muted', missing: 'warning' }

/** The line of each link, against the Loans file on screen, read once for every row. */
export function useLinkLines(): ComputedRef<(link: RowLink) => LinkLine> {
  const loans = computed(() => loanTargets())
  return computed(() => {
    const held = loans.value
    return (link) => linkLineOf(link, held)
  })
}
