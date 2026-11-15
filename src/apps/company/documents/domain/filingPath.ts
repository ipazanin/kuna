/** The folders under a filing folder, outermost first, and the file's name in the last of them. */
export interface FilingPath {
  readonly folders: readonly string[]
  readonly fileName: string
}

/** The path as a person reads it, such as 2026/2026-10/2026-10-acme-invoice.pdf. */
export function pathInWords(path: FilingPath): string {
  return [...path.folders, path.fileName].join('/')
}
