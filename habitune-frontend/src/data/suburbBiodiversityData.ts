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

export type PrecinctRecord = {
  precinct_id: string
  name: string
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

export type GeoJsonFeature = {
  type: 'Feature'
  id?: string
  properties: PrecinctRecord
  geometry: { type: 'MultiPolygon'; coordinates: unknown[] }
}

export type GeoJsonFeatureCollection = {
  type: 'FeatureCollection'
  features?: GeoJsonFeature[]
}

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

export function resolveDetailedAreaName(name: string) {
  const aliases: Record<string, string> = {
    'North and West Melbourne': 'North & West Melbourne',
  }
  return aliases[name] || name
}

export function toSuburbBiodiversitySummary(row: PrecinctRecord): SuburbBiodiversitySummary {
  return {
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
}

const swapCoordinateOrder = (coordinates: unknown): unknown => {
  if (Array.isArray(coordinates) && coordinates.length >= 2 && typeof coordinates[0] === 'number' && typeof coordinates[1] === 'number') {
    return [coordinates[1], coordinates[0]]
  }
  return Array.isArray(coordinates) ? coordinates.map(swapCoordinateOrder) : coordinates
}

export function buildSuburbPolygons(
  precincts: PrecinctRecord[],
  geoJson: GeoJsonFeatureCollection,
) {
  const records = new Map(precincts.map((record) => [record.precinct_id, record]))
  return (geoJson.features || []).flatMap((feature) => {
    const precinctId = feature.properties.precinct_id || feature.id
    const record = precinctId ? records.get(precinctId) : undefined
    if (!record) return []
    return [{
      id: record.precinct_id,
      name: record.name,
      positions: swapCoordinateOrder(feature.geometry.coordinates),
      summary: toSuburbBiodiversitySummary(record),
    }]
  })
}
