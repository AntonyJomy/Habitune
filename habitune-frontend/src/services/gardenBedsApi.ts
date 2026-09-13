import type { ViewportBounds } from '../utils/projectAreaGeometry'
import { buildVegetationViewportParams } from './cityTreesApi'

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

interface GardenBedFeature {
  id?: string | number | null
  geometry?: { type?: string; coordinates?: unknown[] } | null
  properties?: {
    bed_id?: string | null; name?: string | null; precinct_id?: string | null; area_m2?: number | string | null
    source_neighbourhood?: string | null; site_type?: string | null; assessed_bed_types?: string[] | null
    botanical_names?: string[] | null; common_names?: string[] | null
  } | null
}
interface GardenBedFeatureCollection { type?: string; features?: GardenBedFeature[] }

export interface GardenBedRecord {
  id: string; objectId: string | null; assetId: string | null; assessedBedType: string | null
  botanicalName: string | null; commonName: string | null; neighbourhood: string | null
  projectPrecinct: string | null; areaM2: number | null; siteType: string | null; site: string | null
  xCoordinate: number | null; yCoordinate: number | null; latitude: number | null; longitude: number | null
}

export class GardenBedsApiError extends Error {
  status: number
  constructor(status: number) {
    super(`Habitune vegetation garden beds request failed with HTTP ${status}`)
    this.name = 'GardenBedsApiError'; this.status = status
  }
}

function nullableNumber(value: unknown): number | null {
  if (value == null || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function mapGardenBedFeature(feature: GardenBedFeature): GardenBedRecord | null {
  const properties = feature.properties || {}, bedId = properties.bed_id ?? feature.id
  if (bedId == null) return null
  const coordinates = feature.geometry?.type === 'Point' ? feature.geometry.coordinates : null
  return {
    id: String(bedId), objectId: null, assetId: String(bedId),
    assessedBedType: properties.assessed_bed_types?.[0] ?? null,
    botanicalName: properties.botanical_names?.[0] ?? null,
    commonName: properties.common_names?.[0] ?? null,
    neighbourhood: properties.source_neighbourhood ?? null,
    projectPrecinct: properties.precinct_id ?? null,
    areaM2: nullableNumber(properties.area_m2), siteType: properties.site_type ?? null,
    site: properties.name ?? null, xCoordinate: null, yCoordinate: null,
    latitude: nullableNumber(coordinates?.[1]), longitude: nullableNumber(coordinates?.[0]),
  }
}

export function hasValidGardenBedCoordinates(record: GardenBedRecord): boolean {
  return Number.isFinite(record.latitude) && Number.isFinite(record.longitude)
    && record.latitude! >= -90 && record.latitude! <= 90
    && record.longitude! >= -180 && record.longitude! <= 180
}
export function getGardenBedRadiusMetres(record: GardenBedRecord): number | null {
  if (record.areaM2 == null || !Number.isFinite(record.areaM2) || record.areaM2 <= 0) return null
  return Math.sqrt(record.areaM2 / Math.PI)
}

export async function getGardenBeds(bounds: ViewportBounds, signal?: AbortSignal): Promise<GardenBedRecord[]> {
  if (!apiBaseUrl) throw new Error('VITE_API_BASE_URL is not configured')
  const response = await fetch(`${apiBaseUrl}/vegetation/beds?${buildVegetationViewportParams(bounds)}`, { headers: { Accept: 'application/json' }, signal })
  if (!response.ok) throw new GardenBedsApiError(response.status)
  const body = await response.json() as GardenBedFeatureCollection
  if (body.type !== 'FeatureCollection' || !Array.isArray(body.features)) return []
  return body.features.flatMap((feature) => { const bed = mapGardenBedFeature(feature); return bed && hasValidGardenBedCoordinates(bed) ? [bed] : [] })
}
