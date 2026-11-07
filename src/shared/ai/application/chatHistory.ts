import Dexie from 'dexie'
import type { EntityTable } from 'dexie'

import type { ChatChip } from './chatTools'

/** How long a chat stays in this browser, as long as what a provider may keep. */
const CHAT_HISTORY_DAYS = 30
const DAY = 86_400_000
const CHAT_KEY = 'last'

/** How a card ended, or `open` while it waits. `ended` and `undo-ended` are what a card leaves after a reload. */
export type ProposalState = 'open' | 'done' | 'undone' | 'refused' | 'declined' | 'ended' | 'undo-ended'

/** A card as this browser keeps it: an outcome and nothing to accept. */
export interface SavedProposal {
  readonly id: string
  readonly app: string
  readonly title: string
  readonly count: number
  readonly state: ProposalState
}

export interface SavedLine {
  readonly role: 'user' | 'assistant'
  /** As typed, or as the model wrote it, aliases and all. */
  readonly text: string
  readonly note: boolean
  readonly chips: readonly ChatChip[]
  readonly strayFigure: boolean
  readonly failure: string | null
  readonly proposals: readonly SavedProposal[]
}

/** What this browser keeps of a chat. No tool result, no alias map and no ref, so a hostile row does not come back into a later chat. */
export interface SavedChat {
  readonly savedAt: number
  readonly lines: readonly SavedLine[]
  readonly spent: { readonly dollars: number; readonly unknown: boolean; readonly any: boolean }
}

type ChatDatabase = Dexie & { chat: EntityTable<SavedChat & { readonly key: string }, 'key'> }

let database: ChatDatabase | null = null

function chatDatabase(): ChatDatabase {
  if (database === null) {
    database = new Dexie('kuna-chat') as ChatDatabase
    database.version(1).stores({ chat: 'key' })
  }
  return database
}

/**
 * The last chat of this browser, or null when there is none or it is older than it may stay. A private window may deny
 * the storage, and then a chat simply stays in memory, as it does for every failure here.
 */
export async function readSavedChat(now = Date.now()): Promise<SavedChat | null> {
  try {
    const saved = await chatDatabase().chat.get(CHAT_KEY)
    if (saved === undefined) return null
    if (now - saved.savedAt > CHAT_HISTORY_DAYS * DAY) {
      await forgetSavedChat()
      return null
    }
    return saved
  } catch {
    return null
  }
}

export async function saveChat(chat: SavedChat): Promise<void> {
  try {
    await chatDatabase().chat.put({ key: CHAT_KEY, ...(JSON.parse(JSON.stringify(chat)) as SavedChat) })
  } catch {
    // Storage denied: the chat still holds for this visit.
  }
}

export async function forgetSavedChat(): Promise<void> {
  try {
    await chatDatabase().chat.delete(CHAT_KEY)
  } catch {
    // Storage denied: nothing was kept.
  }
}
