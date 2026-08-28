// @ts-nocheck
import { locations, suburbPolygons, trees, observations, canopyPolygons, habitatPolygons, ecologicalActivityAreas, pollinationCorridors, suburbBoundary, summary, species } from '../data/mockEcosystemData'

const wait = (value) => Promise.resolve(value)

export async function getSuburbOverview() {
  // Future FastAPI: GET /api/suburbs/ecosystem-overview
  return wait({ locations, polygons: suburbPolygons, isMock: true })
}

export async function getEcosystemContext(location = 'Carlton') {
  // Future FastAPI: GET /api/ecosystem/context?lat={lat}&lng={lng}&radius=500
  const selectedLocation = locations[location] || locations.Carlton
  const [baseLat, baseLng] = locations.Carlton.center
  const [selectedLat, selectedLng] = selectedLocation.center
  const shiftPoint = (point) => Array.isArray(point) && point.length === 2 ? [point[0] + selectedLat - baseLat, point[1] + selectedLng - baseLng] : point
  const shiftFeatures = (features, key) => features.map((feature) => ({ ...feature, [key]: Array.isArray(feature[key]?.[0]) ? feature[key].map(shiftPoint) : shiftPoint(feature[key]) }))
  return wait({
    location: selectedLocation,
    trees: Array.isArray(trees) ? shiftFeatures(trees, 'position') : [],
    observations: Array.isArray(observations) ? shiftFeatures(observations, 'position') : [],
    canopyPolygons: Array.isArray(canopyPolygons) ? shiftFeatures(canopyPolygons, 'positions') : [],
    habitatPolygons: Array.isArray(habitatPolygons) ? shiftFeatures(habitatPolygons, 'positions') : [],
    ecologicalActivityAreas: Array.isArray(ecologicalActivityAreas) ? shiftFeatures(ecologicalActivityAreas, 'center') : [],
    pollinationCorridors: Array.isArray(pollinationCorridors) ? shiftFeatures(pollinationCorridors, 'geometry') : [],
    suburbBoundary: Array.isArray(suburbBoundary) ? suburbBoundary.map(shiftPoint) : [],
    summary: Array.isArray(summary) ? summary : [],
    radius: 500,
    isMock: true,
  })
}

// Future FastAPI map endpoints:
// GET /api/map/trees
// GET /api/map/observations
// GET /api/map/canopy
// GET /api/map/habitats
// GET /api/map/activity-areas
// GET /api/map/pollination-corridors

export async function getSpecies() {
  // Future FastAPI: GET /api/species?lat={lat}&lng={lng}&radius=500
  return wait(Array.isArray(species) ? species : [])
}

export async function getSpeciesById(id) {
  // Future FastAPI: GET /api/species/{id}
  return wait(species.find((item) => item.id === id))
}
