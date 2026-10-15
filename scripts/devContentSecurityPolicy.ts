import type { Plugin } from 'vite'

/**
 * The dev server talks to the page over a WebSocket for hot reload, which the production policy in
 * index.html does not allow. This widens the policy for `vite` only, so the spike still runs
 * against the production script, style, frame and connect sources.
 */
const DEV_ONLY_SOURCES: Readonly<Record<string, readonly string[]>> = {
  'connect-src': ['ws://localhost:*'],
}

const POLICY_META = /(<meta\s+http-equiv="Content-Security-Policy"\s+content=")([^"]*)(")/

export function devContentSecurityPolicy(): Plugin {
  return {
    name: 'ledgerboard:dev-content-security-policy',
    apply: 'serve',
    transformIndexHtml(html) {
      if (!POLICY_META.test(html)) {
        throw new Error('index.html has no Content-Security-Policy meta tag to widen for the dev server.')
      }
      return html.replace(POLICY_META, (_match, head: string, policy: string, tail: string) => {
        return `${head}${widenPolicy(policy)}${tail}`
      })
    },
  }
}

function widenPolicy(policy: string): string {
  return policy
    .split(';')
    .map((directive) => directive.trim())
    .filter((directive) => directive.length > 0)
    .map((directive) => {
      const name = directive.split(/\s+/)[0] ?? ''
      const extra = DEV_ONLY_SOURCES[name]
      return extra === undefined ? directive : `${directive} ${extra.join(' ')}`
    })
    .join('; ')
}
