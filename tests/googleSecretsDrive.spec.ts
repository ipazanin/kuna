import { afterEach, describe, expect, it, vi } from 'vitest'

const asked = vi.hoisted(() => [] as string[])

vi.mock('../src/shared/google/googleAuth', () => ({
  tokenFor: async (scope: string) => {
    asked.push(scope)
    return 'made-up-token'
  },
}))

const { allowHiddenFolder, googleSecretsDrive } = await import('../src/shared/secrets/infrastructure/googleSecretsDrive')

interface SentRequest {
  readonly method: string
  readonly url: URL
  readonly body: string
}

function stubDrive(answer: (request: SentRequest) => Response): SentRequest[] {
  const requests: SentRequest[] = []
  vi.stubGlobal('fetch', async (input: string, init: RequestInit) => {
    const request = { method: init.method ?? 'GET', url: new URL(input), body: init.body instanceof Blob ? await init.body.text() : String(init.body ?? '') }
    requests.push(request)
    return answer(request)
  })
  return requests
}

afterEach(() => {
  vi.unstubAllGlobals()
  asked.length = 0
})

describe("the secrets file's requests to Drive", () => {
  it('asks for the hidden folder alone when asked to allow it', async () => {
    await allowHiddenFolder()
    expect(asked).toEqual(['drive.appdata'])
  })

  it("lists every file of the app's hidden folder with its name, with a token for that folder", async () => {
    const files = [
      { id: 'secrets-1', name: 'kuna-secrets.json' },
      { id: 'keys-1', name: 'kuna-investments-keys-abc.json' },
    ]
    const requests = stubDrive(() => Response.json({ files }))

    expect(await googleSecretsDrive().files()).toEqual(files)
    expect(requests).toHaveLength(1)
    expect(requests[0]!.url.searchParams.get('spaces')).toBe('appDataFolder')
    expect(requests[0]!.url.searchParams.get('q')).toBe("'appDataFolder' in parents")
    expect(requests[0]!.url.searchParams.get('fields')).toBe('nextPageToken,files(id,name)')
    expect(asked).toEqual(['drive.appdata'])
  })

  it('reads every page of a long listing', async () => {
    const requests = stubDrive((request) =>
      request.url.searchParams.get('pageToken') === null
        ? Response.json({ files: [{ id: 'secrets-1', name: 'kuna-secrets.json' }], nextPageToken: 'page-2' })
        : Response.json({ files: [{ id: 'keys-1', name: 'kuna-investments-keys-abc.json' }] }),
    )

    expect((await googleSecretsDrive().files()).map((file) => file.id)).toEqual(['secrets-1', 'keys-1'])
    expect(requests).toHaveLength(2)
  })

  it("makes the file in the app's hidden folder", async () => {
    const requests = stubDrive(() => Response.json({ id: 'keys-1' }))

    expect(await googleSecretsDrive().createFile('kuna-secrets.json', '{}\n')).toBe('keys-1')
    expect(requests[0]!.method).toBe('POST')
    expect(JSON.parse(/\r\n\r\n(\{.*\})\r\n/.exec(requests[0]!.body)![1]!)).toEqual({
      name: 'kuna-secrets.json',
      mimeType: 'application/json',
      parents: ['appDataFolder'],
    })
  })

  it('overwrites the content without keeping the revision forever', async () => {
    const requests = stubDrive(() => Response.json({ headRevisionId: 'r2' }))

    await googleSecretsDrive().overwrite('keys-1', '{}\n')
    expect(requests[0]!.method).toBe('PATCH')
    expect(requests[0]!.url.pathname).toBe('/upload/drive/v3/files/keys-1')
    expect(requests[0]!.url.searchParams.get('keepRevisionForever')).toBeNull()
  })

  it("deletes an old keys file for good with a token for the app's hidden folder, since Drive keeps no file of it in the bin", async () => {
    const requests = stubDrive(() => new Response(null, { status: 204 }))

    await googleSecretsDrive().delete('keys-2')
    expect([requests[0]!.method, requests[0]!.url.pathname]).toEqual(['DELETE', '/drive/v3/files/keys-2'])
    expect(asked).toEqual(['drive.appdata'])
  })
})
