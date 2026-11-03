<script setup lang="ts">
import { computed } from 'vue'

import type { HoldingsGroup } from '../domain/holdingsList'
import { groupCount } from './holdingText'
import { words } from './words'

/** A group's name, a class, a currency or the cash, with how many holdings and cash balances it lists. */
const props = defineProps<{
  group: HoldingsGroup
}>()

/** A currency is named by its code, which is how the holdings list writes it everywhere else. */
const NAMES: Readonly<Record<string, string>> = { ...words.classes, all: words.title }

const name = computed(() => NAMES[props.group.key] ?? props.group.key)
</script>

<template>
  <span>{{ name }}</span>
  <span class="block type-caption font-normal">{{ groupCount(group) }}</span>
</template>
