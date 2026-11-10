<script setup lang="ts">
import { computed } from 'vue'

import MenuButton from '../../shared/ui/MenuButton.vue'
import type { SidebarChoice } from './sidebarLayout'
import { chooseSidebar, roomEffectOf, sidebarChoice } from './sidebarLayout'
import { words } from './words'

/** The one control that picks the sidebar. An item says what picking it changes, where it changes something. */
const props = defineProps<{
  windowWidth: number
  /** The chat's asked width while it is open, or null. */
  chat: number | null
}>()

const CHOICES: readonly { readonly value: SidebarChoice; readonly label: string; readonly icon: string }[] = [
  { value: 'expanded', label: words.sidebarLayout.expanded, icon: 'i-lucide-panel-left' },
  { value: 'icons', label: words.sidebarLayout.icons, icon: 'i-lucide-panel-left-close' },
  { value: 'hidden', label: words.sidebarLayout.hidden, icon: 'i-lucide-panel-left-dashed' },
]

const inForce = computed(() => CHOICES.find((shown) => shown.value === sidebarChoice.value) ?? CHOICES[0])

const choices = computed(() =>
  CHOICES.map((shown) => {
    const effect = roomEffectOf({ picked: shown.value, inForce: sidebarChoice.value, windowWidth: props.windowWidth, chat: props.chat })
    return effect === null ? shown : { ...shown, description: words.sidebarLayout.effects[effect] }
  }),
)
</script>

<template>
  <MenuButton :label="words.sidebarLayout.name" :icon="inForce.icon" look="icon" :choices="choices" :picked="sidebarChoice" data-testid="sidebar-layout" @pick="chooseSidebar" />
</template>
