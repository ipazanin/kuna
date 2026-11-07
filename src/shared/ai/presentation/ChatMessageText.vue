<script setup lang="ts">
import { computed } from 'vue'

import type { ChatFigure } from '../domain/chatRefs'
import { chatBlocksOf } from '../domain/chatText'
import ChatInlines from './ChatInlines.vue'

/** A model's text as paragraphs, lists, bold, code and figures. It goes through text interpolation only, so nothing in it becomes a link, a picture or HTML. */
const props = withDefaults(
  defineProps<{
    text: string
    /** Kuna's own figure behind a ref. A person's own line names none. */
    figure?: (ref: string) => ChatFigure | null
  }>(),
  { figure: () => null },
)

const blocks = computed(() => chatBlocksOf(props.text))
</script>

<template>
  <div class="flex flex-col gap-2 type-body">
    <template v-for="(block, index) in blocks" :key="index">
      <p v-if="block.kind === 'paragraph'" class="wrap-anywhere"><ChatInlines :inlines="block.inlines" :figure="figure" /></p>
      <ul v-else class="flex list-disc flex-col gap-1 ps-5">
        <li v-for="(item, itemAt) in block.items" :key="itemAt" class="wrap-anywhere"><ChatInlines :inlines="item" :figure="figure" /></li>
      </ul>
    </template>
  </div>
</template>
