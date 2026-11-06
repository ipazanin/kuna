import { afterEach, describe, expect, it, vi } from 'vitest'

const google = vi.hoisted(() => ({ redirect: false, token: null as string | null }))

vi.mock('../src/shared/google/googleAuth', () => ({
  signsInByRedirect: () => google.redirect,
  currentToken: () => google.token,
  tokenFor: async () => 'token',
}))

import { canKeepPhotoNow } from '../src/apps/spending/receipts/presentation/receiptPhotosPort'

afterEach(() => {
  google.redirect = false
  google.token = null
})

describe('whether a tap can keep a photo on Drive', () => {
  it('holds where Google answers in a popup, with or without a token', () => {
    expect(canKeepPhotoNow()).toBe(true)
  })

  it('holds on a phone with a live token', () => {
    google.redirect = true
    google.token = 'live'

    expect(canKeepPhotoNow()).toBe(true)
  })

  it('does not hold on a phone with none, since asking would leave the page with the photo and the read', () => {
    google.redirect = true

    expect(canKeepPhotoNow()).toBe(false)
  })
})
