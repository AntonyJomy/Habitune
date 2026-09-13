import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildTreeViewportFilter, CityTreesApiError, getUrbanForestTrees, hasValidTreeCoordinates, type UrbanForestTree } from './cityTreesApi'

const bounds = { west: 144.92, south: -37.80, east: 144.94, north: -37.78 }
const tree = { com_id: '1286315', common_name: 'Peppercorn Tree', scientific_name: 'Schinus molle', genus: 'Schinus', family: 'Anacardiaceae', precinct: 'Kensington', latitude: -37.78896816, longitude: 144.9258596 }
afterEach(() => vi.restoreAllMocks())

describe('City trees viewport API', () => {
  it('builds a numeric WGS84 bbox filter', () => expect(buildTreeViewportFilter(bounds)).toBe('latitude >= -37.8 and latitude <= -37.78 and longitude >= 144.92 and longitude <= 144.94'))
  it('paginates, spatially filters, and deduplicates com_id', async () => {
    const first = Array.from({ length: 100 }, (_, index) => ({ ...tree, com_id: String(index) }))
    const second = [{ ...tree, com_id: '0' }, { ...tree, com_id: '100' }, { ...tree, com_id: 'outside', longitude: 145.5 }]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ total_count: 103, results: first }) }).mockResolvedValueOnce({ ok: true, json: async () => ({ total_count: 103, results: second }) }))
    const result = await getUrbanForestTrees(bounds)
    expect(result).toHaveLength(101); expect(result[0].projectPrecinct).toBe('Kensington')
    expect(new URL(vi.mocked(fetch).mock.calls[1][0] as string).searchParams.get('offset')).toBe('100')
  })
  it('rejects malformed/truncated pages', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ total_count: 101, results: [tree] }) }).mockResolvedValueOnce({ ok: true, json: async () => ({ total_count: 101, results: [] }) }))
    await expect(getUrbanForestTrees(bounds)).rejects.toThrow('ended early')
  })
  it('passes cancellation and handles HTTP errors', async () => {
    const controller = new AbortController()
    vi.stubGlobal('fetch', vi.fn((_url, init) => new Promise((_resolve, reject) => (init as RequestInit).signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))))))
    const request = getUrbanForestTrees(bounds, controller.signal); controller.abort()
    await expect(request).rejects.toMatchObject({ name: 'AbortError' })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }))
    await expect(getUrbanForestTrees(bounds)).rejects.toEqual(new CityTreesApiError(503))
  })
  it('validates coordinates and malformed first responses', async () => {
    expect(hasValidTreeCoordinates({ ...tree, projectPrecinct: null } as UrbanForestTree)).toBe(true)
    expect(hasValidTreeCoordinates({ ...tree, latitude: null })).toBe(false)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }))
    await expect(getUrbanForestTrees(bounds)).resolves.toEqual([])
  })
})
