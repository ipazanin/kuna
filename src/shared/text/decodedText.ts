/** A file's text: UTF-8 when it decodes as such, else Windows-1250, which Croatian banks' older exports use. */
export function decodedText(bytes: ArrayBuffer | Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return new TextDecoder('windows-1250').decode(bytes)
  }
}
