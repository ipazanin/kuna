/** A file in the app's hidden folder on Drive. */
export interface HiddenFile {
  readonly id: string
  readonly name: string
}

/** The Drive requests the secrets file needs in the app's hidden folder, which only Kuna sees and nobody can share. */
export interface SecretsDrive {
  /** Every file in the app's hidden folder. */
  files(): Promise<readonly HiddenFile[]>
  /** Makes the file in the app's folder and gives its id. */
  createFile(name: string, text: string): Promise<string>
  download(fileId: string): Promise<string>
  overwrite(fileId: string, text: string): Promise<void>
  /** Deletes the file for good, since Drive keeps no file of the app's folder in the bin. */
  delete(fileId: string): Promise<void>
}
