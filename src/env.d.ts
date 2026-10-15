/**
 * The build-time environment this app reads. Declaring `strictImportMetaEnv` turns off Vite's
 * `any` index signature, so a misspelled variable is a compile error instead of `undefined`.
 */

interface ViteTypeOptions {
  strictImportMetaEnv: unknown
}

interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID?: string
  readonly VITE_GOOGLE_API_KEY?: string
  readonly VITE_GOOGLE_PROJECT_NUMBER?: string
  /** Set only by `.env.fake`, and absent in every other mode. */
  readonly VITE_FAKE_WORKBOOK?: 'true'
}
