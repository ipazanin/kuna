<script setup lang="ts">
import { computed } from 'vue'
import UModal from '@nuxt/ui/components/Modal.vue'

import { usePhoneLayout } from '../layout/viewport'

/**
 * The frame of every dialog: full screen on a phone and a centred panel from 640 px. Its footer puts
 * a destructive action such as Delete at the start, and Cancel with the primary action at the end.
 */
const open = defineModel<boolean>('open', { required: true })

const props = withDefaults(
  defineProps<{
    title: string
    description?: string | undefined
    /** Narrower or wider than the default 32rem, wider for a body that is a table or a long form. */
    width?: 'md' | 'xl' | '2xl' | '3xl'
    /** False while a step runs that closing the dialog would cut short. */
    dismissible?: boolean
  }>(),
  { dismissible: true },
)

const WIDTHS = { md: 'sm:max-w-md', xl: 'sm:max-w-xl', '2xl': 'sm:max-w-2xl', '3xl': 'sm:max-w-3xl' } as const

const phone = usePhoneLayout()
const ui = computed(() => ({ content: props.width === undefined ? '' : WIDTHS[props.width] }))
</script>

<template>
  <UModal v-model:open="open" :title="title" v-bind="description === undefined ? {} : { description }" :fullscreen="phone" :dismissible="dismissible" :ui="ui">
    <template #body>
      <slot />
    </template>
    <template v-if="$slots.start || $slots.end" #footer>
      <div class="flex w-full flex-wrap items-center gap-2">
        <slot name="start" />
        <div class="ms-auto flex flex-wrap justify-end gap-2">
          <slot name="end" />
        </div>
      </div>
    </template>
  </UModal>
</template>
