import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

import type { Plugin } from 'vite'

/** The files the dev server serves from the real books folder: each app's book, the Investments prices and the rates. */
const REAL_BOOKS_FILES: ReadonlySet<string> = new Set([
  'kuna-company.json',
  'kuna-loans.json',
  'kuna-investments.json',
  'kuna-investments-prices.json',
  'kuna-assets.json',
  'kuna-spending.json',
  'kuna-rates.json',
])

/**
 * Serves a copy of real books to `npm run dev:real` at `/kuna/__real-books/<file>`, from the folder KUNA_REAL_BOOKS_DIR names.
 * It answers GET for the known file names only, and never writes. The folder is a scratch copy, never the Drive folder itself.
 * Without the variable every request gets 404, so the apps start on their first run.
 */
export function devRealBooks(): Plugin {
  return {
    name: 'kuna:dev-real-books',
    apply: 'serve',
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
