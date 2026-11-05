import { afterEach, describe, expect, it, vi } from 'vitest'

const asked = vi.hoisted(() => [] as string[])

vi.mock('../src/shared/google/googleAuth', () => ({
  tokenFor: async (scope: string) => {
    asked.push(scope)
    return 'made-up-token'
  },
}))

const { trashPricesFilesBeside } = await import('../src/apps/investments/prices/application/pricesUpdate')
const { PRICES_FILE_NAME } = await import('../src/apps/investments/prices/domain/pricesFile')
const { SECRETS_FILE_NAME } = await import('../src/shared/secrets/domain/secretsFile')
const { pricesDriveOn } = await import('../src/apps/investments/prices/infrastructure/fake/fakePricesDrive')
const { googlePricesDrive } = await import('../src/apps/investments/prices/infrastructure/googlePricesDrive')
const { APP_DATA_FOLDER } = await import('../src/shared/google/driveClient')
const { createFakeDrive } = await import('../src/shared/storage/infrastructure/fake/fakeDrive')

afterEach(() => {
  vi.unstubAllGlobals()
  asked.length = 0
})

describe('the Drive side of removing the Investments file', () => {
  it('moves every prices file beside the Investments file to the bin, makes none, and leaves the secrets file in the hidden folder', async () => {
    const drive = createFakeDrive()
    const folder = await drive.createFolder('root', 'Books')
    const investments = await drive.createFile(folder, 'kuna-investments.json', '{}')
    const prices = await drive.createFile(folder, PRICES_FILE_NAME, '{}')
    const madeAtOnce = await drive.createFile(folder, PRICES_FILE_NAME, '{}')
    const secrets = await drive.createFile(APP_DATA_FOLDER, SECRETS_FILE_NAME, '{}')

    await trashPricesFilesBeside(pricesDriveOn(drive), investments.id)

    expect([drive.file(prices.id).trashed, drive.file(madeAtOnce.id).trashed, drive.file(investments.id).trashed]).toEqual([true, true, false])
    expect((await drive.children(APP_DATA_FOLDER)).map((entry) => entry.id)).toEqual([secrets.id])
    expect(drive.requests.filter((request) => request === 'createFile')).toHaveLength(4)
    await trashPricesFilesBeside(pricesDriveOn(drive), investments.id)
    expect(drive.requests.filter((request) => request === 'createFile')).toHaveLength(4)
  })

  it("refuses to move a file of the app's hidden folder to the bin, as Drive does", async () => {
    const drive = createFakeDrive()
    const keys = await drive.createFile(APP_DATA_FOLDER, SECRETS_FILE_NAME, '{}')

    await expect(drive.trash(keys.id)).rejects.toThrow('403')
  })

  it('moves the prices file to the bin with files.update and a token for the files Kuna made', async () => {
    const sent: { method: string; url: URL; body: string }[] = []
    vi.stubGlobal('fetch', async (input: string, init: RequestInit) => {
      sent.push({ method: init.method ?? 'GET', url: new URL(input), body: String(init.body) })
      return Response.json({ id: 'prices-1' })
    })

    await googlePricesDrive().trash('prices-1')

    expect(sent).toEqual([{ method: 'PATCH', url: new URL('https://www.googleapis.com/drive/v3/files/prices-1?fields=id'), body: '{"trashed":true}' }])
    expect(asked).toEqual(['drive.file'])
  })

  it('answers no revision for a prices file in the bin, which Drive still answers for', async () => {
    const asks: URL[] = []
    vi.stubGlobal('fetch', async (input: string) => {
      asks.push(new URL(input))
      return Response.json({ headRevisionId: 'revision-1', trashed: true })
    })

    expect(await googlePricesDrive().headRevision('prices-1')).toBeNull()
    expect(asks[0]?.searchParams.get('fields')).toBe('headRevisionId,trashed')
  })

  it('answers no revision for a prices file in the bin on the fake Drive too', async () => {
    const drive = createFakeDrive()
    const folder = await drive.createFolder('root', 'Books')
    const prices = await drive.createFile(folder, PRICES_FILE_NAME, '{}')

    await drive.trash(prices.id)

    expect(await pricesDriveOn(drive).headRevision(prices.id)).toBeNull()
  })
})
