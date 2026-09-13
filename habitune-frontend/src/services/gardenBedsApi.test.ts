import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildGardenViewportQuery, GardenBedsApiError, getGardenBedRadiusMetres, getGardenBeds, hasValidGardenBedCoordinates, mapGardenBedRecord, projectViewportBounds } from './gardenBedsApi'

const bounds = { west: 144.93, south: -37.83, east: 144.95, north: -37.81 }
const bed = (assetId: string, objectId = '568') => ({ objectid: objectId, asset_id: assetId, neighbourhood: 'Docklands', area_m2: '11', x_coord: '318590.5138', y_coord: '5811872.631' })
afterEach(() => vi.restoreAllMocks())

describe('Garden Beds viewport API', () => {
  it('creates an enclosing EPSG:7855 envelope and candidate query', () => {
    const projected = projectViewportBounds(bounds)
    expect(projected.west).toBeLessThan(projected.east); expect(projected.south).toBeLessThan(projected.north)
    const query = buildGardenViewportQuery(bounds)
    expect(query.where).toContain('neighbourhood in ('); expect(query.where).toContain('x_coord is not null')
  })
  it('maps coordinates and equal-area radius', () => {
    const result = mapGardenBedRecord({ ...bed('1531800'), botanical_name: 'Acacia', common_name: 'Wattle' })
    expect(result).toMatchObject({ id: '1531800', objectId: '568', botanicalName: 'Acacia', commonName: 'Wattle' })
    expect(result.longitude).toBeCloseTo(144.93883838, 6); expect(result.latitude).toBeCloseTo(-37.8225416, 6)
    expect(getGardenBedRadiusMetres(result)).toBeCloseTo(Math.sqrt(11 / Math.PI), 6)
  })
  it('paginates and retains same objectid records with distinct asset IDs', async () => {
    const first = Array.from({ length: 100 }, (_, index) => bed(String(index), String(index)))
    const second = [bed('asset-a'), bed('asset-b')]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ total_count: 102, results: first }) }).mockResolvedValueOnce({ ok: true, json: async () => ({ total_count: 102, results: second }) }))
    const result = await getGardenBeds(bounds)
    expect(result.some((item) => item.id === 'asset-a')).toBe(true); expect(result.some((item) => item.id === 'asset-b')).toBe(true)
  })
  it('does not request all candidates for a viewport outside the project polygons', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(getGardenBeds({ west: 145.3, south: -38.2, east: 145.31, north: -38.19 })).resolves.toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it('handles invalid values, malformed pagination, cancellation, and HTTP errors', async () => {
    expect(hasValidGardenBedCoordinates(mapGardenBedRecord({ x_coord: null, y_coord: null }))).toBe(false)
    expect(getGardenBedRadiusMetres(mapGardenBedRecord({ area_m2: '0' }))).toBeNull()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ total_count: 101, results: [bed('1')] }) }).mockResolvedValueOnce({ ok: true, json: async () => ({ total_count: 101 }) }))
    await expect(getGardenBeds(bounds)).rejects.toThrow('Malformed')
    const controller = new AbortController()
    vi.stubGlobal('fetch', vi.fn((_url, init) => new Promise((_resolve, reject) => (init as RequestInit).signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))))))
    const request = getGardenBeds(bounds, controller.signal); controller.abort()
    await expect(request).rejects.toMatchObject({ name: 'AbortError' })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }))
    await expect(getGardenBeds(bounds)).rejects.toEqual(new GardenBedsApiError(503))
  })
})
