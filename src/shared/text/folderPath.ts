/** The folder names of a Drive path such as `work/statements`, from My Drive down, with blank ones and the spaces around each name left out. */
export function folderPathOf(path: string): string[] {
  return path
    .split('/')
    .map((name) => name.trim())
    .filter((name) => name !== '')
}

/** A path of folder names from My Drive as a person reads it, such as `My Drive › work › statements`. */
export function folderTrail(path: readonly string[]): string {
  return ['My Drive', ...path].join(' › ')
}
