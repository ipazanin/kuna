<script setup lang="ts">
import { computed } from 'vue'

import type { HoldingsGroup } from '../domain/holdingsList'
import { words } from './words'
import { plural } from '../../../../shared/text/translation'

/** A group's name, a class, a currency, the cash or the sold holdings, with how many holdings it has. */
const props = defineProps<{
  group: HoldingsGroup
}>()

/** A currency is named by its code, which is how the holdings list writes it everywhere else. */
const NAMES: Readonly<Record<string, string>> = { ...words.classes, sold: words.sold, all: words.title }

const name = computed(() => NAMES[props.group.key] ?? props.group.key)
</script>

<template>
  <span>{{ name }}</span>
  <span v-if="group.holdings > 0" class="block type-caption font-normal">{{ plural(words.holdingCount(group.holdings), group.holdings) }}</span>
</template>
