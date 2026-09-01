// @ts-nocheck
import { locations } from '../data/mockEcosystemData'

const postcodesByPrecinct = {
  Carlton: ['3053'], Parkville: ['3052'], Kensington: ['3031'],
  'North and West Melbourne': ['3003', '3051'], Docklands: ['3008'],
  'Central City': ['3000'], 'East Melbourne': ['3002'], Southbank: ['3006'],
  'South Yarra': ['3141'], 'Fishermans Bend': ['3207'],
}

const knownPlaces = [
  { primary: 'Lygon Street', secondary: 'Carlton VIC', type: 'Street', suburb: 'Carlton', lat: -37.8001, lng: 144.9672 },
  { primary: 'Swanston Street', secondary: 'Carlton VIC', type: 'Street', suburb: 'Carlton', lat: -37.8012, lng: 144.9632 },
  { primary: '123 Lygon Street', secondary: 'Carlton VIC 3053', type: 'Address', suburb: 'Carlton', lat: -37.8035, lng: 144.9672 },
  { primary: '200 Lygon Street', secondary: 'Carlton VIC 3053', type: 'Address', suburb: 'Carlton', lat: -37.8004, lng: 144.9671 },
  { primary: 'Carlton Gardens', secondary: 'Carlton VIC 3053', type: 'Landmark', suburb: 'Carlton', lat: -37.8053, lng: 144.9715 },
].map((place) => ({ ...place, searchedLocation: { label: `${place.primary}, ${place.secondary}`, lat: place.lat, lng: place.lng } }))

const geocodeCache = new Map()
const normalize = (value) => value.trim().toLowerCase()

const buildCatalog = (precincts) => [
  ...precincts.map((precinct) => {
    const postcodes = postcodesByPrecinct[precinct.name] || []
    return {
      primary: precinct.name,
      secondary: `${precinct.name} VIC${postcodes[0] ? ` ${postcodes[0]}` : ''}`,
      type: 'Suburb',
      suburb: precinct.name,
      postcodes,
      searchedLocation: null,
    }
  }),
  ...knownPlaces,
]

export function getLocationSuggestions(query, precincts = []) {
  const term = normalize(query)
  if (!term) return []
  const catalog = buildCatalog(precincts)
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

function findSupportedSuburb(lat, lng, displayName = '', precincts = []) {
  const byPolygon = precincts.find((suburb) => pointInPrecinct([lat, lng], suburb.positions))
  if (byPolygon) return byPolygon.name
  const normalizedName = displayName.toLowerCase()
  return Object.keys(locations).find((name) => normalizedName.includes(name.toLowerCase())) || null
}

export async function resolveLocation(query, precincts = []) {
  const term = normalize(query)
  const catalog = buildCatalog(precincts)
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
      const suburb = findSupportedSuburb(lat, lng, result.display_name || '', precincts)
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
