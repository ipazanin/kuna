import type { StatementFile } from '../domain/statementFiles'

/** The files of the statements folder's year folders, or why the path leads to no single folder. */
export type StatementFolderListing =
  | { readonly kind: 'listed'; readonly files: readonly StatementFile[] }
  | { readonly kind: 'refused'; readonly reason: string }

/** The folder the bank's statements are filed in, read only. The app never makes or changes a folder there. */
export interface StatementFolder {
  /** Finds the folder by its path from My Drive, then lists the files in each folder inside it. */
  files(path: readonly string[]): Promise<StatementFolderListing>
  download(file: StatementFile): Promise<ArrayBuffer>
}
