<script setup lang="ts">
/** How many rules file under a category or put a label on, as a link to the Rules card showing only those. Nothing while none does. */
import { computed } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import UButton from '@nuxt/ui/components/Button.vue'

import { words } from './words'
import { plural } from '../../../../shared/text/translation'

const props = defineProps<{
  count: number
  /** The category's or label's name, which the link's name for a screen reader holds. */
  name: string
  to: RouteLocationRaw
}>()

const label = computed(() => plural(words.rules.count(props.count), props.count))
</script>

<template>
  <UButton v-if="count > 0" :to="to" :label="label" :aria-label="words.rules.countOf(label, name)" color="neutral" variant="link" size="xs" class="p-0 font-normal" data-testid="spending-rules-link" />
</template>
