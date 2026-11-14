<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import UCommandPalette from '@nuxt/ui/components/CommandPalette.vue'
import { defineShortcuts } from '@nuxt/ui/composables/defineShortcuts'

import { openChat } from '../../shared/ai/presentation/chatDock'
import { usePhoneLayout } from '../../shared/layout/viewport'
import AppDialog from '../../shared/ui/AppDialog.vue'
import type { Navigation, NavigationEntry } from './navigation'
import { words } from './words'

/** Every page of the menu in one searchable list, opened with Cmd+K or Ctrl+K. Records such as a loan or a holding stay out. */
const props = defineProps<{
  navigation: Navigation
  /** Whether the chat can open, which needs a key, so the list offers it first. */
  chatAvailable: boolean
}>()

const open = defineModel<boolean>('open', { required: true })

const router = useRouter()
const phone = usePhoneLayout()

function jumpTo(to: string): void {
  open.value = false
  void router.push(to)
}

function rowOf(entry: NavigationEntry, keywords: readonly string[] = []) {
  return { label: entry.label, icon: entry.icon, keywords: [...keywords], onSelect: () => jumpTo(entry.to) }
}

const groups = computed(() => {
  const { home, netWorth, apps, kunaSettings } = props.navigation
  const chat = props.chatAvailable
    ? [
        {
          label: words.quickJump.openChat,
          icon: 'i-lucide-sparkles',
          keywords: [],
          onSelect: () => {
            open.value = false
            openChat()
          },
        },
      ]
    : []
  const kuna = [...chat, ...[home, netWorth].filter((entry) => entry !== null).map((entry) => rowOf(entry)), rowOf(kunaSettings)]
  return [
    { id: 'kuna', label: words.quickJump.kuna, items: kuna.map((row) => ({ ...row, keywords: [...row.keywords, words.quickJump.kuna] })) },
    ...apps.map((app) => ({ id: app.id, label: app.name, items: app.entries.map((entry) => rowOf(entry, [app.name])) })),
  ]
})

/** Takes the key from a field too, where Firefox would otherwise move to its search bar. Another dialog, a drawer and a phone keep it. A popover does not. */
defineShortcuts({
  meta_k: {
    usingInput: true,
    handler: () => {
      if (phone.value) return
      // Reka sets no aria-modal, so a dialog or a drawer is told from a popover by the title its Dialog names.
      if (!open.value && document.querySelector('[role="dialog"][aria-labelledby^="reka-dialog-title"]') !== null) return
      open.value = !open.value
    },
  },
})
</script>

<template>
  <AppDialog v-model:open="open" :title="words.quickJump.title">
    <UCommandPalette :groups="groups" :placeholder="words.quickJump.placeholder" :fuse="{ fuseOptions: { keys: ['keywords'], useTokenSearch: true, tokenMatch: 'all' } }" data-testid="quick-jump">
      <template #empty>
        <p class="type-caption">{{ words.quickJump.nothing }}</p>
      </template>
    </UCommandPalette>
  </AppDialog>
</template>
