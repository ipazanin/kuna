import { afterEach, describe, expect, it, vi } from 'vitest'

import { googleConfig } from '../src/features/workbook/infrastructure/googleConfig'

function configure(clientId: string, apiKey: string, projectNumber: string): void {
  vi.stubEnv('VITE_GOOGLE_CLIENT_ID', clientId)
  vi.stubEnv('VITE_GOOGLE_API_KEY', apiKey)
  vi.stubEnv('VITE_GOOGLE_PROJECT_NUMBER', projectNumber)
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('googleConfig', () => {
  it('returns the three values, trimmed', () => {
    configure(' client.apps.googleusercontent.com ', 'api-key', '123456789012')

    expect(googleConfig()).toEqual({
      clientId: 'client.apps.googleusercontent.com',
      apiKey: 'api-key',
      projectNumber: '123456789012',
    })
  })

  it.each([
    ['VITE_GOOGLE_CLIENT_ID', ['', 'api-key', '123']],
    ['VITE_GOOGLE_API_KEY', ['client', '  ', '123']],
    ['VITE_GOOGLE_PROJECT_NUMBER', ['client', 'api-key', '']],
  ] as const)('names %s when it is missing', (missing, [clientId, apiKey, projectNumber]) => {
    configure(clientId, apiKey, projectNumber)

    expect(() => googleConfig()).toThrow(new RegExp(`^${missing} is not set`))
  })
})
