import { describe, expect, it } from 'vitest'
import { buildNatureKitHabitatExportUrl, buildNatureKitHabitatIdentifyUrl, natureKitHabitatExportEndpoint, natureKitHabitatIdentifyEndpoint, parseNatureKitHabitatValue } from './natureKitApi'

describe('NatureKit Habitat Value export URL', () => {
  it('requests the current Web Mercator viewport as a transparent layer 0 image', () => {
    const url = new URL(buildNatureKitHabitatExportUrl(
      { west: 16133612.4, south: -4551809.2, east: 16163780.1, north: -4521608.5 },
      { width: 815.4, height: 602.6 },
    ))

    expect(`${url.origin}${url.pathname}`).toBe(natureKitHabitatExportEndpoint)
    expect(url.searchParams.get('bbox')).toBe('16133612.4,-4551809.2,16163780.1,-4521608.5')
    expect(url.searchParams.get('bboxSR')).toBe('3857')
    expect(url.searchParams.get('imageSR')).toBe('3857')
    expect(url.searchParams.get('size')).toBe('815,603')
    expect(url.searchParams.get('format')).toBe('png32')
    expect(url.searchParams.get('transparent')).toBe('true')
    expect(url.searchParams.get('layers')).toBe('show:0')
    expect(url.searchParams.get('f')).toBe('image')
  })

  it('never requests a zero-sized image', () => {
    const url = new URL(buildNatureKitHabitatExportUrl(
      { west: 0, south: 0, east: 1, north: 1 },
      { width: 0, height: 0 },
    ))

    expect(url.searchParams.get('size')).toBe('1,1')
  })
})

describe('NatureKit Habitat Value identify', () => {
  const bounds = { west: 144.8, south: -37.9, east: 145.1, north: -37.7 }
  const size = { width: 1200, height: 800 }

  it('builds a WGS84 point identify request using the current viewport', () => {
    const url = new URL(buildNatureKitHabitatIdentifyUrl(-37.7905, 144.952, bounds, size, 'testCallback'))

    expect(`${url.origin}${url.pathname}`).toBe(natureKitHabitatIdentifyEndpoint)
    expect(url.searchParams.get('geometry')).toBe('144.952,-37.7905')
    expect(url.searchParams.get('geometryType')).toBe('esriGeometryPoint')
    expect(url.searchParams.get('sr')).toBe('4326')
    expect(url.searchParams.get('layers')).toBe('all:0')
    expect(url.searchParams.get('mapExtent')).toBe('144.8,-37.9,145.1,-37.7')
    expect(url.searchParams.get('imageDisplay')).toBe('1200,800,96')
    expect(url.searchParams.get('returnGeometry')).toBe('false')
    expect(url.searchParams.get('callback')).toBe('testCallback')
  })

  it('parses the numeric Stretch.Pixel Value rank', () => {
    expect(parseNatureKitHabitatValue({ results: [{ layerId: 0, layerName: 'Habitat Value', attributes: { 'Stretch.Pixel Value': '63' } }] })).toEqual({
      rank: 63,
      layerId: 0,
      layerName: 'Habitat Value',
    })
  })

  it('returns null for empty, malformed, or out-of-range ranks', () => {
    expect(parseNatureKitHabitatValue({ results: [] })).toBeNull()
    expect(parseNatureKitHabitatValue({ results: [{ layerId: 0, attributes: { 'Stretch.Pixel Value': 'not-a-number' } }] })).toBeNull()
    expect(parseNatureKitHabitatValue({ results: [{ layerId: 0, attributes: { 'Stretch.Pixel Value': '101' } }] })).toBeNull()
  })
})
