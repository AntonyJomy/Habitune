export type SpeciesGroup = 'native_bee' | 'butterfly' | 'small_bird'

export type DataAvailability = 'idle' | 'loading' | 'available' | 'empty' | 'unavailable' | 'not_found' | 'error'

export type GeoJsonGeometry = {
  type: 'Point' | 'LineString' | 'Polygon' | 'MultiLineString' | 'MultiPolygon'
  coordinates: unknown[]
}

export interface LocationContext {
  contextId?: string | null
  precinctId?: string | null
  precinctName?: string | null
  streetId?: string | null
  streetKey?: string | null
  sourceStreetId?: string | null
  streetName?: string | null
  resolutionMethod?: string | null
  matchedAddress?: string | null
  distanceToAddressM?: number | null
  label?: string | null
  latitude: number
  longitude: number
  geometry?: GeoJsonGeometry | null
}

export interface HabitatFeature {
  id: string
  kind: 'tree' | 'canopy' | 'garden' | 'vegetation' | 'other'
  label: string
  evidenceSource?: string | null
  geometry?: GeoJsonGeometry | null
}

export interface NearbyObservation {
  id: string
  speciesGroup: SpeciesGroup
  scientificName?: string | null
  commonName?: string | null
  occurrenceCount?: number | null
  observedAt?: string | null
  geometry?: GeoJsonGeometry | null
}

export interface ConnectivityGap {
  id: string
  label: string
  explanation: string
  severity?: 'potential' | 'unknown'
  geometry?: GeoJsonGeometry | null
}

export interface PotentialConnectivity {
  id: string
  speciesGroup: SpeciesGroup
  status: 'not_available' | 'provisional'
  supportLevel?: 'strong' | 'moderate' | 'potential_gap' | null
  explanation?: string | null
  geometry?: GeoJsonGeometry | null
  gaps: ConnectivityGap[]
}

export interface StreetPollinatorSupport {
  streetId: string
  streetKey?: string | null
  streetName: string
  precinctId?: string | null
  nearbyCanopyAreaM2?: number | null
  geometry?: GeoJsonGeometry | null
  centroid?: { latitude: number; longitude: number } | null
  sourceStreetId?: string | null
  addressCount?: number | null
  plantedTreeCount?: number | null
  plantedTreeSpeciesCount?: number | null
  gardenPlantRowCount?: number | null
  gardenPlantSpeciesCount?: number | null
  plantSpeciesCount?: number | null
  pollinatorFloweringPlantSpeciesCount?: number | null
  nearbyCanopyPolygonCount?: number | null
}

export interface ConnectivityData {
  context: LocationContext | null
  supportRecords: StreetPollinatorSupport[]
  connectivity: PotentialConnectivity[]
  connectivityStatus: 'not_modelled'
}

export interface StreetEcosystemContext {
  streetId: string
  streetKey?: string | null
  sourceStreetId?: string | null
  precinctId?: string | null
  streetName?: string | null
  centroid?: { latitude: number; longitude: number } | null
  evidence?: StreetEcosystemEvidence | null
  location?: LocationContext | null
  speciesGroup?: SpeciesGroup | null
  habitatFeatures: HabitatFeature[]
  nearbyObservations: NearbyObservation[]
  potentialConnectivity?: PotentialConnectivity | null
  support?: StreetPollinatorSupport | null
  status: 'not_available' | 'available'
  message?: string | null
}

export interface StreetEcosystemEvidence {
  addressCount: number | null
  plantedTreeCount: number | null
  plantedTreeSpeciesCount: number | null
  gardenPlantRowCount: number | null
  gardenPlantSpeciesCount: number | null
  plantSpeciesCount: number | null
  pollinatorFloweringPlantSpeciesCount: number | null
  nearbyCanopyAreaM2: number | null
  nearbyCanopyPolygonCount: number | null
}

export interface ApiEnvelope<T> {
  data: T
  meta?: {
    source?: string
    status?: string
    methodVersion?: string | null
    geometryStatus?: string
    resolutionSourceFile?: string | null
    streetSourceFile?: string | null
    sourceFile?: string | null
    assignmentMethod?: string | null
    maximumAssignmentDistanceM?: number | null
    canopyMetricNote?: string | null
    connectivityStatus?: 'not_modelled'
  }
}
