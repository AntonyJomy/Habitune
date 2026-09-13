import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildVegetationViewportParams, CityTreesApiError, getUrbanForestTrees, hasValidTreeCoordinates, mapTreeFeature } from './cityTreesApi'

const bounds = { west: 144.92, south: -37.80, east: 144.94, north: -37.78 }
const feature = { type: 'Feature', id: '1286315', geometry: { type: 'Point', coordinates: [144.9258596, -37.78896816] }, properties: { tree_id: '1286315', common_name: 'Peppercorn Tree', scientific_name: 'Schinus molle', genus: 'Schinus', family: 'Anacardiaceae', precinct_id: 'kensington' } }
afterEach(() => vi.restoreAllMocks())

describe('Habitune vegetation trees API', () => {
  it('builds WGS84 bbox parameters', () => expect(Object.fromEntries(buildVegetationViewportParams(bounds))).toEqual({ west: '144.92', east: '144.94', south: '-37.8', north: '-37.78' }))
  it('maps backend GeoJSON into the existing tree model', () => expect(mapTreeFeature(feature)).toMatchObject({ com_id: '1286315', common_name: 'Peppercorn Tree', projectPrecinct: 'kensington', latitude: -37.78896816, longitude: 144.9258596 }))
  it('requests one bbox FeatureCollection and ignores invalid geometry', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ type: 'FeatureCollection', features: [feature, { ...feature, id: 'bad', properties: { tree_id: 'bad' }, geometry: null }] }) }))
    await expect(getUrbanForestTrees(bounds)).resolves.toHaveLength(1)
    const url = new URL(vi.mocked(fetch).mock.calls[0][0] as string, 'https://example.test')
    expect(url.pathname.endsWith('/vegetation/trees')).toBe(true); expect(url.searchParams.get('west')).toBe('144.92')
  })
  it('passes cancellation and handles HTTP errors', async () => {
    const controller = new AbortController()
    vi.stubGlobal('fetch', vi.fn((_url, init) => new Promise((_resolve, reject) => (init as RequestInit).signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))))))
    const request = getUrbanForestTrees(bounds, controller.signal); controller.abort()
    await expect(request).rejects.toMatchObject({ name: 'AbortError' })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 413 }))
    await expect(getUrbanForestTrees(bounds)).rejects.toEqual(new CityTreesApiError(413))
  })
  it('validates coordinates and malformed FeatureCollections', async () => {
    expect(hasValidTreeCoordinates({ latitude: -37.8, longitude: 144.9 })).toBe(true)
    expect(hasValidTreeCoordinates({ latitude: null, longitude: 144.9 })).toBe(false)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }))
    await expect(getUrbanForestTrees(bounds)).resolves.toEqual([])
  })
})
