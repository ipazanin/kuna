<script setup lang="ts">
import { computed } from 'vue'
import UBadge from '@nuxt/ui/components/Badge.vue'

import type { LineStatus } from '../../domain/yearEnd/yearEndComparison'
import { STATUS_WORDING } from './yearEndWording'

const props = defineProps<{
  status: LineStatus
}>()

const wording = computed(() => STATUS_WORDING[props.status])
</script>

<template>
  <UBadge
    :label="wording.label"
    :icon="wording.icon"
    :color="wording.color"
    variant="subtle"
    size="sm"
    class="shrink-0"
    :title="wording.meaning"
    :data-status="status"
  />
</template>
