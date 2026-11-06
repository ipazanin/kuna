// @vitest-environment jsdom
import { shallowReactive } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SECRETS_FILE_NAME, encodeSecretsFile } from '../src/shared/secrets/domain/secretsFile'
import { secretsDriveOn } from '../src/shared/secrets/infrastructure/fake/fakeSecretsDrive'
import { APP_DATA_FOLDER } from '../src/shared/google/driveClient'
import { createFakeDrive } from '../src/shared/storage/infrastructure/fake/fakeDrive'
import type { FakeDrive } from '../src/shared/storage/infrastructure/fake/fakeDrive'
import { en, hr } from '../src/shared/secrets/presentation/words'
import { en as shellEn, hr as shellHr } from '../src/shell/settings/words'
import { book, instrument } from './fixtures/investments'

const page = vi.hoisted(() => ({
  state: null as unknown as { choice: { source: 'drive' | 'browser'; id: string; name: string } | null; workbook: { book: unknown } | null; missing: boolean },
  companyState: null as unknown as { workbook: null; missing: boolean },
  drive: null as unknown as FakeDrive,
  order: [] as string[],
}))

vi.mock('../src/apps/investments/workbook/application/investmentsStore', () => ({
  useInvestmentsBooks: () => ({
    get state() {
      return page.state
    },
  }),
}))
vi.mock('../src/shared/secrets/infrastructure/googleSecretsDrive', () => ({
  googleSecretsDrive: () => secretsDriveOn(page.drive),
  allowHiddenFolder: async () => {
    page.order.push('asked Google')
  },
}))
vi.mock('../src/apps/company/workbook/application/workbookStore', () => ({
  useWorkbook: () => ({
    get state() {
      return page.companyState
    },
  }),
}))
vi.mock('../src/apps/company/workbook-files/presentation/LocalWorkbookStatus.vue', () => ({ default: {} }))
vi.mock('../src/apps/company/mail/presentation/useMailSync', () => ({ useMailSync: () => ({ step: { id: 'mail' } }), mailNeeds: () => [] }))
vi.mock('../src/apps/company/imports/presentation/useStatementSync', () => ({ useStatementSync: () => ({ step: { id: 'statements' } }), statementNeeds: () => [] }))
vi.mock('../src/shared/storage/presentation/useRecordWrites', () => ({ useRecordWrites: () => ({ undo: async () => {} }) }))
vi.mock('../src/apps/investments/prices/presentation/usePrices', () => ({ PRICES_STEP: { id: 'prices' } }))
vi.mock('../src/apps/investments/workbook/presentation/LocalInvestmentsStatus.vue', () => ({ default: {} }))
vi.mock('../src/apps/loans/workbook/presentation/LocalLoansStatus.vue', () => ({ default: {} }))

const { deleteKeysFromGoogle, fetchKeysFromGoogle, secretsNeeds, secretsStep } = await import('../src/shared/secrets/presentation/secretsStep')
const { PAGE_SECRET_STORE } = await import('../src/shared/secrets/presentation/pageSecrets')
const { investmentsSyncGroup } = await import('../src/apps/investments/sync/presentation/investmentsSyncGroup')
const { loansSyncGroup } = await import('../src/apps/loans/sync/presentation/loansSyncGroup')
const { companySyncGroup } = await import('../src/apps/company/sync/presentation/useSync')

const settled = async (): Promise<void> => {}
const OTHER_KEY = 'made-up-twelve-data-key-8642'
let runs = 0

/** A new run's start, as each sync of the page has its own. */
function nextRun(): string {
  runs += 1
  return `2026-10-30T10:${String(runs).padStart(2, '0')}:00.000Z`
}

beforeEach(() => {
  localStorage.clear()
  page.state = shallowReactive({ choice: { source: 'drive', id: 'investments-file-1', name: 'Investments' }, workbook: { book: book({}) }, missing: false })
  page.companyState = shallowReactive({ workbook: null, missing: false })
  page.drive = createFakeDrive()
})

describe('when the Keys step runs and what it asks Google for', () => {
  it('is off and asks nothing while nothing wants it and this browser holds no secret', () => {
    expect(secretsStep(() => false).on()).toBe(false)
    expect(secretsNeeds(() => false)).toEqual([])
  })

  it("asks for the app's hidden folder while its app wants it, so this browser can take another browser's key", () => {
    expect(secretsStep(() => true).on()).toBe(true)
    expect(secretsNeeds(() => true)).toEqual([{ scope: 'drive.appdata', label: 'Keys' }])
  })

  it('is on once this browser saved or removed any secret, whatever the app wants', () => {
    PAGE_SECRET_STORE.write('anthropic', 'made-up-anthropic-key-5521')
    expect(secretsStep(() => false).on()).toBe(true)
    PAGE_SECRET_STORE.write('anthropic', null)
    expect(secretsNeeds(() => false)).toEqual([{ scope: 'drive.appdata', label: 'Keys' }])
  })
})

