<script setup lang="ts">
import { onMounted, useId, useTemplateRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import UButton from '@nuxt/ui/components/Button.vue'
import UCollapsible from '@nuxt/ui/components/Collapsible.vue'

import type { Navigation } from './navigation'
import NavigationLink from './NavigationLink.vue'
import { words } from './words'

defineProps<{
  navigation: Navigation
}>()

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
  return list.value?.querySelector('[aria-current="page"]') ?? null
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
    <div ref="list" class="min-h-0 flex-1 overflow-y-auto px-3 py-1 [scrollbar-gutter:stable]" @animationend="showCurrentPageOnceOpen">
      <NavigationLink v-if="navigation.netWorth !== null" v-bind="navigation.netWorth" class="mb-1.5" data-testid="nav-net-worth" />
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
              class="min-w-0 flex-1"
              :class="{ 'is-open': app.open }"
              :data-app="app.id"
              data-testid="nav-app-link"
              @click="emit('open', app.id)"
            />
            <UButton
              :icon="app.open ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
              color="neutral"
              variant="ghost"
              size="xs"
              class="shrink-0 justify-center text-muted max-lg:size-11"
              :aria-label="words.navigation.pages(app.name)"
              :aria-expanded="app.open"
              :aria-controls="app.open ? `${id}-${app.id}` : undefined"
              :data-app="app.id"
              data-testid="nav-arrow"
              @click="emit('toggle', app.id)"
            />
          </div>
          <UCollapsible :open="app.open" :ui="{ content: 'overflow-hidden' }">
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
          <NavigationLink v-bind="navigation.addApp" :marks-current="false" data-testid="nav-add-app" @click="showWhereToAddApp" />
        </li>
      </ul>
    </div>
    <div class="mx-3 border-t border-default py-2">
      <NavigationLink v-bind="navigation.kunaSettings" data-testid="nav-kuna-settings" />
    </div>
  </nav>
</template>
