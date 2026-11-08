export interface AiTextPart {
  readonly kind: 'text'
  readonly text: string
}

/** A PDF as it is sent. `name` reaches the provider, so it is the attachment's id, such as `a2`, and never the file's own name. */
export interface AiPdfPart {
  readonly kind: 'pdf'
  readonly base64: string
  readonly name: string
}

/** A photo as it is sent, with the size it is sent at, which the request's token count reads. */
export interface AiImagePart {
  readonly kind: 'image'
  readonly base64: string
  readonly mediaType: 'image/jpeg'
  readonly width: number
  readonly height: number
}

/** One part of what is sent: text Kuna built, which is masked, or a whole document or photo, which cannot be. */
export type AiPart = AiTextPart | AiPdfPart | AiImagePart
