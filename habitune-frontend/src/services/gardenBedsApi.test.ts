import { afterEach, describe, expect, it, vi } from 'vitest'
import { GardenBedsApiError, getGardenBedRadiusMetres, getGardenBeds, hasValidGardenBedCoordinates, mapGardenBedFeature } from './gardenBedsApi'

const bounds = { west: 144.93, south: -37.83, east: 144.95, north: -37.81 }
const feature = { type: 'Feature', id: '1531800', geometry: { type: 'Point', coordinates: [144.93883838, -37.8225416] }, properties: { bed_id: '1531800', name: 'Example bed', precinct_id: 'docklands', area_m2: 11, source_neighbourhood: 'Docklands', site_type: 'Median', assessed_bed_types: ['Shrub bed'], botanical_names: ['Acacia'], common_names: ['Wattle'] } }
afterEach(() => vi.restoreAllMocks())

describe('Habitune vegetation garden beds API', () => {
  it('maps backend Point GeoJSON and preserves equal-area radius', () => {
    const result = mapGardenBedFeature(feature)!
    expect(result).toMatchObject({ id: '1531800', botanicalName: 'Acacia', commonName: 'Wattle', projectPrecinct: 'docklands', longitude: 144.93883838, latitude: -37.8225416 })
    expect(getGardenBedRadiusMetres(result)).toBeCloseTo(Math.sqrt(11 / Math.PI), 6)
  })
  it('requests the bbox endpoint and filters malformed geometry', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ type: 'FeatureCollection', features: [feature, { ...feature, id: 'bad', properties: { bed_id: 'bad' }, geometry: null }] }) }))
    await expect(getGardenBeds(bounds)).resolves.toHaveLength(1)
    const url = new URL(vi.mocked(fetch).mock.calls[0][0] as string, 'https://example.test')
    expect(url.pathname.endsWith('/vegetation/beds')).toBe(true); expect(url.searchParams.get('north')).toBe('-37.81')
  })
  it('handles invalid values, cancellation, and HTTP errors', async () => {
    const noCoordinates = mapGardenBedFeature({ id: 'bad', geometry: null, properties: {} })!
    expect(hasValidGardenBedCoordinates(noCoordinates)).toBe(false)
    expect(getGardenBedRadiusMetres({ ...noCoordinates, areaM2: 0 })).toBeNull()
    const controller = new AbortController()
    vi.stubGlobal('fetch', vi.fn((_url, init) => new Promise((_resolve, reject) => (init as RequestInit).signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))))))
    const request = getGardenBeds(bounds, controller.signal); controller.abort()
    await expect(request).rejects.toMatchObject({ name: 'AbortError' })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }))
    await expect(getGardenBeds(bounds)).rejects.toEqual(new GardenBedsApiError(503))
  })
})
