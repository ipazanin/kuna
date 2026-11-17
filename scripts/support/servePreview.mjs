import { preview } from 'vite'

/** The builds a check can serve itself, by the name `--serve` takes. */
const BUILDS = { fake: 'dist-fake' }

/** Whether `--serve` names a build a check can serve. */
export function servableBuild(name) {
  return Object.hasOwn(BUILDS, name)
}

/**
 * Serves the named build with `vite preview` on a free port and answers its address and how to stop it. The server runs
 * inside this process, so it goes with the process when a run fails or is stopped, and a run that ends normally stops it in
 * its `finally`.
 */
export async function servePreview(name) {
  const server = await preview({ logLevel: 'warn', build: { outDir: BUILDS[name] }, preview: { host: '127.0.0.1', port: 0 } })
  return { base: server.resolvedUrls.local[0], stop: () => server.close() }
}
