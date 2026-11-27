import { globSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { parse } from '@vue/compiler-sfc'
import type { ElementNode, RootNode, TemplateChildNode } from '@vue/compiler-dom'
import { describe, expect, it } from 'vitest'

import { elementsOf, propText } from './support/templateElements'

const ELEMENT = 1
const DIRECTIVE = 7

const root = join(import.meta.dirname, '..')

/** The Nuxt UI controls that take the id of the UFormField around them unless they are given their own. */
const FIELD_CONTROLS = new Set([
  'UCheckbox',
  'UCheckboxGroup',
  'UFileUpload',
  'UInput',
  'UInputDate',
  'UInputMenu',
  'UInputNumber',
  'UInputRating',
  'UInputTags',
  'UInputTime',
  'UListbox',
  'UPinInput',
  'URadioGroup',
  'USelect',
  'USelectMenu',
  'USlider',
  'USwitch',
  'UTextarea',
])

type Templates = ReadonlyMap<string, RootNode>

interface HeldControls {
  readonly controls: readonly ElementNode[]
  /** How many of them show at once, since only one branch of a `v-if` chain does and a `v-for` repeats its own. */
  readonly together: number
}

function hasDirective(element: ElementNode, name: 'else-if' | 'else' | 'for'): boolean {
  return element.props.some((prop) => prop.type === DIRECTIVE && prop.name === name)
}

/** The controls a node holds for the field around it, leaving out those inside a field of their own and those a control holds. */
function controlsIn(node: RootNode | TemplateChildNode, isControl: (tag: string) => boolean): HeldControls {
  const children = ('children' in node ? (node.children as TemplateChildNode[]) : []).filter((child): child is ElementNode => typeof child === 'object' && child.type === ELEMENT)
  const branches: HeldControls[][] = []
  for (const element of children) {
    const inside = element.tag === 'UFormField' ? { controls: [], together: 0 } : isControl(element.tag) ? { controls: [element], together: 1 } : controlsIn(element, isControl)
    const held = hasDirective(element, 'for') ? { ...inside, together: inside.together * 2 } : inside
    if (branches.length > 0 && (hasDirective(element, 'else-if') || hasDirective(element, 'else'))) branches.at(-1)!.push(held)
    else branches.push([held])
  }
  return {
    controls: branches.flat().flatMap((held) => held.controls),
    together: branches.reduce((sum, chain) => sum + Math.max(...chain.map((held) => held.together)), 0),
  }
}

/** Whether a tag is a Nuxt UI control or a component of Kuna's whose own template holds one for the field around it. */
function controlCheck(templates: Templates): (tag: string) => boolean {
  const known = new Map<string, boolean>()
  const isControl = (tag: string): boolean => {
    if (FIELD_CONTROLS.has(tag)) return true
    const template = templates.get(tag)
    if (template === undefined) return false
    if (!known.has(tag)) {
      // A component that renders itself counts as no control while its own template is read.
      known.set(tag, false)
      known.set(tag, controlsIn(template, isControl).together > 0)
    }
    return known.get(tag)!
  }
  return isControl
}

/**
 * The controls without an id of their own in a UFormField that holds two or more. Each would take the field's one id,
 * so the field's problem, which names that id, would describe whichever control the browser finds first.
 */
function sharedIdControls(source: string, templates: Templates): string[] {
  const ast = parse(source).descriptor.template?.ast
  if (ast === undefined || ast === null) return []
  const isControl = controlCheck(templates)
  return elementsOf(ast)
    .filter((element) => element.tag === 'UFormField')
    .map((field) => controlsIn(field, isControl))
    .filter((held) => held.together >= 2)
    .flatMap((held) => held.controls.filter((control) => propText(control, 'id') === null))
    .map((control) => `<${control.tag}> at line ${control.loc.start.line}`)
}

function templatesOf(files: readonly string[]): Templates {
  return new Map(
    files.flatMap((file) => {
      const ast = parse(readFileSync(join(root, file), 'utf8')).descriptor.template?.ast
      return ast === undefined || ast === null ? [] : [[basename(file, '.vue'), ast] as const]
    }),
  )
}

describe('a form field that holds two or more controls', () => {
  it('gives each control an id of its own, so the field’s problem describes the control it is about', () => {
    const files = globSync('src/**/*.vue', { cwd: root })
    expect(files.length).toBeGreaterThan(100)
    const templates = templatesOf(files)
    const offenders = files.flatMap((file) => sharedIdControls(readFileSync(join(root, file), 'utf8'), templates).map((control) => `${file}: ${control}`))
    expect(offenders).toEqual([])
  })

  it('flags each control without an id beside another or repeated by a v-for, through a component that holds one', () => {
    const wrapper = new Map([['AmountField', parse('<template><div><UInput v-model="text" /></div></template>').descriptor.template!.ast!]])
    const source = `<template>
  <UFormField label="Rate" :error="error">
    <UInput v-model="rate" />
    <AmountField v-model="amount" />
    <UButton icon="i-lucide-x" />
  </UFormField>
</template>`
    expect(sharedIdControls(source, wrapper)).toEqual(['<UInput> at line 3', '<AmountField> at line 4'])
    expect(sharedIdControls(source.replace('<UInput v-model="rate" />', '<UInput id="rate" v-model="rate" />'), wrapper)).toEqual(['<AmountField> at line 4'])
    expect(sharedIdControls('<template><UFormField label="Lines"><div v-for="line in lines" :key="line.id"><UInput v-model="line.text" /></div></UFormField></template>', wrapper)).toEqual([
      '<UInput> at line 1',
    ])
  })

  it('leaves alone one control beside buttons, a field nested inside another and controls of which a v-if shows one', () => {
    const source = `<template>
  <UFormField label="Name">
    <UInput v-model="name" />
    <UButton icon="i-lucide-x" />
    <UFormField label="Note"><UInput v-model="note" /></UFormField>
  </UFormField>
  <UFormField label="Terms">
    <UTextarea v-if="long" v-model="terms" />
    <UInput v-else v-model="terms" />
  </UFormField>
</template>`
    expect(sharedIdControls(source, new Map())).toEqual([])
  })
})
