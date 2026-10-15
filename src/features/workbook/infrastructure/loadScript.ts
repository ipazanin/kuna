const loading = new Map<string, Promise<void>>()

/** Adds a third-party script once per page. Google's GIS and Picker libraries cannot be bundled. */
export function loadScript(src: string): Promise<void> {
  const pending = loading.get(src)
  if (pending !== undefined) {
    return pending
  }
  const loaded = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.addEventListener('load', () => resolve())
    script.addEventListener('error', () => {
      loading.delete(src)
      script.remove()
      reject(new Error(`Could not load ${src}. A content blocker or the network may have stopped it.`))
    })
    document.head.append(script)
  })
  loading.set(src, loaded)
  return loaded
}
