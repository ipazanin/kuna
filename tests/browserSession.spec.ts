import { TimeoutError } from 'puppeteer-core'
import { describe, expect, it } from 'vitest'

import { BROWSER_CONNECTION_CLOSED, withBrowser } from '../scripts/support/browsers.mjs'

interface FakeContext {
  close: () => Promise<void>
}

interface FakeBrowser {
  name: string
  connected: boolean
  closed: boolean
  close: () => Promise<void>
  process: () => null
}

interface FakeSession {
  browser: FakeBrowser
  closeContext: (context: FakeContext) => Promise<string | null>
}

type Launcher = NonNullable<Parameters<typeof withBrowser>[2]>

/** A fake Chrome whose first launches fail with `failures`, in order, before the launches that start a browser. */
function fakeChrome(failures: Error[] = []) {
  const launched: FakeBrowser[] = []
  const launchBrowser = () => {
    const failure = failures.shift()
    if (failure !== undefined) return Promise.reject(failure)
    const browser: FakeBrowser = {
      name: `chrome ${launched.length + 1}`,
      connected: true,
      closed: false,
      close: async () => {
        browser.closed = true
      },
      process: () => null,
    }
    launched.push(browser)
    return Promise.resolve(browser)
  }
  // The fakes carry only what withBrowser reads of puppeteer's browser, so the launcher is cast to puppeteer's.
  const run = <T>(check: (session: FakeSession) => Promise<T>): Promise<T> => withBrowser({}, check, launchBrowser as unknown as Launcher)
  return { launched, run }
}

const closing: FakeContext = { close: () => Promise.resolve() }
const droppedConnection: FakeContext = { close: () => Promise.reject(new Error('Protocol error: Connection closed.')) }

describe('the browser session of a check', () => {
  it('launches once more when Chrome does not start in time', async () => {
    const chrome = fakeChrome([new TimeoutError('Timed out after 30000 ms while waiting for the WS endpoint URL to appear in stdout!')])

    const used = await chrome.run((session) => Promise.resolve(session.browser.name))

    expect(used).toBe('chrome 1')
  })

  it('fails when Chrome does not start in time twice, or fails to start for another reason', async () => {
    const timedOut = () => new TimeoutError('Timed out after 30000 ms while waiting for the WS endpoint URL to appear in stdout!')

    await expect(fakeChrome([timedOut(), timedOut()]).run(() => Promise.resolve(null))).rejects.toThrow('Timed out')
    await expect(fakeChrome([new Error('Failed to launch the browser process')]).run(() => Promise.resolve(null))).rejects.toThrow('Failed to launch')
  })

  it('closes a context and keeps the browser when Chrome stays connected', async () => {
    const chrome = fakeChrome()

    const lost = await chrome.run((session) => session.closeContext(closing))

    expect(lost).toBeNull()
    expect(chrome.launched.map((browser) => browser.name)).toEqual(['chrome 1'])
  })

  it('says the connection closed and goes on with a new browser when the close rejects', async () => {
    const chrome = fakeChrome()

    const seen = await chrome.run(async (session) => {
      const lost = await session.closeContext(droppedConnection)
      return { lost, after: session.browser.name }
    })

    expect(seen).toEqual({ lost: BROWSER_CONNECTION_CLOSED, after: 'chrome 2' })
    expect(chrome.launched.every((browser) => browser.closed)).toBe(true)
  })

  it('goes on with a new browser when a close resolves but Chrome has disconnected', async () => {
    const chrome = fakeChrome()

    const seen = await chrome.run(async (session) => {
      session.browser.connected = false
      const lost = await session.closeContext(closing)
      return { lost, after: session.browser.name }
    })

    expect(seen).toEqual({ lost: BROWSER_CONNECTION_CLOSED, after: 'chrome 2' })
  })

  it('launches one new browser for contexts whose closes reject together', async () => {
    const chrome = fakeChrome()

    const lost = await chrome.run((session) => Promise.all([1, 2, 3, 4].map(() => session.closeContext(droppedConnection))))

    expect(lost).toEqual(Array(4).fill(BROWSER_CONNECTION_CLOSED))
    expect(chrome.launched.map((browser) => browser.name)).toEqual(['chrome 1', 'chrome 2'])
  })
})
