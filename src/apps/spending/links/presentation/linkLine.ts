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
  readonly icon: string
  readonly to: RouteLocationRaw | null
}

const LOOKS: Readonly<Record<LinkState<unknown>['state'], { readonly look: LinkLook; readonly icon: string }>> = {
  there: { look: 'there', icon: 'i-lucide-link' },
  opening: { look: 'waiting', icon: 'i-lucide-link' },
  'not-set-up': { look: 'waiting', icon: 'i-lucide-info' },
  failed: { look: 'missing', icon: 'i-lucide-triangle-alert' },
  gone: { look: 'missing', icon: 'i-lucide-triangle-alert' },
}

/** The line a link reads as against Loans' records. */
export function linkLineOf(link: RowLink, loans: AppTargets<ShownTarget>): LinkLine {
  const read = linkStateOf(link, loans)
  return { text: linkText(read), ...LOOKS[read.state], to: read.state === 'there' ? read.target.to : null }
}

/** The ink of a link's line by its look: muted while Loans waits, a warning while its record is missing. */
export const LINK_INK: Readonly<Record<LinkLook, string>> = { there: '', waiting: 'text-muted', missing: 'text-warning' }

/** The line of each link, against the Loans file on screen, read once for every row. */
export function useLinkLines(): ComputedRef<(link: RowLink) => LinkLine> {
  const loans = computed(() => loanTargets())
  return computed(() => {
    const held = loans.value
    return (link) => linkLineOf(link, held)
  })
}
