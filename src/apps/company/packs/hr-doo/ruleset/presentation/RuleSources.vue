<script setup lang="ts">
import UIcon from '@nuxt/ui/components/Icon.vue'

import type { SourceView } from './ruleWording'

/** A rule's sources, each once, with the versions that cite it when not all of them do. */
defineProps<{
  sources: readonly SourceView[]
}>()
</script>

<template>
  <section class="flex flex-col gap-1.5" aria-label="Sources">
    <h4 class="text-xs font-medium text-muted">Sources</h4>
    <ul class="flex flex-col gap-1">
      <li v-for="source in sources" :key="source.key">
        <a :href="source.url" target="_blank" rel="noopener noreferrer" class="source-link" data-testid="rule-source">
          <span class="flex items-start gap-1.5">
            <span class="min-w-0 text-sm text-highlighted">
              <span lang="hr">{{ source.act }}</span
              >, {{ source.reference }}
            </span>
            <UIcon name="i-lucide-external-link" class="mt-0.5 size-3.5 shrink-0 text-muted" aria-hidden="true" />
          </span>
          <span class="figure text-xs text-muted">
            <span v-if="source.periods !== null" class="text-toned">For {{ source.periods }}. </span>
            <template v-if="source.issues">{{ source.issues }}. </template>Checked on {{ source.loadedOn }}.
          </span>
          <span class="sr-only">Opens in a new tab.</span>
        </a>
        <blockquote v-if="source.quote" lang="hr" class="mt-1 border-s-2 border-default ps-3 text-xs text-toned italic">{{ source.quote }}</blockquote>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.source-link {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.125rem;
  margin-inline: -0.5rem;
  padding: 0.375rem 0.5rem;
  border-radius: var(--radius-control);
  transition: background-color 120ms ease;
}

.source-link:hover {
  background: var(--surface-elevated);
}

.source-link:hover .text-highlighted {
  text-decoration: underline;
  text-decoration-color: var(--accent);
  text-underline-offset: 3px;
}
</style>
