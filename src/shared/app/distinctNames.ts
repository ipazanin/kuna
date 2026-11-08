/** The names as given, with a number after each repeat, such as `(2)`, in the order the screens list them, so no two figures share a label. */
export function distinctNames(names: readonly string[]): readonly string[] {
  return names.map((name, at) => {
    const repeat = names.slice(0, at).filter((earlier) => earlier === name).length
    return repeat === 0 ? name : `${name} (${repeat + 1})`
  })
}
