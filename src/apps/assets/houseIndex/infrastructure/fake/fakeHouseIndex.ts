import type { HouseIndex } from '../../domain/houseIndex'
import { houseIndexOfAnswer } from '../dzsHouseIndex'

const QUARTERS = ['2023Q1', '2023Q2', '2023Q3', '2023Q4', '2024Q1', '2024Q2', '2024Q3', '2024Q4', '2025Q1', '2025Q2', '2025Q3', '2025Q4', '2026Q1', '2026Q2']

/** The DZS's answer of 4 Nov 2026 cut to the quarters from 2023, in the shape it comes in. These are public figures. */
export const FAKE_HOUSE_INDEX_ANSWER = {
  id: ['Kategorije', 'Indikatori', 'Tromjesečje'],
  size: [3, 1, QUARTERS.length],
  dimension: {
    Kategorije: { category: { index: { '3': 0, '4': 1, '5': 2 } } },
    Indikatori: { category: { index: { '3': 0 } } },
    Tromjesečje: { category: { index: Object.fromEntries(QUARTERS.map((quarter, place) => [quarter, place])) } },
  },
  value: [
    ...[77.39, 80.18, 81.99, 82.74, 84.23, 87.47, 88.15, 90.64, 95.05, 98.13, 102.76, 104.06, 109.04, 113.53],
    ...[78.39, 80.3, 79.38, 83.97, 85.04, 89.17, 91.84, 91.68, 95.21, 99.52, 100.43, 104.84, 107.22, 108.46],
    ...[70.94, 76.02, 74.85, 76.6, 78.27, 82.71, 87.01, 87.07, 92.96, 97.9, 101.7, 107.44, 109.77, 113.34],
  ],
}

/**
 * The fake build's house price index, as `?index=` names it: none for the answer above, `opening` holding the
 * request for good, and `failed` refusing it. The fake build sends no request to another origin.
 */
export function fakeHouseIndex(variant: string | null): Promise<HouseIndex> {
  if (variant === 'opening') return new Promise(() => {})
  if (variant === 'failed') return Promise.reject(new Error('The fake DZS refused the request.'))
  return Promise.resolve(houseIndexOfAnswer(FAKE_HOUSE_INDEX_ANSWER))
}
