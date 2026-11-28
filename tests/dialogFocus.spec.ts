// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'

import { focusNearest, focusPathOf } from '../src/shared/ui/dialogFocus'

afterEach(() => {
  document.body.innerHTML = ''
})

/** A card of two rows, each with an earlier and a later arrow, as the Rules card has. */
function rulesCard(): HTMLElement {
  document.body.innerHTML = `
    <section data-testid="card">
      <button data-testid="add">Add</button>
      <ol>
        <li data-testid="first"><span>first</span><div><button data-testid="first-up">Earlier</button><button data-testid="first-down">Later</button></div></li>
        <li data-testid="second"><span>second</span><div><button data-testid="second-up">Earlier</button><button data-testid="second-down">Later</button></div></li>
      </ol>
    </section>`
  return document.querySelector('[data-testid="card"]')!
}

function byTestId(testId: string): HTMLElement {
  return document.querySelector<HTMLElement>(`[data-testid="${testId}"]`)!
}

describe('focus after a dialog closes', () => {
  it('goes back to the opener while it can still take focus', () => {
    rulesCard()
    const path = focusPathOf(byTestId('second-up'))

    expect(focusNearest(path)).toBe(true)
    expect(document.activeElement).toBe(byTestId('second-up'))
  })

  it('goes to the other arrow of the row once the opener went disabled', () => {
    rulesCard()
    const path = focusPathOf(byTestId('second-up'))
    byTestId('second-up').setAttribute('disabled', '')

    expect(focusNearest(path)).toBe(true)
    expect(document.activeElement).toBe(byTestId('second-down'))
  })

  it('goes to the first enabled control of the list once the opener row left the page', () => {
    rulesCard()
    const path = focusPathOf(byTestId('second-up'))
    byTestId('second').remove()

    expect(focusNearest(path)).toBe(true)
    expect(document.activeElement).toBe(byTestId('first-up'))
  })

  it('skips a disabled control on the way out to the card', () => {
    rulesCard()
    const path = focusPathOf(byTestId('second-up'))
    byTestId('first').remove()
    for (const arrow of ['second-up', 'second-down']) byTestId(arrow).setAttribute('disabled', '')

    expect(focusNearest(path)).toBe(true)
    expect(document.activeElement).toBe(byTestId('add'))
  })

  it('leaves focus alone when nothing around the opener can take it', () => {
    document.body.innerHTML = '<div><button data-testid="only" disabled>Only</button></div>'

    expect(focusNearest(focusPathOf(byTestId('only')))).toBe(false)
    expect(document.activeElement).toBe(document.body)
  })

  it('has no path when the body held focus', () => {
    expect(focusPathOf(document.body)).toEqual([])
  })
})
