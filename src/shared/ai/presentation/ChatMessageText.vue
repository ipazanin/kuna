<script setup lang="ts">
import { computed } from 'vue'

import NoteLine from '../../ui/NoteLine.vue'
import type { ShownRefs } from '../domain/chatRefs'
import { chatBlocksOf } from '../domain/chatText'
import type { ChatBlock } from '../domain/chatText'
import { citationChecked, citationSource } from './citationLabel'
import ChatInlines from './ChatInlines.vue'
import { words } from './words'

/**
 * A text of a chat as paragraphs, lists, bold, code and figures. An answer's cited law sections are numbered where it cites
 * them and listed under it, and its lines that start with `>` show apart as the model's own knowledge. It goes through text
 * interpolation only, so nothing in it becomes a link, a picture or HTML.
 */
const props = withDefaults(
  defineProps<{
    text: string
    /** What the refs of a model's answer stand for. A person's own line has none, and reads as it was typed. */
    refs?: ShownRefs | null
  }>(),
  { refs: null },
)

const parts = computed(() => chatBlocksOf(props.text, props.refs !== null))

function citationsIn(part: ChatBlock): readonly string[] {
  const inlines = part.blocks.flatMap((block) => (block.kind === 'paragraph' ? block.inlines : block.items.flat()))
  return inlines.filter((inline) => inline.kind === 'citation').map((inline) => inline.text)
}

/** Each law section the answer cites, once, in the order it first cites it. A ref no tool gave stays out. */
const cited = computed(() => {
  const refs = [...new Set(parts.value.flatMap(citationsIn))]
  return refs.flatMap((ref) => {
    const citation = props.refs?.lawOf(ref) ?? null
    return citation === null ? [] : [{ ref, source: citationSource(citation), checked: citationChecked(citation) }]
  })
})
const citedRefs = computed(() => cited.value.map((citation) => citation.ref))

/** The list of sections follows the last part that cites one, so an aside after it stays below the list. */
const sourcesAfter = computed(() => parts.value.map((part) => citationsIn(part).some((ref) => citedRefs.value.includes(ref))).lastIndexOf(true))
</script>

<template>
  <div class="flex flex-col gap-2 type-body">
    <template v-for="(part, partAt) in parts" :key="partAt">
      <div class="flex flex-col gap-2" :class="part.ownKnowledge ? 'border-s-2 border-default ps-3' : ''" :data-testid="part.ownKnowledge ? 'chat-own-knowledge' : undefined">
        <NoteLine v-if="part.ownKnowledge" tone="muted" icon="i-lucide-message-circle-question-mark">{{ words.answer.ownKnowledge }}</NoteLine>
        <template v-for="(block, index) in part.blocks" :key="index">
          <p v-if="block.kind === 'paragraph'" class="wrap-anywhere"><ChatInlines :inlines="block.inlines" :refs="refs" :cited="citedRefs" /></p>
          <ul v-else class="flex list-disc flex-col gap-1 ps-5">
            <li v-for="(item, itemAt) in block.items" :key="itemAt" class="wrap-anywhere"><ChatInlines :inlines="item" :refs="refs" :cited="citedRefs" /></li>
          </ul>
        </template>
      </div>
      <ol v-if="partAt === sourcesAfter" class="flex flex-col gap-1" :aria-label="words.answer.sources">
        <NoteLine v-for="(citation, at) in cited" :key="citation.ref" as="li" tone="muted" icon="i-lucide-book-open" data-testid="chat-citation">
          {{ at + 1 }}. <span lang="en">{{ citation.source }}</span
          >, <span class="whitespace-nowrap">{{ citation.checked }}</span>
        </NoteLine>
      </ol>
    </template>
  </div>
</template>
