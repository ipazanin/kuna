import { describe, expect, it } from 'vitest'

import { mapLinkOf, placeInJpeg } from '../src/apps/spending/receipts/domain/photoPlace'
import { jpegWithMadeUpPlace, sampleReceiptPng } from '../src/apps/spending/receipts/infrastructure/fake/sampleReceiptPhoto'

/** The two bytes that start a JPEG, the image data's marker and nothing else, which is all the reader needs. */
const BARE_JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xda, 0, 2])
const PLACE = { latitude: 43.5081, longitude: 16.4402 }

describe('the place in a photo', () => {
  it.each([
    ['little-endian', true],
    ['big-endian', false],
  ])('reads a made-up position from %s Exif', (_order, littleEndian) => {
    expect(placeInJpeg(jpegWithMadeUpPlace(BARE_JPEG, PLACE, littleEndian))).toEqual({ latitude: '43.508100', longitude: '16.440200' })
  })

  it('signs south and west', () => {
    expect(placeInJpeg(jpegWithMadeUpPlace(BARE_JPEG, { ...PLACE, north: false, east: false }))).toEqual({ latitude: '-43.508100', longitude: '-16.440200' })
  })

  it('finds Exif past an earlier segment', () => {
    const withExif = jpegWithMadeUpPlace(BARE_JPEG, PLACE)
    const app0 = [0xff, 0xe0, 0, 4, 1, 2]

    expect(placeInJpeg(Uint8Array.from([0xff, 0xd8, ...app0, ...withExif.subarray(2)]))).toEqual({ latitude: '43.508100', longitude: '16.440200' })
  })

  it('finds none in a JPEG with no Exif, in a PNG, or in nothing', () => {
    expect(placeInJpeg(BARE_JPEG)).toBeNull()
    expect(placeInJpeg(sampleReceiptPng(null))).toBeNull()
    expect(placeInJpeg(new Uint8Array())).toBeNull()
  })

  it('finds none in bytes cut short, and throws nothing', () => {
    const whole = jpegWithMadeUpPlace(BARE_JPEG, PLACE)

    for (let length = 0; length < whole.length - 8; length += 1) expect(() => placeInJpeg(whole.subarray(0, length))).not.toThrow()
  })

  it('finds none at 0, 0, which a camera with no fix writes, or past the poles', () => {
    expect(placeInJpeg(jpegWithMadeUpPlace(BARE_JPEG, { latitude: 0, longitude: 0 }))).toBeNull()
    expect(placeInJpeg(jpegWithMadeUpPlace(BARE_JPEG, { latitude: 95, longitude: 16 }))).toBeNull()
  })

  it('finds none with a zero denominator', () => {
    const bytes = jpegWithMadeUpPlace(BARE_JPEG, PLACE)
    // The latitude's degrees denominator: the rationals start 80 bytes into the TIFF, which starts 12 bytes into the file.
    bytes.fill(0, 12 + 84, 12 + 88)

    expect(placeInJpeg(bytes)).toBeNull()
  })
})

describe('the link to a place', () => {
  it('opens OpenStreetMap at the coordinates', () => {
    expect(mapLinkOf({ latitude: '43.508100', longitude: '16.440200' })).toBe('https://www.openstreetmap.org/?mlat=43.5081&mlon=16.4402#map=18/43.5081/16.4402')
  })

  it('is none without coordinates, or with text a hand edit left', () => {
    expect(mapLinkOf({ latitude: '', longitude: '' })).toBeNull()
    expect(mapLinkOf({ latitude: 'evil.example', longitude: '16' })).toBeNull()
  })
})
