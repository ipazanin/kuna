export interface GoogleConfig {
  readonly clientId: string
  readonly apiKey: string
  readonly projectNumber: string
}

/**
 * Read on first use rather than at import, so screens that never talk to Google still load
 * when the variables are absent, as in fake mode.
 */
export function googleConfig(): GoogleConfig {
  return {
    clientId: required('VITE_GOOGLE_CLIENT_ID', import.meta.env.VITE_GOOGLE_CLIENT_ID),
    apiKey: required('VITE_GOOGLE_API_KEY', import.meta.env.VITE_GOOGLE_API_KEY),
    projectNumber: required('VITE_GOOGLE_PROJECT_NUMBER', import.meta.env.VITE_GOOGLE_PROJECT_NUMBER),
  }
}

function required(name: string, configured: string | undefined): string {
  const trimmed = configured?.trim() ?? ''
  if (trimmed === '') {
    throw new Error(
      `${name} is not set. Put it in .env.local for development, or in the repository's Actions variables for a deployed build.`,
    )
  }
  return trimmed
}
