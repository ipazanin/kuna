<script setup lang="ts">
import type { ExposureMix } from '../domain/exposure'
import type { HoldingFigures } from '../domain/holding'
import { holdingLink } from './holdingLinks'
import { words } from './words'
import { plural } from '../../../../shared/text/translation'
import DrillLink from '../../../../shared/ui/DrillLink.vue'

/** How many holdings wait for a sector or a country, with a link to the largest of them. */
defineProps<{
  mix: ExposureMix
  /** Largest first. */
  missing: readonly HoldingFigures[]
}>()
</script>

<template>
  <p v-if="missing[0] !== undefined" class="text-xs text-muted" data-testid="mix-missing">
    {{ plural(words.mixes.missing[mix](missing.length), missing.length) }}
    <DrillLink :to="holdingLink(missing[0].instrument)" in-prose>{{ missing[0].instrument.name }}</DrillLink
    >.
  </p>
</template>
