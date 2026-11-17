import { describe, expect, it } from 'vitest'

import type { AppContribution, ShellReads } from '../src/shared/app/appContribution'
import type { AppMoneyWithOwner } from '../src/shared/app/moneyWithOwner'
import type { AppRowLinks } from '../src/shared/app/rowLinks'
import { installApp } from '../src/shell/routing/appRegistry'

/** An app as the shell's reads see it: its id, what it hands over, and the reads it installed with. */
function appOf(id: string, handed: { rowLinks?: () => AppRowLinks; moneyWithOwner?: () => AppMoneyWithOwner }, kept: { shell: ShellReads | null }): AppContribution {
  return {
    id,
    ...handed,
    install: async (shell: ShellReads) => {
      kept.shell = shell
    },
  } as unknown as AppContribution
}

describe('what the shell lets an app read of the others', () => {
  it('gathers the linked rows and the money with the owner of each app that hands any over, by app, afresh at each call', async () => {
    const kept: { shell: ShellReads | null } = { shell: null }
    let payments: AppMoneyWithOwner = 'opening'
    await installApp(appOf('spending', { rowLinks: () => [] }, kept))
    await installApp(appOf('company', { moneyWithOwner: () => payments }, kept))
    await installApp(appOf('assets', {}, kept))

    expect(kept.shell?.linkedRows()).toEqual([{ app: 'spending', links: [] }])
    expect(kept.shell?.moneyWithOwner()).toEqual([{ app: 'company', payments: 'opening' }])
    payments = null
    expect(kept.shell?.moneyWithOwner()).toEqual([{ app: 'company', payments: null }])
  })
})
