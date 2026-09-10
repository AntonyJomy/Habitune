import type { GeoJsonFeatureCollection, PrecinctRecord } from '../data/suburbBiodiversityData'

// The deployed API Gateway URL is injected during the frontend build.
const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

async function requestJson<T>(path: string): Promise<T> {
  if (!apiBaseUrl) throw new Error('VITE_API_BASE_URL is not configured')
  // One helper keeps HTTP behavior and error handling consistent for every endpoint.
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) throw new Error(`Habitune API request failed with HTTP ${response.status}`)
  return response.json() as Promise<T>
}

export async function listPrecincts(): Promise<PrecinctRecord[]> {
  const response = await requestJson<{ data?: PrecinctRecord[] }>('/precincts')
  return Array.isArray(response.data) ? response.data : []
}

export async function getPrecinct(precinctId: string): Promise<PrecinctRecord | null> {
  // Encode path input so spaces and reserved URL characters cannot alter the route.
  const response = await requestJson<{ data?: PrecinctRecord }>(
    `/precincts/${encodeURIComponent(precinctId)}`,
  )
  return response.data || null
}

export async function getPrecinctGeoJson(): Promise<GeoJsonFeatureCollection> {
  return requestJson<GeoJsonFeatureCollection>('/precincts/geojson')
}
