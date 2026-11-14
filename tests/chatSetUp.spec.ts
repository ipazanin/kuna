import { readFileSync } from 'node:fs'

import { beforeEach, describe, expect, it } from 'vitest'

import { ASSETS_OPERATIONS } from '../src/apps/assets/assistant/operations/assetsOperations'
import { assetsAssistant } from '../src/apps/assets/assistant/assetsAssistant'
import { companyAssistant } from '../src/apps/company/assistant/companyAssistant'
import { companyOperations } from '../src/apps/company/assistant/operations/companyOperations'
import { HR_DOO_ASSISTANT } from '../src/apps/company/packs/hr-doo/assistant/hrDooAssistant'
import { hrDooOperations } from '../src/apps/company/packs/hr-doo/assistant/operations/packOperations'
import { investmentsAssistant } from '../src/apps/investments/assistant/investmentsAssistant'
import { INVESTMENTS_OPERATIONS } from '../src/apps/investments/assistant/operations/investmentsOperations'
import { loansAssistant } from '../src/apps/loans/assistant/loansAssistant'
import { LOANS_OPERATIONS } from '../src/apps/loans/assistant/operations/loansOperations'
import { spendingAssistant } from '../src/apps/spending/assistant/spendingAssistant'
import { SPENDING_OPERATIONS } from '../src/apps/spending/assistant/operations/spendingOperations'
import type { AppAssistant } from '../src/shared/app/appContribution'
import type { AppProposer, AssistantOperation, CheckedProposal } from '../src/shared/app/assistantOperations'
import { acceptingBrowserFileCards, browserFileOf, withBrowserFileCards } from '../src/shared/app/browserFileCards'
import { removesFile } from '../src/shared/app/browserFileStep'
import { answerKunaStart, forgetKunaStart, kunaStart } from '../src/shared/app/kunaStart'
import { CHAT_READING } from './fixtures/chatBook'
import { deskPorts } from './fixtures/companyDesk'
import { fakeCompanyBooks, readingOf } from './fixtures/companyChatBooks'

/** Each app's set-up line source, its assistant and every operation its chat can propose. */
const APPS: readonly { readonly id: string; readonly source: string; readonly assistant: AppAssistant; readonly operations: readonly AssistantOperation[] }[] = [
  { id: 'spending', source: 'src/apps/spending/overview/presentation/spendingSetUp.ts', assistant: spendingAssistant(CHAT_READING), operations: SPENDING_OPERATIONS },
  {
    id: 'company',
    source: 'src/apps/company/onboarding/presentation/gettingSetUp.ts',
    assistant: companyAssistant(HR_DOO_ASSISTANT, readingOf(fakeCompanyBooks()), () => []),
    operations: companyOperations(deskPorts({ pack: hrDooOperations(() => false) })),
  },
  {
    id: 'loans',
    source: 'src/apps/loans/overview/presentation/loansSetUp.ts',
    assistant: loansAssistant({ status: () => 'none', book: () => null, statementPayments: () => [] }),
    operations: LOANS_OPERATIONS,
  },
  {
    id: 'assets',
    source: 'src/apps/assets/overview/presentation/assetsSetUp.ts',
    assistant: assetsAssistant({ status: () => 'none', book: () => null, index: () => 'loading', loans: () => null }),
    operations: ASSETS_OPERATIONS,
  },
  {
    id: 'investments',
    source: 'src/apps/investments/overview/presentation/investmentsSetUp.ts',
    assistant: investmentsAssistant({ status: () => 'none', book: () => null, sources: () => null, taxShown: () => false }),
    operations: INVESTMENTS_OPERATIONS,
  },
]

/** Every key a set-up line source can give, written as a string or as a constant of the same file. */
function keysIn(file: string): readonly string[] {
  const source = readFileSync(file, 'utf8')
  const constants = new Map([...source.matchAll(/export const ([A-Z_]+) = '([a-z-]+)'/g)].map((found) => [found[1]!, found[2]!]))
  return [...source.matchAll(/key: (?:'([a-z-]+)'|([A-Z_]+))/g)].map((found) => found[1] ?? constants.get(found[2]!) ?? `unknown ${found[2]}`)
}

