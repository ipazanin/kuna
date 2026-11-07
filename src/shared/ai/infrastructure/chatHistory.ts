import Dexie from 'dexie'
import type { EntityTable } from 'dexie'

import type { SavedChat } from '../application/savedChat'

const CHAT_KEY = 'last'

type ChatDatabase = Dexie & { chat: EntityTable<SavedChat & { readonly key: string }, 'key'> }

let database: ChatDatabase | null = null

function chatDatabase(): ChatDatabase {
  if (database === null) {
    database = new Dexie('kuna-chat') as ChatDatabase
    database.version(1).stores({ chat: 'key' })
  }
  return database
}

export async function storedChat(): Promise<SavedChat | null> {
  return (await chatDatabase().chat.get(CHAT_KEY)) ?? null
}

/** Stores a plain copy, as IndexedDB cannot clone what Vue made reactive. */
export async function storeChat(chat: SavedChat): Promise<void> {
  await chatDatabase().chat.put({ key: CHAT_KEY, ...(JSON.parse(JSON.stringify(chat)) as SavedChat) })
}

export async function deleteStoredChat(): Promise<void> {
  await chatDatabase().chat.delete(CHAT_KEY)
}
