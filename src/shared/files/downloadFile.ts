/**
 * Hands the browser a file to save. The link is attached while it is clicked and the object URL
 * revoked a moment later, which every browser this app supports accepts.
 */
export function downloadFile(contents: BlobPart, fileName: string, type: string): void {
  const link = document.createElement('a')
  link.href = URL.createObjectURL(new Blob([contents], { type }))
  link.download = fileName
  link.hidden = true
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(link.href), 1000)
}
