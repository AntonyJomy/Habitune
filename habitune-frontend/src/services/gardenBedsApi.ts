import proj4 from 'proj4'
import { gardenSourceNamesForProjectPrecincts } from '../data/projectPrecincts'
import { findProjectPrecinct, projectPrecinctsNearViewport, type ViewportBounds } from '../utils/projectAreaGeometry'

const gardenBedsUrl = 'https://data.melbourne.vic.gov.au/api/explore/v2.1/catalog/datasets/renewals-for-nature-city-of-melbourne-garden-bed-inventory-2024/records'
const gda2020MgaZone55 = '+proj=utm +zone=55 +south +ellps=GRS80 +units=m +no_defs +type=crs'
const pageSize = 100

interface GardenBedApiRecord {
  objectid?: string | null; asset_id?: string | null; assessed_bed_type?: string | null
  botanical_name?: string | null; common_name?: string | null; neighbourhood?: string | null
  area_m2?: string | null; site_type?: string | null; site?: string | null
  x_coord?: string | null; y_coord?: string | null
}
interface GardenBedApiResponse { total_count?: number; results?: GardenBedApiRecord[] }
export interface ProjectedBounds { west: number; south: number; east: number; north: number }

export interface GardenBedRecord {
  id: string; objectId: string | null; assetId: string | null; assessedBedType: string | null
  botanicalName: string | null; commonName: string | null; neighbourhood: string | null
  projectPrecinct: string | null; areaM2: number | null; siteType: string | null; site: string | null
  xCoordinate: number | null; yCoordinate: number | null; latitude: number | null; longitude: number | null
}

export class GardenBedsApiError extends Error {
  status: number
  constructor(status: number) {
    super(`City of Melbourne garden beds request failed with HTTP ${status}`)
    this.name = 'GardenBedsApiError'; this.status = status
  }
}

function parseNumber(value?: string | null): number | null {
  if (value == null || value.trim() === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}
function quote(value: string) { return `"${value.replaceAll('"', '\\"')}"` }

export function projectViewportBounds(bounds: ViewportBounds): ProjectedBounds {
  const corners = [[bounds.west, bounds.south], [bounds.west, bounds.north], [bounds.east, bounds.south], [bounds.east, bounds.north]]
    .map((coordinate) => proj4('EPSG:4326', gda2020MgaZone55, coordinate))
  const eastings = corners.map(([x]) => x), northings = corners.map(([, y]) => y)
  return { west: Math.min(...eastings), south: Math.min(...northings), east: Math.max(...eastings), north: Math.max(...northings) }
}

export function buildGardenViewportQuery(bounds: ViewportBounds) {
  const projectNames = projectPrecinctsNearViewport(bounds)
  const sourceNames = gardenSourceNamesForProjectPrecincts(projectNames)
  const neighbourhoodFilter = sourceNames.length ? `neighbourhood in (${sourceNames.map(quote).join(',')}) and ` : ''
  return {
    where: `${neighbourhoodFilter}x_coord is not null and y_coord is not null`,
    projectedBounds: projectViewportBounds(bounds),
    sourceNames,
  }
}

export function mapGardenBedRecord(record: GardenBedApiRecord, index = 0): GardenBedRecord {
  const xCoordinate = parseNumber(record.x_coord), yCoordinate = parseNumber(record.y_coord)
  let latitude: number | null = null, longitude: number | null = null
  if (xCoordinate != null && yCoordinate != null) {
    try {
      const transformed = proj4(gda2020MgaZone55, 'EPSG:4326', [xCoordinate, yCoordinate])
      if (Number.isFinite(transformed[0]) && Number.isFinite(transformed[1])) [longitude, latitude] = transformed
    } catch { /* Invalid source coordinates remain unrenderable. */ }
  }
  const fallbackId = [record.objectid || 'unknown', record.x_coord || 'x', record.y_coord || 'y', index].join(':')
  return {
    id: record.asset_id || fallbackId, objectId: record.objectid || null, assetId: record.asset_id || null,
    assessedBedType: record.assessed_bed_type || null, botanicalName: record.botanical_name || null,
    commonName: record.common_name || null, neighbourhood: record.neighbourhood || null, projectPrecinct: null,
    areaM2: parseNumber(record.area_m2), siteType: record.site_type || null, site: record.site || null,
    xCoordinate, yCoordinate, latitude, longitude,
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

async function fetchPage(where: string, offset: number, signal?: AbortSignal): Promise<GardenBedApiResponse> {
  const params = new URLSearchParams({
    select: 'objectid,asset_id,assessed_bed_type,botanical_name,common_name,neighbourhood,area_m2,site_type,site,x_coord,y_coord',
    where,
    limit: String(pageSize),
    offset: String(offset),
  })
  const response = await fetch(`${gardenBedsUrl}?${params}`, { headers: { Accept: 'application/json' }, signal })
  if (!response.ok) throw new GardenBedsApiError(response.status)
  return response.json() as Promise<GardenBedApiResponse>
}

export async function getGardenBeds(bounds: ViewportBounds, signal?: AbortSignal): Promise<GardenBedRecord[]> {
  const { where, projectedBounds, sourceNames } = buildGardenViewportQuery(bounds)
  if (sourceNames.length === 0) return []
  const first = await fetchPage(where, 0, signal)
  if (!Array.isArray(first.results)) return []
  const total = Number.isFinite(first.total_count) ? first.total_count! : first.results.length
  if (total > 10_000) throw new Error(`Garden Bed viewport candidate query contains ${total} records; zoom further in`)
  const records = [...first.results]
  for (let offset = pageSize; offset < total; offset += pageSize) {
    const page = await fetchPage(where, offset, signal)
    if (!Array.isArray(page.results)) throw new Error('Malformed City of Melbourne garden bed page')
    records.push(...page.results)
  }
  if (records.length < total) throw new Error(`Garden Bed pagination ended early (${records.length}/${total})`)

  const unique = new Map<string, GardenBedRecord>()
  records.forEach((source, index) => {
    const record = mapGardenBedRecord(source, index)
    if (record.xCoordinate == null || record.yCoordinate == null
      || record.xCoordinate < projectedBounds.west || record.xCoordinate > projectedBounds.east
      || record.yCoordinate < projectedBounds.south || record.yCoordinate > projectedBounds.north
      || !hasValidGardenBedCoordinates(record)
      || record.longitude! < bounds.west || record.longitude! > bounds.east
      || record.latitude! < bounds.south || record.latitude! > bounds.north) return
    const projectPrecinct = findProjectPrecinct(record.longitude!, record.latitude!)
    if (projectPrecinct) unique.set(record.id, { ...record, projectPrecinct })
  })
  return Array.from(unique.values())
}
