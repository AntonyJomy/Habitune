export const natureKitHabitatExportEndpoint = 'https://biod-gis.mapshare.vic.gov.au/arcgis/rest/services/NatureKit/habitat_value/MapServer/export'
export const natureKitHabitatIdentifyEndpoint = 'https://biod-gis.mapshare.vic.gov.au/arcgis/rest/services/NatureKit/habitat_value/MapServer/identify'

export interface ProjectedMapBounds {
  west: number
  south: number
  east: number
  north: number
}

export interface MapImageSize {
  width: number
  height: number
}

export interface GeographicMapBounds {
  west: number
  south: number
  east: number
  north: number
}

export interface NatureKitHabitatValue {
  rank: number
  layerId: 0
  layerName: string
}

interface NatureKitIdentifyResponse {
  results?: Array<{
    layerId?: number
    layerName?: string
    attributes?: Record<string, unknown>
  }>
}

export class NatureKitApiError extends Error {
  status: number

  constructor(status: number) {
    super(status > 0 ? `NatureKit request failed with HTTP ${status}` : 'NatureKit request could not be loaded')
    this.name = 'NatureKitApiError'
    this.status = status
  }
}

export function buildNatureKitHabitatExportUrl(bounds: ProjectedMapBounds, size: MapImageSize): string {
  const params = new URLSearchParams({
    bbox: `${bounds.west},${bounds.south},${bounds.east},${bounds.north}`,
    bboxSR: '3857',
    imageSR: '3857',
    size: `${Math.max(1, Math.round(size.width))},${Math.max(1, Math.round(size.height))}`,
    format: 'png32',
    transparent: 'true',
    layers: 'show:0',
    f: 'image',
  })
  return `${natureKitHabitatExportEndpoint}?${params}`
}

export function buildNatureKitHabitatIdentifyUrl(
  latitude: number,
  longitude: number,
  bounds: GeographicMapBounds,
  size: MapImageSize,
  callback?: string,
): string {
  const params = new URLSearchParams({
    geometry: `${longitude},${latitude}`,
    geometryType: 'esriGeometryPoint',
    sr: '4326',
    layers: 'all:0',
    tolerance: '3',
    mapExtent: `${bounds.west},${bounds.south},${bounds.east},${bounds.north}`,
    imageDisplay: `${Math.max(1, Math.round(size.width))},${Math.max(1, Math.round(size.height))},96`,
    returnGeometry: 'false',
    f: 'json',
  })
  if (callback) params.set('callback', callback)
  return `${natureKitHabitatIdentifyEndpoint}?${params}`
}

export function parseNatureKitHabitatValue(payload: NatureKitIdentifyResponse): NatureKitHabitatValue | null {
  const result = payload.results?.find((item) => item.layerId === 0)
  const rawRank = result?.attributes?.['Stretch.Pixel Value']
  const rank = typeof rawRank === 'number' || typeof rawRank === 'string' ? Number(rawRank) : Number.NaN
  if (!Number.isFinite(rank) || rank < 0 || rank > 100) return null

  return { rank, layerId: 0, layerName: result?.layerName || 'Habitat Value' }
}

let identifyRequestSequence = 0

export async function identifyNatureKitHabitatValue(
  latitude: number,
  longitude: number,
  bounds: GeographicMapBounds,
  size: MapImageSize,
  signal?: AbortSignal,
): Promise<NatureKitHabitatValue | null> {
  if (signal?.aborted) throw new DOMException('The request was aborted', 'AbortError')

  const callbackName = `habituneNatureKitIdentify${Date.now()}_${identifyRequestSequence++}`
  const callbackHost = window as unknown as Record<string, unknown>
  const script = document.createElement('script')
  script.async = true
  script.src = buildNatureKitHabitatIdentifyUrl(latitude, longitude, bounds, size, callbackName)

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      signal?.removeEventListener('abort', onAbort)
      script.remove()
      delete callbackHost[callbackName]
    }
    const onAbort = () => {
      cleanup()
      reject(new DOMException('The request was aborted', 'AbortError'))
    }
    callbackHost[callbackName] = (payload: NatureKitIdentifyResponse) => {
      cleanup()
      resolve(parseNatureKitHabitatValue(payload))
    }
    script.onerror = () => {
      cleanup()
      reject(new NatureKitApiError(0))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
    document.head.appendChild(script)
  })
}
