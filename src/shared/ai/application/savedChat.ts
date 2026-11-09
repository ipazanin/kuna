import type { ChatChip } from './chatTools'

/** How long a line stays in this browser, as long as what a provider may keep. */
const KEPT_FOR_MILLISECONDS = 30 * 86_400_000

/** How a card ended, or `open` while it waits. `ended` and `undo-ended` are what a card leaves after a reload. */
export type ProposalState = 'open' | 'done' | 'undone' | 'refused' | 'declined' | 'ended' | 'undo-ended'

/** A card as this browser keeps it: an outcome and nothing to accept. */
export interface SavedProposal {
  readonly id: string
  readonly app: string
  readonly title: string
  readonly count: number
  readonly state: ProposalState
  /** The names of the files the model read in the turn that made the card, absent when none. */
  readonly readFiles?: readonly string[]
}

export interface SavedLine {
  readonly role: 'user' | 'assistant'
  /** When the line was written, in milliseconds. */
  readonly at: number
  /** As typed, or as the model wrote it, aliases and all. */
  readonly text: string
  readonly note: boolean
  readonly chips: readonly ChatChip[]
  readonly strayFigure: boolean
  readonly failure: string | null
  readonly proposals: readonly SavedProposal[]
  /** The names of the files a message went with, absent when none. The files themselves are never kept. */
  readonly attachments?: readonly string[]
}

/** What this browser keeps of a chat. No tool result, no alias map and no ref, so a hostile row does not come back into a later chat. */
export interface SavedChat {
  readonly lines: readonly SavedLine[]
  readonly spent: { readonly dollars: number; readonly unknown: boolean; readonly any: boolean }
}

/** The last write to this browser's chat, so writes land in the order they were made and a Clear is never undone by a save made before it. */
let lastWrite: Promise<void> = Promise.resolve()

function inOrder(write: () => Promise<void>): Promise<void> {
  lastWrite = lastWrite.then(write)
  return lastWrite
}

/** The chat without its lines older than 30 days, or null when none is left. */
function stillKept(chat: SavedChat, now: number): SavedChat | null {
  const lines = chat.lines.filter((line) => now - line.at <= KEPT_FOR_MILLISECONDS)
  return lines.length === 0 ? null : { ...chat, lines }
}

/**
 * The last chat of this browser without its lines older than 30 days, or null when none is left. A private window may
 * deny the storage, and then a chat simply stays in memory, as it does for every failure here. The adapter loads only
 * when a chat is read, saved or forgotten, so Dexie stays out of the first load.
 */
export async function readSavedChat(now = Date.now()): Promise<SavedChat | null> {
  try {
    await lastWrite
    const saved = await (await import('../infrastructure/chatHistory')).storedChat()
    if (saved === null) return null
    const kept = stillKept(saved, now)
    if (kept === null) await forgetSavedChat()
    return kept
  } catch {
    return null
  }
}

/** Keeps the chat without its lines older than 30 days, and forgets it when none is left. */
export function saveChat(chat: SavedChat, now = Date.now()): Promise<void> {
  const kept = stillKept(chat, now)
  if (kept === null) {
    return forgetSavedChat()
  }
  return inOrder(async () => {
    try {
      await (await import('../infrastructure/chatHistory')).storeChat(kept)
    } catch {
      // Storage denied: the chat still holds for this visit.
    }
  })
}

export function forgetSavedChat(): Promise<void> {
  return inOrder(async () => {
    try {
      await (await import('../infrastructure/chatHistory')).deleteStoredChat()
    } catch {
      // Storage denied: nothing was kept.
    }
  })
}
