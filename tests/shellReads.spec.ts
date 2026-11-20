import { describe, expect, it } from 'vitest'

import type { AppContribution, ShellReads } from '../src/shared/app/appContribution'
import type { AppMoneyWithOwner } from '../src/shared/app/moneyWithOwner'
import type { AppLoanTargets } from '../src/shared/app/loanTargets'
import type { AppCashMovements } from '../src/shared/app/cashMovements'
import type { AppRowLinks } from '../src/shared/app/rowLinks'
import { installApp } from '../src/shell/routing/appRegistry'

/** An app as the shell's reads see it: its id, what it hands over, and the reads it installed with. */
function appOf(
  id: string,
  handed: { rowLinks?: () => AppRowLinks; moneyWithOwner?: () => AppMoneyWithOwner; loanTargets?: () => AppLoanTargets; cashMovements?: () => AppCashMovements },
  kept: { shell: ShellReads | null },
): AppContribution {
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
    let money: AppMoneyWithOwner = 'opening'
    await installApp(appOf('spending', { rowLinks: () => [] }, kept))
    await installApp(appOf('company', { moneyWithOwner: () => money }, kept))
    await installApp(appOf('assets', {}, kept))

    expect(kept.shell?.linkedRows()).toEqual([{ app: 'spending', links: [] }])
    expect(kept.shell?.moneyWithOwner()).toEqual([{ app: 'company', money: 'opening' }])
    money = null
    expect(kept.shell?.moneyWithOwner()).toEqual([{ app: 'company', money: null }])
  })

  it('gathers the loan records of each app that keeps loans, by app, afresh at each call', async () => {
    const kept: { shell: ShellReads | null } = { shell: null }
    let targets: AppLoanTargets = 'opening'
    await installApp(appOf('loans', { loanTargets: () => targets }, kept))
    await installApp(appOf('assets', {}, kept))

    expect(kept.shell?.loanTargets()).toEqual([{ app: 'loans', targets: 'opening' }])
    targets = { instalments: [], extraPayments: [], informalLoans: [] }
    expect(kept.shell?.loanTargets()).toEqual([{ app: 'loans', targets: { instalments: [], extraPayments: [], informalLoans: [] } }])
  })

  it('gathers the deposits and withdrawals of each app that keeps accounts at brokers, by app, afresh at each call', async () => {
    const kept: { shell: ShellReads | null } = { shell: null }
    let movements: AppCashMovements = 'opening'
    await installApp(appOf('investments', { cashMovements: () => movements }, kept))
    await installApp(appOf('assets', {}, kept))

    expect(kept.shell?.cashMovements()).toEqual([{ app: 'investments', movements: 'opening' }])
    movements = []
    expect(kept.shell?.cashMovements()).toEqual([{ app: 'investments', movements: [] }])
  })
})
