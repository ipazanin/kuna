import { computed, onScopeDispose, ref, watch } from 'vue'
import type { Ref } from 'vue'

/** How long a pointer rests on a cut text, or a finger presses it, before its full text shows. */
export const OPEN_DELAY = 500

/** How far a finger may drift during a long press before it counts as a scroll. */
const PRESS_SLACK = 10

/** A cut text inside one of these shows its full text when the control takes keyboard focus, and a tap opens the control. */
const CONTROLS = 'a[href], button, [role="button"], [role="link"], [role="tab"], summary'

/** Whether the element's text runs past its box, sideways for one line or down for a clamp, by more than a pixel. */
export function isCut(element: HTMLElement): boolean {
  return element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1
}

/** The first cut text inside a control, the only one whose full text shows when the control takes keyboard focus. */
function firstCutIn(control: HTMLElement): HTMLElement | undefined {
  return [...control.querySelectorAll<HTMLElement>('[data-cut-text]')].find(isCut)
}

const measures = new Map<Element, () => void>()
let observer: ResizeObserver | null = null

/** Measures the element again whenever its box changes, through one observer for every cut text on the page. */
function observeSize(element: HTMLElement, measure: () => void): () => void {
  observer ??= new ResizeObserver((entries) => {
    for (const entry of entries) measures.get(entry.target)?.()
  })
  measures.set(element, measure)
  observer.observe(element)
  return () => {
    observer?.unobserve(element)
    measures.delete(element)
  }
}

/**
 * Tracks whether a text is cut and shows its full text while it is: on hover, on keyboard focus of the control that
 * holds it when it is the control's first cut text or of the text itself, and on a long press when no control holds it. A text outside any control is a tab
 * stop only while it is cut.
 */
export function useCutText(element: Readonly<Ref<HTMLElement | null>>) {
  const cut = ref(false)
  const insideControl = ref(false)
  const shown = ref(false)
  const fullText = ref('')
  let control: HTMLElement | null = null
  let timer: ReturnType<typeof setTimeout> | undefined
  let pressedAt: { readonly x: number; readonly y: number } | null = null

  function measure(): void {
    if (element.value !== null) cut.value = isCut(element.value)
  }

  function show(): void {
    measure()
    if (!cut.value || element.value === null) return
    fullText.value = (element.value.textContent ?? '').replace(/\s+/g, ' ').trim()
    shown.value = true
  }

  function wait(): void {
    clearTimeout(timer)
    timer = setTimeout(show, OPEN_DELAY)
  }

  function close(): void {
    clearTimeout(timer)
    pressedAt = null
    shown.value = false
  }

  function pointerEntered(event: PointerEvent): void {
    if (event.pointerType !== 'touch') wait()
  }

  function pointerLeft(event: PointerEvent): void {
    if (event.pointerType !== 'touch') close()
  }

  function pressed(event: PointerEvent): void {
    if (event.pointerType !== 'touch' || insideControl.value) return
    pressedAt = { x: event.clientX, y: event.clientY }
    wait()
  }

  function moved(event: PointerEvent): void {
    if (pressedAt === null || event.pointerType !== 'touch') return
    if (Math.hypot(event.clientX - pressedAt.x, event.clientY - pressedAt.y) > PRESS_SLACK) {
      clearTimeout(timer)
      pressedAt = null
    }
  }

  function released(): void {
    if (pressedAt === null) return
    pressedAt = null
    if (!shown.value) clearTimeout(timer)
  }

  /** A long press on a cut text would otherwise open the browser's own menu over the full text it is showing. */
  function menuAsked(event: Event): void {
    if (cut.value && !insideControl.value) event.preventDefault()
  }

  function focused(event: FocusEvent): void {
    if (!(event.target instanceof HTMLElement) || !event.target.matches(':focus-visible')) return
    if (control !== null && firstCutIn(control) !== element.value) return
    show()
  }

  watch(
    element,
    (now, _before, onCleanup) => {
      if (now === null) return
      control = now.parentElement?.closest<HTMLElement>(CONTROLS) ?? null
      const focusTarget = control ?? now
      insideControl.value = control !== null
      measure()
      const stopObserving = observeSize(now, measure)
      const listeners: readonly (readonly [HTMLElement, string, (event: never) => void])[] = [
        [now, 'pointerenter', pointerEntered],
        [now, 'pointerleave', pointerLeft],
        [now, 'pointerdown', pressed],
        [now, 'pointermove', moved],
        [now, 'pointerup', released],
        [now, 'pointercancel', released],
        [now, 'contextmenu', menuAsked],
        [focusTarget, 'focusin', focused],
        [focusTarget, 'focusout', close],
      ]
      for (const [target, name, listener] of listeners) target.addEventListener(name, listener as EventListener)
      onCleanup(() => {
        close()
        stopObserving()
        for (const [target, name, listener] of listeners) target.removeEventListener(name, listener as EventListener)
      })
    },
    { immediate: true, flush: 'post' },
  )
  onScopeDispose(close)

  return {
    /** True while the text is cut, so its tooltip can open. */
    cut,
    /** True while the text is cut and no control holds it, so the keyboard can reach it. */
    focusable: computed(() => cut.value && !insideControl.value),
    shown,
    fullText,
    measure,
    close,
  }
}
