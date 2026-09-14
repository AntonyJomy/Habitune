import projectAreasJson from '../data/dataset/map_view1_suburbs.geojson?raw'

export type ViewportBounds = { west: number; south: number; east: number; north: number }
export type ProjectPosition = [number, number]
type Position = ProjectPosition
type ProjectFeature = { properties: { suburb: string }; geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: Position[][] | Position[][][] } }

const features = (JSON.parse(projectAreasJson) as { features: ProjectFeature[] }).features

function pointOnSegment([x, y]: Position, [x1, y1]: Position, [x2, y2]: Position) {
  const cross = (x - x1) * (y2 - y1) - (y - y1) * (x2 - x1)
  if (Math.abs(cross) > 1e-11) return false
  return x >= Math.min(x1, x2) - 1e-11 && x <= Math.max(x1, x2) + 1e-11
    && y >= Math.min(y1, y2) - 1e-11 && y <= Math.max(y1, y2) + 1e-11
}

function pointInRing(point: Position, ring: Position[]) {
  let inside = false
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const currentPoint = ring[index], previousPoint = ring[previous]
    if (pointOnSegment(point, previousPoint, currentPoint)) return true
    const intersects = (currentPoint[1] > point[1]) !== (previousPoint[1] > point[1])
      && point[0] < ((previousPoint[0] - currentPoint[0]) * (point[1] - currentPoint[1]))
        / (previousPoint[1] - currentPoint[1]) + currentPoint[0]
    if (intersects) inside = !inside
  }
  return inside
}

function pointInPolygon(point: Position, polygon: Position[][]) {
  return polygon.length > 0 && pointInRing(point, polygon[0])
    && !polygon.slice(1).some((hole) => pointInRing(point, hole))
}

function polygons(feature: ProjectFeature): Position[][][] {
  return feature.geometry.type === 'Polygon'
    ? [feature.geometry.coordinates as Position[][]]
    : feature.geometry.coordinates as Position[][][]
}

/** Parsed once at module load; callers must treat the source geometry as read-only. */
export const projectAreaPolygons: readonly Position[][][] = features.flatMap(polygons)

export function isInsideProjectArea(longitude: number, latitude: number): boolean {
  return findProjectPrecinct(longitude, latitude) !== null
}

export function findProjectPrecinct(longitude: number, latitude: number): string | null {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  const point: Position = [longitude, latitude]
  return features.find((feature) => polygons(feature).some((polygon) => pointInPolygon(point, polygon)))?.properties.suburb || null
}

const featureBounds = features.map((feature) => {
  const points = polygons(feature).flat(2) as Position[]
  const longitudes = points.map((point) => point[0]), latitudes = points.map((point) => point[1])
  return { name: feature.properties.suburb, west: Math.min(...longitudes), south: Math.min(...latitudes), east: Math.max(...longitudes), north: Math.max(...latitudes) }
})

export function projectPrecinctsNearViewport(bounds: ViewportBounds, padding = 0.012): string[] {
  return featureBounds.filter((area) => area.east >= bounds.west - padding && area.west <= bounds.east + padding
    && area.north >= bounds.south - padding && area.south <= bounds.north + padding).map((area) => area.name)
}

export function viewportKey(bounds: ViewportBounds, zoom: number) {
  return `${zoom}:${bounds.west.toFixed(5)},${bounds.south.toFixed(5)},${bounds.east.toFixed(5)},${bounds.north.toFixed(5)}`
}
