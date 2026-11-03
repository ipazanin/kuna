import { afterEach, describe, expect, it, vi } from 'vitest'

const asked = vi.hoisted(() => [] as string[])

vi.mock('../src/shared/google/googleAuth', () => ({
  tokenFor: async (scope: string) => {
    asked.push(scope)
    return 'made-up-token'
  },
}))

const { googleKeysDrive } = await import('../src/apps/investments/prices/infrastructure/googleKeysDrive')

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

describe("the keys file's requests to Drive", () => {
  it("searches the app's hidden folder by name alone, with a token for that folder", async () => {
    const requests = stubDrive(() => Response.json({ files: [{ id: 'keys-1' }] }))

    expect(await googleKeysDrive().filesNamed('kuna-investments-keys-abc.json')).toEqual(['keys-1'])
    expect(requests).toHaveLength(1)
    expect(requests[0]!.url.searchParams.get('spaces')).toBe('appDataFolder')
    expect(requests[0]!.url.searchParams.get('q')).toBe("name = 'kuna-investments-keys-abc.json'")
    expect(asked).toEqual(['drive.appdata'])
  })

  it("makes the file in the app's hidden folder", async () => {
    const requests = stubDrive(() => Response.json({ id: 'keys-1' }))

    expect(await googleKeysDrive().createFile('kuna-investments-keys-abc.json', '{}\n')).toBe('keys-1')
    expect(requests[0]!.method).toBe('POST')
    expect(JSON.parse(/\r\n\r\n(\{.*\})\r\n/.exec(requests[0]!.body)![1]!)).toEqual({
      name: 'kuna-investments-keys-abc.json',
      mimeType: 'application/json',
      parents: ['appDataFolder'],
    })
  })

  it('overwrites the content without keeping the revision forever', async () => {
    const requests = stubDrive(() => Response.json({ headRevisionId: 'r2' }))

    await googleKeysDrive().overwrite('keys-1', '{}\n')
    expect(requests[0]!.method).toBe('PATCH')
    expect(requests[0]!.url.pathname).toBe('/upload/drive/v3/files/keys-1')
    expect(requests[0]!.url.searchParams.get('keepRevisionForever')).toBeNull()
  })

  it("deletes a keys file for good with a token for the app's hidden folder, since Drive keeps no file of it in the bin", async () => {
    const requests = stubDrive(() => new Response(null, { status: 204 }))

    await googleKeysDrive().delete('keys-2')
    expect([requests[0]!.method, requests[0]!.url.pathname]).toEqual(['DELETE', '/drive/v3/files/keys-2'])
    expect(asked).toEqual(['drive.appdata'])
  })
})
