import type { ViewportBounds } from '../utils/projectAreaGeometry'

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

export interface UrbanForestTree {
  com_id: string; common_name: string | null; scientific_name: string | null
  genus: string | null; family: string | null; precinct: string | null
  projectPrecinct: string | null; latitude: number | null; longitude: number | null
}
interface TreeFeature {
  id?: string | number | null
  geometry?: { type?: string; coordinates?: unknown[] } | null
  properties?: { tree_id?: string | null; common_name?: string | null; scientific_name?: string | null; genus?: string | null; family?: string | null; precinct_id?: string | null } | null
}
interface TreeFeatureCollection { type?: string; features?: TreeFeature[] }

export class CityTreesApiError extends Error {
  status: number
  constructor(status: number) {
    super(`Habitune vegetation trees request failed with HTTP ${status}`)
    this.name = 'CityTreesApiError'; this.status = status
  }
}

export function buildVegetationViewportParams(bounds: ViewportBounds) {
  return new URLSearchParams({ west: String(bounds.west), east: String(bounds.east), south: String(bounds.south), north: String(bounds.north) })
}

export function hasValidTreeCoordinates(tree: Pick<UrbanForestTree, 'latitude' | 'longitude'>): boolean {
  return Number.isFinite(tree.latitude) && Number.isFinite(tree.longitude)
    && tree.latitude! >= -90 && tree.latitude! <= 90
    && tree.longitude! >= -180 && tree.longitude! <= 180
}

function coordinate(value: unknown): number | null {
  if (value == null || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function mapTreeFeature(feature: TreeFeature): UrbanForestTree | null {
  const coordinates = feature.geometry?.type === 'Point' ? feature.geometry.coordinates : null
  const longitude = coordinate(coordinates?.[0]), latitude = coordinate(coordinates?.[1])
  const properties = feature.properties || {}, treeId = properties.tree_id ?? feature.id
  if (treeId == null) return null
  const tree: UrbanForestTree = {
    com_id: String(treeId), common_name: properties.common_name ?? null,
    scientific_name: properties.scientific_name ?? null, genus: properties.genus ?? null,
    family: properties.family ?? null, precinct: properties.precinct_id ?? null,
    projectPrecinct: properties.precinct_id ?? null, latitude, longitude,
  }
  return hasValidTreeCoordinates(tree) ? tree : null
}

export async function getUrbanForestTrees(bounds: ViewportBounds, signal?: AbortSignal): Promise<UrbanForestTree[]> {
  if (!apiBaseUrl) throw new Error('VITE_API_BASE_URL is not configured')
  const response = await fetch(`${apiBaseUrl}/vegetation/trees?${buildVegetationViewportParams(bounds)}`, { headers: { Accept: 'application/json' }, signal })
  if (!response.ok) throw new CityTreesApiError(response.status)
  const body = await response.json() as TreeFeatureCollection
  if (body.type !== 'FeatureCollection' || !Array.isArray(body.features)) return []
  return body.features.flatMap((feature) => { const tree = mapTreeFeature(feature); return tree ? [tree] : [] })
}
