/** The data of each event of a server-sent stream as it completes. A last event with no blank line after it was cut off, so it never comes out. */
export async function* serverSentEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let data: string[] = []
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) return
      buffer += decoder.decode(value, { stream: true })
      // A chunk may end between a carriage return and its line feed, which must not read as a blank line.
      const usable = buffer.endsWith('\r') ? buffer.length - 1 : buffer.length
      const lines = buffer.slice(0, usable).split(/\r\n|\n|\r/)
      buffer = `${lines.pop() ?? ''}${buffer.slice(usable)}`
      for (const line of lines) {
        if (line === '') {
          if (data.length > 0) yield data.join('\n')
          data = []
        } else if (line.startsWith('data:')) {
          const value = line.slice('data:'.length)
          data.push(value.startsWith(' ') ? value.slice(1) : value)
        }
      }
    }
  } finally {
    await reader.cancel().catch(() => undefined)
  }
}
