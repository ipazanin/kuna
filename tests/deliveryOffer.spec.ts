// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { describe, expect, it, vi } from 'vitest'

import { useDeliveryOffer } from '../src/apps/company/onboarding/presentation/useDeliveryOffer'

const leavesForGoogle = vi.hoisted(() => ({ now: true }))

vi.mock('../src/shared/google/withGoogleAccess', () => ({
  withGoogleAccess: async (_scopes: unknown, action: () => Promise<unknown>) => {
    if (leavesForGoogle.now) return new Promise(() => {})
    return action()
  },
}))

describe('the delivery offer', () => {
  it('opens its dialog only once Google has answered, so a phone that leaves has nothing typed to lose', async () => {
    const offer = useDeliveryOffer()

    void offer.open()
    await Promise.resolve()
    expect(offer.opened.value).toBe(false)

    leavesForGoogle.now = false
    await offer.open()
    expect(offer.opened.value).toBe(true)
  })
})
