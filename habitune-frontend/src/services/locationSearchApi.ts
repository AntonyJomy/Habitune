// @ts-nocheck
import { locations } from '../data/mockEcosystemData'
import { datasetSuburbPolygons } from '../data/suburbBiodiversityData'

const suburbEntries = [
  ['Carlton', 'Carlton VIC 3053', ['3053']], ['Parkville', 'Parkville VIC 3052', ['3052']],
  ['Kensington', 'Kensington VIC 3031', ['3031']], ['North and West Melbourne', 'North and West Melbourne VIC', ['3003', '3051']],
  ['Docklands', 'Docklands VIC 3008', ['3008']], ['Central City', 'Melbourne VIC 3000', ['3000']],
  ['East Melbourne', 'East Melbourne VIC 3002', ['3002']], ['Southbank', 'Southbank VIC 3006', ['3006']],
  ['South Yarra', 'South Yarra VIC 3141', ['3141']], ['Fishermans Bend', 'Fishermans Bend VIC 3207', ['3207']],
].map(([name, secondary, postcodes]) => ({ primary: name, secondary, type: 'Suburb', suburb: name, postcodes, searchedLocation: null }))

const knownPlaces = [
  { primary: 'Lygon Street', secondary: 'Carlton VIC', type: 'Street', suburb: 'Carlton', lat: -37.8001, lng: 144.9672 },
  { primary: 'Swanston Street', secondary: 'Carlton VIC', type: 'Street', suburb: 'Carlton', lat: -37.8012, lng: 144.9632 },
  { primary: '123 Lygon Street', secondary: 'Carlton VIC 3053', type: 'Address', suburb: 'Carlton', lat: -37.8035, lng: 144.9672 },
  { primary: '200 Lygon Street', secondary: 'Carlton VIC 3053', type: 'Address', suburb: 'Carlton', lat: -37.8004, lng: 144.9671 },
  { primary: 'Carlton Gardens', secondary: 'Carlton VIC 3053', type: 'Landmark', suburb: 'Carlton', lat: -37.8053, lng: 144.9715 },
].map((place) => ({ ...place, searchedLocation: { label: `${place.primary}, ${place.secondary}`, lat: place.lat, lng: place.lng } }))

const catalog = [...suburbEntries, ...knownPlaces]
const geocodeCache = new Map()
const normalize = (value) => value.trim().toLowerCase()

export function getLocationSuggestions(query) {
  const term = normalize(query)
  if (!term) return []
  return catalog.filter((entry) => entry.primary.toLowerCase().includes(term) || entry.secondary.toLowerCase().includes(term) || entry.postcodes?.some((postcode) => postcode.startsWith(term))).slice(0, 6)
}

function pointInPolygon([lat, lng], polygon) {
  let inside = false
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const [latA, lngA] = polygon[index]
    const [latB, lngB] = polygon[previous]
    if ((latA > lat) !== (latB > lat) && lng < ((lngB - lngA) * (lat - latA)) / (latB - latA) + lngA) inside = !inside
  }
  return inside
}

function pointInPolygonWithHoles(point, rings) {
  return Array.isArray(rings?.[0]) && pointInPolygon(point, rings[0]) && !rings.slice(1).some((ring) => pointInPolygon(point, ring))
}

function pointInPrecinct(point, positions) {
  if (!Array.isArray(positions?.[0]?.[0])) return false
  const isPolygon = typeof positions[0][0][0] === 'number'
  return isPolygon ? pointInPolygonWithHoles(point, positions) : positions.some((polygon) => pointInPolygonWithHoles(point, polygon))
}

function findSupportedSuburb(lat, lng, displayName = '') {
  const byPolygon = datasetSuburbPolygons.find((suburb) => pointInPrecinct([lat, lng], suburb.positions))
  if (byPolygon) return byPolygon.name
  const normalizedName = displayName.toLowerCase()
  return Object.keys(locations).find((name) => normalizedName.includes(name.toLowerCase())) || null
}

export async function resolveLocation(query) {
  const term = normalize(query)
  const exact = catalog.find((entry) => entry.primary.toLowerCase() === term || entry.postcodes?.includes(term))
  if (exact) return { status: 'supported', suburb: exact.suburb, searchedLocation: exact.searchedLocation }
  if (geocodeCache.has(term)) return geocodeCache.get(term)

  try {
    const params = new URLSearchParams({ q: `${query}, Melbourne VIC, Australia`, format: 'jsonv2', limit: '5', countrycodes: 'au', 'accept-language': 'en' })
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`)
    if (!response.ok) throw new Error('Geocoding request failed')
    const results = await response.json()
    if (!Array.isArray(results) || results.length === 0) return { status: 'not-found' }
    for (const result of results) {
      const lat = Number(result.lat)
      const lng = Number(result.lon)
      const suburb = findSupportedSuburb(lat, lng, result.display_name || '')
      if (suburb) {
        const resolved = { status: 'supported', suburb, searchedLocation: { label: result.display_name, lat, lng } }
        geocodeCache.set(term, resolved)
        return resolved
      }
    }
    const outside = { status: 'outside' }
    geocodeCache.set(term, outside)
    return outside
  } catch {
    return { status: 'unavailable' }
  }
}