describe("each app's set-up lines", () => {
  it.each(APPS)('$id declares every key its set-up lines can give, and no other', ({ source, assistant }) => {
    expect(assistant.setUp.map((step) => step.key).sort()).toEqual([...new Set(keysIn(source))].sort())
  })

  it.each(APPS)('$id names only operations it has', ({ assistant, operations }) => {
    const names = new Set(operations.map((operation) => operation.name))
    expect(assistant.setUp.flatMap((step) => step.operations).filter((name) => !names.has(name))).toEqual([])
  })

  it.each(APPS)('$id marks a line that only an empty file shows, so the app counts as new', ({ source }) => {
    expect(readFileSync(source, 'utf8')).toContain('whileEmpty: true')
  })

  it.each(APPS)('$id has a set-up guide', ({ assistant }) => {
    expect(assistant.guides.some((guide) => guide.id === 'set-up')).toBe(true)
  })
})

/** A store with no file, which makes one in this browser and drops it again as the real store does. */
function emptyStore() {
  const state: { status: 'ready' | 'error'; choice: { id: string; source: 'browser' | 'drive' } | null; workbook: object | null; error: string | null } = {
    status: 'ready',
    choice: null,
    workbook: null,
    error: null,
  }
  let made = 0
  return {
    state,
    made: () => made,
    async replaceLocalWorkbook(contents: string) {
      made += 1
      Object.assign(state, { choice: { id: `local-${made}`, source: 'browser' }, workbook: { contents } })
      return Promise.resolve()
    },
    async dropWorkbook(id: string) {
      if (state.choice?.id !== id) return Promise.resolve(false)
      Object.assign(state, { choice: null, workbook: null })
      return Promise.resolve(true)
    },
  }
}

const NOTHING: AppProposer = { operations: [], readsBooks: true, check: () => Promise.resolve({ refused: ['The app took it.'] }) }

describe('the file cards', () => {
  let store: ReturnType<typeof emptyStore>
  let file: ReturnType<typeof browserFileOf<string>>

  beforeEach(() => {
    forgetKunaStart()
    store = emptyStore()
    file = browserFileOf(store as never, { id: 'loans', name: 'Loans' }, () => ({ contents: 'new', title: 'Loans file' }))
  })

  const check = (operation: string) => withBrowserFileCards(NOTHING, file).check('Make the file', [{ operation, input: {} } as never])
  const accept = (proposal: CheckedProposal) => acceptingBrowserFileCards({ accept: () => Promise.resolve({ kind: 'refused', reason: 'The app took it.' }) }, file).accept(proposal)

  it('make the file in this browser with no Undo, for a person who keeps their files there', async () => {
    answerKunaStart({ home: 'browser', apps: [] })
    const checked = await check('make-file')
    expect('held' in checked && checked.undoable).toBe(false)

    const result = await accept(checked as CheckedProposal)

    expect(result).toEqual({ kind: 'done', undo: null })
    expect(store.made()).toBe(1)
    expect(kunaStart()).toEqual({ home: 'browser', apps: ['loans'] })
  })

  it('send a person who keeps files on Drive to the start screen', async () => {
    answerKunaStart({ home: 'drive', apps: ['loans'] })
    expect(await check('make-file')).toEqual({ refused: [expect.stringContaining('Drive')] })
  })

  it('send a person who has not said where their files live to the start screen', async () => {
    expect(await check('make-file')).toEqual({ refused: [expect.stringContaining('has not said where they keep their files')] })
  })

  it('make no second file', async () => {
    answerKunaStart({ home: 'browser', apps: ['loans'] })
    await accept((await check('make-file')) as CheckedProposal)
    expect(await check('make-file')).toEqual({ refused: ['Loans has a file on this device already.'] })
  })

  it('remove only the file they made, and do not go on with the setup after it', async () => {
    answerKunaStart({ home: 'browser', apps: ['loans'] })
    expect(await check('remove-file')).toEqual({ refused: [expect.stringContaining('make-file made')] })
    const making = (await check('make-file')) as CheckedProposal
    await accept(making)

    const removing = (await check('remove-file')) as CheckedProposal
    const removed = await accept(removing)

    expect([removesFile(making), removesFile(removing)]).toEqual([false, true])
    expect(removed).toEqual({ kind: 'done', undo: null })
    expect(store.state.choice).toBeNull()
  })

  it('hand every other card to the app', async () => {
    expect(await check('add-bank-loan')).toEqual({ refused: ['The app took it.'] })
  })
})
