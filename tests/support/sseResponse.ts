import { readFileSync } from 'node:fs'

/** The text of a server-sent stream written from each event's type and body. */
export function eventsAsStream(events: readonly { readonly type: string; readonly [field: string]: unknown }[]): string {
  return events.map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join('')
}

/** A stream the provider's docs describe, with made-up data, from `tests/fixtures/sse`. */
export function streamFixture(name: string): string {
  return readFileSync(new URL(`../fixtures/sse/${name}.sse`, import.meta.url), 'utf8')
}

/** A 200 answer that delivers the stream in chunks of this many bytes, so an event or a character can fall across two. */
export function streamResponse(stream: string, chunkBytes = 64): Response {
  const bytes = new TextEncoder().encode(stream)
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (let start = 0; start < bytes.length; start += chunkBytes) {
          controller.enqueue(bytes.slice(start, start + chunkBytes))
        }
        controller.close()
      },
    }),
    { status: 200, headers: { 'content-type': 'text/event-stream' } },
  )
}

/** A 200 answer that delivers this much of a stream and then waits, until the signal aborts it the way a browser's fetch does. */
export function streamCutByAbort(stream: string, signal: AbortSignal): Response {
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(stream))
        signal.addEventListener('abort', () => controller.error(signal.reason))
      },
    }),
    { status: 200, headers: { 'content-type': 'text/event-stream' } },
  )
}
