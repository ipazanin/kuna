import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

import type { Plugin } from 'vite'

/** The apps whose books the real books folder holds, by app id. */
const REAL_BOOKS_APPS: readonly string[] = ['company', 'loans', 'investments', 'assets', 'spending']

/** The files the dev server serves from the real books folder: each app's book, the Investments prices and the rates. */
const REAL_BOOKS_FILES: ReadonlySet<string> = new Set([...REAL_BOOKS_APPS.map((app) => `kuna-${app}.json`), 'kuna-investments-prices.json', 'kuna-rates.json'])

/**
 * What `npm run dev:real` adds to the page's env when KUNA_REAL_SYNC names an app: the fake build's Drive, Google, banks and
 * mail, so a sync runs and its steps show without reaching Google, and the app whose real books go on that fake Drive.
 */
export function realSyncDefine(app: string | undefined): Record<string, string> {
  if (app === undefined || app === '') return {}
  if (!REAL_BOOKS_APPS.includes(app)) throw new Error(`KUNA_REAL_SYNC names no app: ${app}. Use one of ${REAL_BOOKS_APPS.join(', ')}.`)
  return { 'import.meta.env.VITE_FAKE_WORKBOOK': JSON.stringify('true'), 'import.meta.env.VITE_REAL_SYNC': JSON.stringify(app) }
}

/**
 * Serves a copy of real books to `npm run dev:real` at `/kuna/__real-books/<file>`, from the folder KUNA_REAL_BOOKS_DIR names.
 * It answers GET for the known file names only, and never writes. The folder is a scratch copy, never the Drive folder itself.
 * Without the variable every request gets 404, so the apps start on their first run. KUNA_REAL_SYNC adds `realSyncDefine` in
 * that mode only.
 */
export function devRealBooks(): Plugin {
  return {
    name: 'kuna:dev-real-books',
    apply: 'serve',
    config(_, { mode }) {
      return mode === 'real' ? { define: realSyncDefine(process.env.KUNA_REAL_SYNC) } : {}
    },
    configureServer(server) {
      const folder = process.env.KUNA_REAL_BOOKS_DIR
      server.middlewares.use(`${server.config.base}__real-books`, (request, response) => {
        const name = (request.url ?? '').replace(/^\//, '').split('?')[0] ?? ''
        if (request.method !== 'GET') {
          response.statusCode = 405
          response.setHeader('Allow', 'GET')
          response.end()
          return
        }
        if (folder === undefined || !REAL_BOOKS_FILES.has(name)) {
          response.statusCode = 404
          response.end()
          return
        }
        readFile(join(resolve(folder), name), 'utf8').then(
          (text) => {
            response.setHeader('Content-Type', 'application/json; charset=utf-8')
            response.setHeader('Cache-Control', 'no-store')
            response.end(text)
          },
          (failure: NodeJS.ErrnoException) => {
            response.statusCode = failure.code === 'ENOENT' ? 404 : 500
            response.end()
          },
        )
      })
    },
  }
}
