<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import UApp from '@nuxt/ui/components/App.vue'

import { SCREENS } from './shared/routing/screens'
</script>

<template>
  <UApp>
    <div class="min-h-dvh lg:flex">
      <header class="border-b border-default lg:w-56 lg:shrink-0 lg:border-r lg:border-b-0">
        <div class="px-4 pt-4 pb-2 lg:py-6">
          <span class="text-lg font-semibold tracking-tight text-highlighted">Ledgerboard</span>
        </div>
        <nav aria-label="Screens" class="overflow-x-auto px-2 pb-2 lg:overflow-visible">
          <ul class="flex gap-1 lg:flex-col">
            <li v-for="screen in SCREENS" :key="screen.path">
              <RouterLink
                :to="screen.path"
                class="block whitespace-nowrap rounded-md px-3 py-2 text-sm text-muted hover:bg-elevated hover:text-highlighted"
                active-class="bg-elevated text-highlighted"
                exact-active-class="bg-elevated text-highlighted"
              >
                {{ screen.title }}
              </RouterLink>
            </li>
          </ul>
        </nav>
      </header>
      <main class="min-w-0 flex-1 px-4 py-6 lg:px-8">
        <RouterView />
      </main>
    </div>
  </UApp>
</template>
