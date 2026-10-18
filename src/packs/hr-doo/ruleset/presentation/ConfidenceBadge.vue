<script setup lang="ts">
import { computed } from 'vue'
import UBadge from '@nuxt/ui/components/Badge.vue'

import type { Confidence } from '../schema'
import { CONFIDENCE_WORDING } from './ruleWording'

const props = defineProps<{
  confidence: Confidence
}>()

const wording = computed(() => CONFIDENCE_WORDING[props.confidence])
</script>

<template>
  <UBadge
    :label="wording.label"
    :icon="wording.icon"
    :color="wording.color"
    :variant="wording.variant"
    size="sm"
    class="shrink-0"
    :title="wording.meaning"
    :data-confidence="confidence"
  />
</template>
