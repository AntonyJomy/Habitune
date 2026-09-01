import type { GeoJsonFeatureCollection, PrecinctRecord } from '../data/suburbBiodiversityData'

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

async function requestJson<T>(path: string): Promise<T> {
  if (!apiBaseUrl) throw new Error('VITE_API_BASE_URL is not configured')
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
  const response = await requestJson<{ data?: PrecinctRecord }>(
    `/precincts/${encodeURIComponent(precinctId)}`,
  )
  return response.data || null
}

export async function getPrecinctGeoJson(): Promise<GeoJsonFeatureCollection> {
  return requestJson<GeoJsonFeatureCollection>('/precincts/geojson')
}
