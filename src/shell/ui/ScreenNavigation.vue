<script setup lang="ts">
import { onMounted, useId, useTemplateRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import UButton from '@nuxt/ui/components/Button.vue'
import UCollapsible from '@nuxt/ui/components/Collapsible.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'
import UTooltip from '@nuxt/ui/components/Tooltip.vue'

import { chatOpen, closeChat, openChat } from '../../shared/ai/presentation/chatDock'
import { words as chatWords } from '../../shared/ai/presentation/words'
import type { Navigation } from './navigation'
import NavigationLink from './NavigationLink.vue'
import { words } from './words'

withDefaults(
  defineProps<{
    navigation: Navigation
    /** The icon sidebar: every row an icon, the open app's pages under its tile, and no arrows. */
    rail?: boolean
    /** The top bar's drawer, where an arrow is a finger's 44 px. Beside the page it is 44 px only for a coarse pointer. */
    drawer?: boolean
    /** Whether the chat's row closes the list, which the sidebar shows while a key is kept. The top bar has its own button. */
    chat?: boolean
  }>(),
  { rail: false, chat: false, drawer: false },
)

const emit = defineEmits<{
  /** The arrow on an app's row, which opens or closes its pages without leaving the screen. */
  toggle: [appId: string]
  /** A press on an app's row, whose link stays put when that page is already on screen. */
  open: [appId: string]
}>()

const id = useId()
const route = useRoute()
const list = useTemplateRef<HTMLElement>('list')

/**
 * On the home the row's link stays put, so it moves to where an app is added: the first card that offers Set up, the picked apps' before the others'.
 * Elsewhere the home is not drawn yet and the link does the work.
 */
function showWhereToAddApp(): void {
  document.querySelector<HTMLElement>('[data-testid="home-card"][data-state="set-up"]')?.focus({ focusVisible: true })
}

function currentPage(): Element | null {
  return list.value?.querySelector('.is-active') ?? null
}

function showCurrentPage(): void {
  currentPage()?.scrollIntoView({ block: 'nearest' })
}

/** An app's pages only have their full height once they finish opening. A peek at another app stays where it is. */
function showCurrentPageOnceOpen(event: AnimationEvent): void {
  if (event.target instanceof Element && event.target.contains(currentPage())) showCurrentPage()
}

onMounted(showCurrentPage)
watch(() => route.path, showCurrentPage, { flush: 'post' })
</script>

<template>
  <nav :aria-label="words.navigation.label" class="flex min-h-0 flex-1 flex-col">
    <div ref="list" class="min-h-0 flex-1 overflow-y-auto py-1" :class="rail ? 'px-1.5 [scrollbar-width:none]' : 'px-3 [scrollbar-gutter:stable]'" @animationend="showCurrentPageOnceOpen">
      <NavigationLink v-if="navigation.home !== null" v-bind="navigation.home" :rail="rail" class="mb-0.5" data-testid="nav-home" />
      <NavigationLink v-if="navigation.netWorth !== null" v-bind="navigation.netWorth" :rail="rail" class="mb-1.5" data-testid="nav-net-worth" />
      <ul class="flex flex-col sm:gap-0.5" data-testid="nav-apps">
        <li v-for="app in navigation.apps" :key="app.id" data-testid="nav-app" :data-app="app.id">
          <div class="flex items-center gap-0.5">
            <NavigationLink
              :to="app.to"
              :label="app.name"
              :icon="app.icon"
              :colour="app.colour"
              :count="app.open ? undefined : app.waiting"
              :marks-current="false"
              :rail="rail"
              class="min-w-0 flex-1"
              :class="{ 'is-open': app.open }"
              :data-app="app.id"
              data-testid="nav-app-link"
              @click="emit('open', app.id)"
            />
            <UButton
              v-if="!rail"
              :icon="app.open ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
              color="neutral"
              variant="ghost"
              size="xs"
              class="shrink-0 justify-center text-muted"
              :class="drawer ? 'size-11' : 'pointer-coarse:size-11'"
              :aria-label="words.navigation.pages(app.name)"
              :aria-expanded="app.open"
              :aria-controls="app.open ? `${id}-${app.id}` : undefined"
              :data-app="app.id"
              data-testid="nav-arrow"
              @click="emit('toggle', app.id)"
            />
          </div>
          <ul v-if="rail && app.open" :aria-label="app.name" class="flex flex-col pt-0.5 pb-1 sm:gap-0.5" data-testid="nav-entries">
            <li v-for="entry in app.entries" :key="entry.to">
              <NavigationLink v-bind="entry" rail />
            </li>
          </ul>
          <UCollapsible v-else-if="!rail" :open="app.open" :ui="{ content: 'overflow-hidden' }">
            <template #content>
              <div :id="`${id}-${app.id}`">
                <p v-if="app.subtitle" :id="`${id}-${app.id}-subtitle`" class="truncate ps-11.5 type-caption" data-testid="nav-subtitle">{{ app.subtitle }}</p>
                <ul :aria-label="app.name" :aria-describedby="app.subtitle ? `${id}-${app.id}-subtitle` : undefined" class="flex flex-col pt-0.5 pb-1 sm:gap-0.5" data-testid="nav-entries">
                  <li v-for="entry in app.entries" :key="entry.to">
                    <NavigationLink v-bind="entry" />
                  </li>
                </ul>
              </div>
            </template>
          </UCollapsible>
        </li>
        <li v-if="navigation.addApp !== null">
          <NavigationLink v-bind="navigation.addApp" :marks-current="false" :rail="rail" data-testid="nav-add-app" @click="showWhereToAddApp" />
        </li>
      </ul>
    </div>
    <div class="border-t border-default py-2" :class="rail ? 'mx-1.5' : 'mx-3'">
      <NavigationLink v-bind="navigation.kunaSettings" :rail="rail" data-testid="nav-kuna-settings" />
      <UTooltip v-if="chat" :text="chatWords.chat.open" :disabled="!rail" :content="{ side: 'right' }">
        <button type="button" class="nav-link mt-0.5 w-full" :class="{ 'in-rail': rail }" :aria-pressed="chatOpen" data-testid="chat-open" @click="chatOpen ? closeChat() : openChat()">
          <span class="grid size-6 shrink-0 place-items-center">
            <UIcon name="i-lucide-sparkles" class="size-4" aria-hidden="true" />
          </span>
          <span :class="rail ? 'sr-only' : 'min-w-0 truncate'" data-testid="nav-label">{{ chatWords.chat.open }}</span>
        </button>
      </UTooltip>
    </div>
  </nav>
</template>
