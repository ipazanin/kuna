<script setup lang="ts">
import { computed } from 'vue'

import { chatBlocksOf } from '../domain/chatText'

/** A model's text as paragraphs, lists, bold and code. It goes through text interpolation only, so nothing in it becomes a link, a picture or HTML. */
const props = defineProps<{
  text: string
}>()

const blocks = computed(() => chatBlocksOf(props.text))
</script>

<template>
  <div class="flex flex-col gap-2 type-body">
    <template v-for="(block, index) in blocks" :key="index">
      <p v-if="block.kind === 'paragraph'" class="wrap-anywhere">
        <template v-for="(inline, at) in block.inlines" :key="at">
          <strong v-if="inline.kind === 'bold'" class="font-medium">{{ inline.text }}</strong>
          <code v-else-if="inline.kind === 'code'" class="rounded-control bg-elevated px-1 figure">{{ inline.text }}</code>
          <template v-else>{{ inline.text }}</template>
        </template>
      </p>
      <ul v-else class="flex list-disc flex-col gap-1 ps-5">
        <li v-for="(item, itemAt) in block.items" :key="itemAt" class="wrap-anywhere">
          <template v-for="(inline, at) in item" :key="at">
            <strong v-if="inline.kind === 'bold'" class="font-medium">{{ inline.text }}</strong>
            <code v-else-if="inline.kind === 'code'" class="rounded-control bg-elevated px-1 figure">{{ inline.text }}</code>
            <template v-else>{{ inline.text }}</template>
          </template>
        </li>
      </ul>
    </template>
  </div>
</template>
