/** The folder names of a Drive path such as `work/statements`, from My Drive down, with blank ones and the spaces around each name left out. */
export function folderPathOf(path: string): string[] {
  return path
    .split('/')
    .map((name) => name.trim())
    .filter((name) => name !== '')
}
