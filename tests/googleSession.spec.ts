// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'

import {
  EXPIRY_MARGIN_MS,
  forgetAccessToken,
  loadAccessToken,
  loadAccountEmail,
  saveAccessToken,
  saveAccountEmail,
} from '../src/features/workbook/infrastructure/googleSession'

const ISSUED_AT = Date.parse('2026-10-16T09:00:00.000Z')
const ONE_HOUR = 3_600_000
const TOKEN = { value: 'ya29.fake', grantedScope: 'https://www.googleapis.com/auth/drive.file openid email', expiresAt: ISSUED_AT + ONE_HOUR }

afterEach(() => {
  localStorage.clear()
})

describe('kept Google access token', () => {
  it('survives a reload within its lifetime', () => {
    saveAccessToken(TOKEN)

    expect(loadAccessToken(ISSUED_AT + 30 * 60_000)).toEqual(TOKEN)
  })

  it('counts as expired a minute before Google expires it, and is then removed', () => {
    saveAccessToken(TOKEN)

    expect(loadAccessToken(TOKEN.expiresAt - EXPIRY_MARGIN_MS)).toBeNull()
    expect(localStorage.getItem('ledgerboard.google-token')).toBeNull()
  })

  it('reads a damaged entry as no token and removes it', () => {
    localStorage.setItem('ledgerboard.google-token', '{"value":42}')

    expect(loadAccessToken(ISSUED_AT)).toBeNull()
    expect(localStorage.getItem('ledgerboard.google-token')).toBeNull()
  })

  it('is gone once forgotten, while the account email stays for the login hint', () => {
    saveAccessToken(TOKEN)
    saveAccountEmail('owner@example.com')

    forgetAccessToken()

    expect(loadAccessToken(ISSUED_AT)).toBeNull()
    expect(loadAccountEmail()).toBe('owner@example.com')
  })

  it('has no account email until one is read', () => {
    expect(loadAccountEmail()).toBeNull()
  })
})