describe('Get it from Google on the assistant card', () => {
  it('takes a key another browser saved, for a browser that holds none and wants none', async () => {
    const saved = { anthropic: { key: 'made-up-anthropic-key-5521', changedAt: '2026-10-30T10:00:00.000Z' } }
    await page.drive.createFile(APP_DATA_FOLDER, SECRETS_FILE_NAME, encodeSecretsFile(saved))
    expect(await fetchKeysFromGoogle(settled)).toBeNull()
    expect(PAGE_SECRET_STORE.read('anthropic')).toBe('made-up-anthropic-key-5521')
  })

  it('takes nothing and writes no file when the account holds no key', async () => {
    expect(await fetchKeysFromGoogle(settled)).toBeNull()
    expect(PAGE_SECRET_STORE.read('anthropic')).toBeNull()
    expect(await page.drive.children(APP_DATA_FOLDER)).toEqual([])
  })

  it('says why a file it cannot read was left as it is, and quotes nothing of that file', async () => {
    await page.drive.createFile(APP_DATA_FOLDER, SECRETS_FILE_NAME, 'made-up-anthropic-key-5521 in a file that is not the keys file')
    const refusal = await fetchKeysFromGoogle(settled)
    expect(refusal).toBe(en.refused['not-keys'])
    expect(refusal).not.toContain('made-up-anthropic-key-5521')
    expect(PAGE_SECRET_STORE.read('anthropic')).toBeNull()
  })

  it('asks Google before it waits for the sync under way, as the window opens only during the tap', async () => {
    page.order = []
    await fetchKeysFromGoogle(async () => {
      page.order.push('sync settled')
    })
    expect(page.order).toEqual(['asked Google', 'sync settled'])
  })
})

describe('the Investments part of the sync', () => {
  it('runs the keys before the prices, so the day fetch has a key another browser saved', () => {
    expect(
      investmentsSyncGroup()
        .steps()
        .map((step) => step.id),
    ).toEqual(['secrets', 'prices'])
  })

  it('wants the keys once a holding is priced through a vendor that needs a key', () => {
    const [keys] = investmentsSyncGroup().steps()
    expect(keys!.on()).toBe(false)
    page.state.workbook = { book: book({ instruments: [instrument('abc')] }) }
    expect(keys!.on()).toBe(true)
    expect(investmentsSyncGroup().needs()).toEqual([
      { scope: 'drive.file', label: 'Books' },
      { scope: 'drive.appdata', label: 'Keys' },
    ])
  })

  it("needs the app's hidden folder only while there are keys to carry, and the Loans file never does", () => {
    expect(investmentsSyncGroup().needs()).toEqual([{ scope: 'drive.file', label: 'Books' }])
    expect(loansSyncGroup().needs()).toEqual([{ scope: 'drive.file', label: 'Books' }])
    PAGE_SECRET_STORE.write('twelvedata', OTHER_KEY)
    expect(investmentsSyncGroup().needs()).toEqual([
      { scope: 'drive.file', label: 'Books' },
      { scope: 'drive.appdata', label: 'Keys' },
    ])
    expect(loansSyncGroup().needs()).toEqual([{ scope: 'drive.file', label: 'Books' }])
  })

  it('asks nothing for the keys of a file in the bin or gone, whose books step fails before them', () => {
    PAGE_SECRET_STORE.write('twelvedata', OTHER_KEY)
    page.state.missing = true
    expect(investmentsSyncGroup().needs()).toEqual([{ scope: 'drive.file', label: 'Books' }])
  })
})

describe('the Company part of the sync', () => {
  it('asks for the hidden folder while there are keys to carry', () => {
    PAGE_SECRET_STORE.write('anthropic', 'made-up-anthropic-key-5521')
    expect(companySyncGroup().needs()).toContainEqual({ scope: 'drive.appdata', label: 'Keys' })
  })

  it('asks nothing for the keys of a file in the bin or gone, whose books step fails before them', () => {
    PAGE_SECRET_STORE.write('anthropic', 'made-up-anthropic-key-5521')
    page.companyState.missing = true
    expect(companySyncGroup().needs()).not.toContainEqual({ scope: 'drive.appdata', label: 'Keys' })
  })
})

