/** The workbook document as text, as its home held it at one revision. */
export interface StoredDocument {
  readonly revision: string
  readonly text: string
}

/** A write run again on the text of another device's save: the text it now makes, or why its change no longer holds there. */
export type Rewrite = { readonly kind: 'rewritten'; readonly text: string } | { readonly kind: 'refused'; readonly reason: string }

/** How a save ended. */
export type DocumentSave =
  /** The home holds `document`: the text given, or what the write made of another device's save that landed at the same moment. */
  | { readonly kind: 'saved'; readonly document: StoredDocument }
  /** The document moved since the base, and nothing was stored, so the write starts again from a fresh read. */
  | { readonly kind: 'moved' }
  /** Another device saved at the same moment and the write no longer holds on its text. That save stands as it was, and nothing of this one is kept. */
  | { readonly kind: 'refused'; readonly reason: string }

/** Where the workbook document is kept: a file on Drive, or this browser. */
export interface DocumentHome {
  /** The document now. While the home still stands at the revision of `cached`, gives back `cached` itself with nothing downloaded. */
  read(cached: StoredDocument | null): Promise<StoredDocument>
  /**
   * Stores `text` in place of `base`, the document the write was worked out on. When another
   * device's save landed at the same moment and stands, `rewrite` runs the write again on that
   * save's text. Throws when the save may have reached the home and then failed, so the caller
   * reads again.
   */
  save(base: StoredDocument, text: string, rewrite: (other: string) => Promise<Rewrite>): Promise<DocumentSave>
}
