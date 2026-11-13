<script setup lang="ts">
import { computed, inject, ref } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UModal from '@nuxt/ui/components/Modal.vue'

import { usePhoneLayout } from '../layout/viewport'
import { CHANGES_REFUSED } from './changesRefused'

/**
 * The frame of every dialog: full screen on a phone and a centred panel from 640 px. Its footer puts
 * a destructive action such as Delete at the start, and Cancel with the primary action at the end.
 * The panel is a container, so its body and footer ask how wide the dialog is with `@2xl:` and the like.
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
    /** True for a dialog that saves changes. While the app takes none, it opens with the reason at the top of its body, and its own Save stays off. */
    changes?: boolean
  }>(),
  { dismissible: true, changes: false },
)

const WIDTHS = { md: 'sm:max-w-md', xl: 'sm:max-w-xl', '2xl': 'sm:max-w-2xl', '3xl': 'sm:max-w-3xl' } as const

const phone = usePhoneLayout()
const reason = inject(CHANGES_REFUSED, ref(null))
const refusal = computed(() => (props.changes ? reason.value : null))
// A long body must not squeeze the header and footer, which keep their padding while the body scrolls.
const ui = computed(() => ({ content: props.width === undefined ? '@container' : `@container ${WIDTHS[props.width]}`, header: 'shrink-0', footer: 'shrink-0' }))
</script>

<template>
  <UModal v-model:open="open" :title="title" v-bind="description === undefined ? {} : { description }" :fullscreen="phone" :dismissible="dismissible" :ui="ui">
    <template #body>
      <UAlert
        v-if="refusal !== null"
        icon="i-lucide-triangle-alert"
        color="warning"
        variant="subtle"
        role="alert"
        :title="refusal.title"
        :description="refusal.description"
        :actions="[{ label: refusal.reloadLabel, icon: 'i-lucide-refresh-cw', color: 'neutral', variant: 'outline', onClick: refusal.reload }]"
        class="mb-4"
        data-testid="dialog-changes-refused"
      />
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