describe('the Keys step', () => {
  it('saves a key kept here to the secrets file and says so', async () => {
    PAGE_SECRET_STORE.write('twelvedata', OTHER_KEY)
    expect(await secretsStep(() => true).run(() => {}, nextRun())).toMatchObject({ kind: 'done', line: "Saved this browser's keys to your Google account", link: null })
    expect(await page.drive.children(APP_DATA_FOLDER)).toEqual([expect.objectContaining({ name: SECRETS_FILE_NAME })])
  })

  it("takes another browser's key into this one", async () => {
    await page.drive.createFile(APP_DATA_FOLDER, SECRETS_FILE_NAME, encodeSecretsFile({ twelvedata: { key: OTHER_KEY, changedAt: '2026-10-30T10:00:00.000Z' } }))
    const step = secretsStep(() => true)
    expect(await step.run(() => {}, nextRun())).toMatchObject({ kind: 'done', line: 'Took the changes another browser saved' })
    expect(localStorage.getItem('kuna.secret.twelvedata')).toBe(OTHER_KEY)
    expect(await step.run(() => {}, nextRun())).toMatchObject({ kind: 'done', line: 'Up to date' })
  })

  it('reaches Drive once in a run that two groups list it in, and again in the next run', async () => {
    PAGE_SECRET_STORE.write('twelvedata', OTHER_KEY)
    const run = nextRun()
    const company = secretsStep(() => true)
    const investments = secretsStep(() => true)
    expect(await company.run(() => {}, run)).toMatchObject({ kind: 'done', line: "Saved this browser's keys to your Google account" })
    const asked = page.drive.requests.length
    expect(await investments.run(() => {}, run)).toMatchObject({ kind: 'done', line: 'Up to date' })
    expect(page.drive.requests).toHaveLength(asked)
    await investments.run(() => {}, nextRun())
    expect(page.drive.requests.length).toBeGreaterThan(asked)
  })

  it('tries Drive again in the next group of a run whose first try failed', async () => {
    const run = nextRun()
    const listing = vi.spyOn(page.drive, 'children').mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await expect(secretsStep(() => true).run(() => {}, run)).rejects.toThrow('Failed to fetch')
    expect(await secretsStep(() => true).run(() => {}, run)).toMatchObject({ kind: 'done', line: 'Up to date' })
    expect(listing).toHaveBeenCalledTimes(2)
  })

  it('tries Drive again in the next group of a run whose first group met a file it refuses', async () => {
    await page.drive.createFile(APP_DATA_FOLDER, SECRETS_FILE_NAME, 'not json')
    const run = nextRun()
    expect(await secretsStep(() => true).run(() => {}, run)).toMatchObject({ kind: 'failed' })
    expect(await secretsStep(() => true).run(() => {}, run)).toMatchObject({ kind: 'failed' })
  })

  it('fails on a secrets file Kuna does not write and links to Kuna settings', async () => {
    await page.drive.createFile(APP_DATA_FOLDER, SECRETS_FILE_NAME, 'not json')
    expect(await secretsStep(() => true).run(() => {}, nextRun())).toEqual({
      kind: 'failed',
      line: 'A keys file in your Google account is not one Kuna can read, so Kuna left it as it is. Delete my keys from my Google account, in Kuna settings, clears it.',
      link: { label: 'Kuna settings', to: '/settings' },
    })
  })

  it('never writes a stored time the file would refuse, so the next sync still reads the file', async () => {
    localStorage.setItem('kuna.secret.twelvedata', OTHER_KEY)
    localStorage.setItem('kuna.secret-changed.twelvedata', '2026-10-30T10:00:00Z')
    const step = secretsStep(() => true)
    expect(await step.run(() => {}, nextRun())).toMatchObject({ kind: 'done', line: "Saved this browser's keys to your Google account" })
    expect(await step.run(() => {}, nextRun())).toMatchObject({ kind: 'done', line: 'Up to date' })
  })
})

describe('deleting the keys from the Google account', () => {
  it('clears a file the sync refuses and every old file, so the next sync works, and leaves the keys of this browser', async () => {
    PAGE_SECRET_STORE.write('twelvedata', OTHER_KEY)
    await page.drive.createFile(APP_DATA_FOLDER, SECRETS_FILE_NAME, encodeSecretsFile({ twelvedata: { key: 'made-up-other-key-1111', changedAt: '2026-10-30T10:00:00.000Z' } }))
    await page.drive.createFile(APP_DATA_FOLDER, 'kuna-investments-keys-old.json', 'not json')
    expect(await secretsStep(() => true).run(() => {}, nextRun())).toMatchObject({ kind: 'failed' })

    await deleteKeysFromGoogle()

    expect(await page.drive.children(APP_DATA_FOLDER)).toEqual([])
    expect(localStorage.getItem('kuna.secret.twelvedata')).toBe(OTHER_KEY)
    expect(await secretsStep(() => true).run(() => {}, nextRun())).toMatchObject({ kind: 'done', line: "Saved this browser's keys to your Google account" })
  })

  it('points to the action from the refusal, in both languages', () => {
    expect(en.refused['not-keys']).toContain(shellEn.keys.action)
    expect(hr.refused['not-keys']).toContain(shellHr.keys.action)
  })
})
