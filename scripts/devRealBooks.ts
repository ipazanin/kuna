import { readFile, stat } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'

import type { Logger, Plugin } from 'vite'

/** The apps whose books the real books folder holds, by app id. */
const REAL_BOOKS_APPS: readonly string[] = ['company', 'loans', 'investments', 'assets', 'spending']

/**
 * The files the dev server serves from the real books folder, each with the app folder the Drive keeps it in: an app's book and
 * the Investments prices in the app's folder, the rates at the top of the Kuna folder.
 */
const REAL_BOOKS_FILES: ReadonlyMap<string, string | null> = new Map([
  ...REAL_BOOKS_APPS.map((app) => [`kuna-${app}.json`, app] as const),
  ['kuna-investments-prices.json', 'investments'],
  ['kuna-rates.json', null],
])

async function isFile(path: string): Promise<boolean> {
  return stat(path).then(
    (found) => found.isFile(),
    () => false,
  )
}

/**
 * Where the real books folder holds the file: at its top, as a flat copy keeps it, or else in its app's folder, as the Drive
 * does. Null when the folder holds neither or the name is no real books file.
 */
export async function realBooksPath(folder: string, name: string): Promise<string | null> {
  if (!REAL_BOOKS_FILES.has(name)) return null
  const appFolder = REAL_BOOKS_FILES.get(name) ?? null
  const places = appFolder === null ? [join(folder, name)] : [join(folder, name), join(folder, appFolder, name)]
  for (const place of places) {
    if (await isFile(place)) return place
  }
  return null
}

/** Names each file the folder holds and where, and each it lacks, without reading any of them. */
async function logRealBooks(folder: string, logger: Logger): Promise<void> {
  const lines = await Promise.all(
    [...REAL_BOOKS_FILES.keys()].map(async (name) => {
      const path = await realBooksPath(folder, name)
      return `  ${name}: ${path === null ? 'missing' : relative(folder, path)}`
    }),
  )
  logger.info(`Real books in ${folder}:\n${lines.join('\n')}`)
}

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
 * Serves a copy of real books to `npm run dev:real` at `/kuna/__real-books/<file>`, from the folder KUNA_REAL_BOOKS_DIR names,
 * and names at startup which files it found there. It answers GET for the known file names only, and never writes. The folder
 * is a scratch copy, never the Drive folder itself. Without the variable every request gets 404, so the apps start on their
 * first run. KUNA_REAL_SYNC adds `realSyncDefine` in that mode only.
 */
export function devRealBooks(): Plugin {
  return {
    name: 'kuna:dev-real-books',
    apply: 'serve',
    config(_, { mode }) {
      return mode === 'real' ? { define: realSyncDefine(process.env.KUNA_REAL_SYNC) } : {}
    },
    configureServer(server) {
      const variable = process.env.KUNA_REAL_BOOKS_DIR
      const folder = variable === undefined ? undefined : resolve(variable)
      const logger = server.config.logger
      if (folder !== undefined) {
        logRealBooks(folder, logger).catch((failure: unknown) => logger.error(`Could not look through ${folder}: ${String(failure)}`))
      } else if (server.config.mode === 'real') {
        logger.warn('KUNA_REAL_BOOKS_DIR is not set, so every app starts on its first run.')
      }
      server.middlewares.use(`${server.config.base}__real-books`, (request, response) => {
        const name = (request.url ?? '').replace(/^\//, '').split('?')[0] ?? ''
        if (request.method !== 'GET') {
          response.statusCode = 405
          response.setHeader('Allow', 'GET')
          response.end()
          return
        }
        const notFound = (): void => {
          response.statusCode = 404
          response.end()
        }
        if (folder === undefined) {
          notFound()
          return
        }
        realBooksPath(folder, name)
          .then((path) => (path === null ? null : readFile(path, 'utf8')))
          .then(
            (text) => {
              if (text === null) {
                notFound()
                return
              }
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
