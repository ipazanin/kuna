/**
 * Whether an element's text holds `wanted`, reading every run of whitespace, non-breaking spaces among them, as one space.
 * Flows also send it into the page, so it uses nothing outside itself.
 */
export function textHolds(shown, wanted) {
  return shown.replace(/\s+/g, ' ').includes(wanted.replace(/\s+/g, ' ').trim())
}
