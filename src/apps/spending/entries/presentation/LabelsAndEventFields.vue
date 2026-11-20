<script setup lang="ts">
import { computed } from 'vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import USelect from '@nuxt/ui/components/Select.vue'

import type { LabelsAndEvents, PartKey } from './useLabelsAndEvents'
import { words } from './words'
import type { EventChoice } from '../../workbook/domain/event'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import LabelsSelect from '../../../../shared/ui/LabelsSelect.vue'

/** The labels and event of an entry or one of its parts, side by side from 640 px. The event shows only once the file has events. */
const labels = defineModel<readonly RecordId[]>('labels', { required: true })
const event = defineModel<EventChoice>('event', { required: true })

const props = defineProps<{
  kit: LabelsAndEvents
  /** The part the fields edit, or null for the entry's own. */
  part: PartKey | null
  /** The category the part is under, which picks the event its day gives it. */
  filedUnder: string | null
  /** What a screen reader calls each field, such as the part it belongs to. */
  labelsName?: string
  eventName?: string
  /** Names each field's test id as `<testid>-labels` and `<testid>-event`. */
  testid: string
}>()

const refused = computed(() => (props.kit.labelRefused.value !== null && props.kit.labelRefused.value.part === props.part ? props.kit.labelRefused.value.text : false))
const eventItems = computed(() => (props.kit.events.value.length > 0 ? props.kit.eventItems(props.filedUnder) : []))
</script>

<template>
  <div class="grid gap-x-3 gap-y-2" :class="{ 'sm:grid-cols-2': eventItems.length > 0 }">
    <UFormField :label="words.dialog.labels" :error="refused">
      <LabelsSelect
        v-model="labels"
        :labels="kit.labelChoices.value"
        :name="labelsName ?? words.dialog.labels"
        class="w-full"
        :data-testid="`${testid}-labels`"
        @create="labels = kit.withTyped(labels, $event, part)"
      />
    </UFormField>
    <UFormField v-if="eventItems.length > 0" :label="words.dialog.event">
      <USelect v-model="event" :items="eventItems" :aria-label="eventName" class="w-full" :data-testid="`${testid}-event`" />
    </UFormField>
  </div>
</template>
