type AxisOption = Record<string, unknown>

function firstAxis(axis: unknown): AxisOption | null {
  const single = Array.isArray(axis) ? axis[0] : axis
  return typeof single === 'object' && single !== null ? (single as AxisOption) : null
}

export function isCategoryAxis(axis: unknown): boolean {
  return firstAxis(axis)?.type === 'category'
}

/** The categories of a chart's category axis, such as its months. */
export function categoryData(axis: unknown): readonly unknown[] {
  const data = firstAxis(axis)?.data
  return Array.isArray(data) ? data : []
}
