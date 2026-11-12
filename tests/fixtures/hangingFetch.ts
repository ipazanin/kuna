import { vi } from 'vitest'

/**
 * A Google that never answers: each request waits until its timeout signal fires, which the test does with `giveUp`, since a
 * real wait of minutes cannot run in a spec. `waits` holds the wait each request asked for, in order.
 */
export function hangingFetch(): { readonly waits: number[]; readonly giveUp: () => void } {
  const waits: number[] = []
  const controllers: AbortController[] = []
  vi.spyOn(AbortSignal, 'timeout').mockImplementation((milliseconds) => {
    waits.push(milliseconds)
    const controller = new AbortController()
    controllers.push(controller)
    return controller.signal
  })
  vi.stubGlobal(
    'fetch',
    vi.fn(
      (_input: string, init: RequestInit = {}) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(init.signal?.reason))
        }),
    ),
  )
  return { waits, giveUp: () => controllers.forEach((controller) => controller.abort(new DOMException('signal timed out', 'TimeoutError'))) }
}
