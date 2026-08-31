import mapView1Raw from './dataset/map_view1.json?raw'
import suburbGeoJsonRaw from './dataset/map_view1_suburbs.geojson?raw'

export type SuburbBiodiversityIndicators = {
  plantSpecies: number
  animalSpecies: number
  pollinatorLinkedPlants: number
  pollinatorInsectSpecies: number
  relevantBirdSpecies: number
  canopyCoverage: number
  plantDensityPerHa: number
  animalDensityPerHa: number
  speciesDensityPerHa: number
}

export type SuburbBiodiversitySummary = SuburbBiodiversityIndicators & {
  precinctId: string
  precinctAreaHa: number
  biodiversityScore: number
  scoreMethod: 'Dataset-provided'
  scoreVersion: string
  corridorCount: number | null
  corridorStatus: string
  isPrototype: false
}

type ProcessedSuburb = {
  precinct_id: string
  suburb: string
  precinct_area_ha: number
  canopy_coverage_pct: number
  plant_species_count: number
  animal_species_count: number
  plant_density_per_ha: number
  animal_density_per_ha: number
  species_density_per_ha: number
  pollinator_flowering_plant_species_count: number
  pollinator_insect_species_count: number
  relevant_bird_species_count: number
  pollination_corridor_count: number | null
  pollination_corridor_status: string
  biodiversity_score_0_100: number
  biodiversity_score_version: string
}

type GeoJsonFeature = {
  type: 'Feature'
  properties: { precinct_id: string; suburb: string }
  geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: unknown[] }
}

const mapView1 = JSON.parse(mapView1Raw) as { suburbs?: ProcessedSuburb[] }
const suburbGeoJson = JSON.parse(suburbGeoJsonRaw) as { features?: GeoJsonFeature[] }

export const normalizeSuburbName = (name: string) => name.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim()

const overviewAliases: Record<string, string> = {
  melbourne: 'Central City',
  'melbourne cbd': 'Central City',
  'north melbourne': 'North and West Melbourne',
  'west melbourne': 'North and West Melbourne',
  'north west melbourne': 'North and West Melbourne',
  'north & west melbourne': 'North and West Melbourne',
  'port melbourne': 'Fishermans Bend',
}

export function resolveOverviewSuburbName(name: string) {
  return overviewAliases[normalizeSuburbName(name)] || name
}

// The detailed prototype currently uses several combined/legacy area keys.
// Keep that compatibility at the navigation boundary without changing its data.
export function resolveDetailedAreaName(name: string) {
  const aliases: Record<string, string> = {
    'North and West Melbourne': 'North & West Melbourne',
  }
  return aliases[name] || name
}

const summaries = new Map((mapView1.suburbs || []).map((row) => {
  const summary: SuburbBiodiversitySummary = {
    precinctId: row.precinct_id,
    precinctAreaHa: row.precinct_area_ha,
    plantSpecies: row.plant_species_count,
    animalSpecies: row.animal_species_count,
    pollinatorLinkedPlants: row.pollinator_flowering_plant_species_count,
    pollinatorInsectSpecies: row.pollinator_insect_species_count,
    relevantBirdSpecies: row.relevant_bird_species_count,
    canopyCoverage: row.canopy_coverage_pct,
    plantDensityPerHa: row.plant_density_per_ha,
    animalDensityPerHa: row.animal_density_per_ha,
    speciesDensityPerHa: row.species_density_per_ha,
    biodiversityScore: row.biodiversity_score_0_100,
    scoreMethod: 'Dataset-provided',
    scoreVersion: row.biodiversity_score_version,
    corridorCount: row.pollination_corridor_count,
    corridorStatus: row.pollination_corridor_status,
    isPrototype: false,
  }
  return [normalizeSuburbName(row.suburb), summary]
}))

const summariesByPrecinctId = new Map([...summaries.values()].map((summary) => [summary.precinctId, summary]))

export function getSuburbBiodiversitySummary(suburb: string): SuburbBiodiversitySummary | null {
  return summaries.get(normalizeSuburbName(resolveOverviewSuburbName(suburb))) || null
}

const swapCoordinateOrder = (coordinates: unknown): unknown => {
  if (Array.isArray(coordinates) && coordinates.length >= 2 && typeof coordinates[0] === 'number' && typeof coordinates[1] === 'number') {
    return [coordinates[1], coordinates[0]]
  }
  return Array.isArray(coordinates) ? coordinates.map(swapCoordinateOrder) : coordinates
}

export const datasetSuburbPolygons = (suburbGeoJson.features || []).map((feature) => ({
  id: feature.properties.precinct_id,
  name: feature.properties.suburb,
  positions: swapCoordinateOrder(feature.geometry.coordinates),
  summary: summariesByPrecinctId.get(feature.properties.precinct_id) || getSuburbBiodiversitySummary(feature.properties.suburb),
}))
