import { findProjectPrecinct, type ViewportBounds } from '../utils/projectAreaGeometry'

const urbanForestTreesUrl = 'https://data.melbourne.vic.gov.au/api/explore/v2.1/catalog/datasets/trees-with-species-and-dimensions-urban-forest/records'
const pageSize = 100

export interface UrbanForestTree {
  com_id: string; common_name: string | null; scientific_name: string | null
  genus: string | null; family: string | null; precinct: string | null
  projectPrecinct: string | null; latitude: number | null; longitude: number | null
}
type TreeApiRecord = Omit<UrbanForestTree, 'projectPrecinct'>
interface UrbanForestTreesResponse { total_count?: number; results?: TreeApiRecord[] }

export class CityTreesApiError extends Error {
  status: number
  constructor(status: number) {
    super(`City of Melbourne trees request failed with HTTP ${status}`)
    this.name = 'CityTreesApiError'; this.status = status
  }
}

export function buildTreeViewportFilter(bounds: ViewportBounds) {
  return `latitude >= ${bounds.south} and latitude <= ${bounds.north} and longitude >= ${bounds.west} and longitude <= ${bounds.east}`
}

async function fetchPage(where: string, offset: number, signal?: AbortSignal): Promise<UrbanForestTreesResponse> {
  const params = new URLSearchParams({
    select: 'com_id,common_name,scientific_name,genus,family,precinct,latitude,longitude',
    where, limit: String(pageSize), offset: String(offset),
  })
  const response = await fetch(`${urbanForestTreesUrl}?${params}`, { headers: { Accept: 'application/json' }, signal })
  if (!response.ok) throw new CityTreesApiError(response.status)
  return response.json() as Promise<UrbanForestTreesResponse>
}

export function hasValidTreeCoordinates(tree: UrbanForestTree | TreeApiRecord): boolean {
  return Number.isFinite(tree.latitude) && Number.isFinite(tree.longitude)
    && tree.latitude! >= -90 && tree.latitude! <= 90
    && tree.longitude! >= -180 && tree.longitude! <= 180
}

export async function getUrbanForestTrees(bounds: ViewportBounds, signal?: AbortSignal): Promise<UrbanForestTree[]> {
  const where = buildTreeViewportFilter(bounds)
  const first = await fetchPage(where, 0, signal)
  if (!Array.isArray(first.results)) return []
  const total = Number.isFinite(first.total_count) ? first.total_count! : first.results.length
  if (total > 10_000) throw new Error(`Tree viewport contains ${total} records; zoom further in to avoid API truncation`)
  const records = [...first.results]
  for (let offset = pageSize; offset < total; offset += pageSize) {
    const page = await fetchPage(where, offset, signal)
    if (!Array.isArray(page.results)) throw new Error('Malformed City of Melbourne tree page')
    records.push(...page.results)
  }
  if (records.length < total) throw new Error(`Tree pagination ended early (${records.length}/${total})`)

  const unique = new Map<string, UrbanForestTree>()
  records.forEach((tree) => {
    if (!hasValidTreeCoordinates(tree)) return
    const projectPrecinct = findProjectPrecinct(tree.longitude!, tree.latitude!)
    if (projectPrecinct) unique.set(tree.com_id, { ...tree, projectPrecinct })
  })
  return Array.from(unique.values())
}
