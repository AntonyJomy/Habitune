import type {
  ApiEnvelope,
  ConnectivityData,
  LocationContext,
  SpeciesGroup,
  StreetEcosystemContext,
} from '../types/iteration2'

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

export class ApiRequestError extends Error {
  status: number

  constructor(status: number) {
    super(`Habitune API request failed with HTTP ${status}`)
    this.name = 'ApiRequestError'
    this.status = status
  }
}

async function requestJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  if (!apiBaseUrl) throw new Error('VITE_API_BASE_URL is not configured')
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: { Accept: 'application/json' },
    signal,
  })
  if (!response.ok) throw new ApiRequestError(response.status)
  return response.json() as Promise<T>
}

export async function getLocationContext(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
): Promise<ApiEnvelope<LocationContext | null>> {
  const params = new URLSearchParams({ lat: String(latitude), lng: String(longitude) })
  return requestJson(`/location-context?${params}`, signal)
}

export async function getConnectivity(
  latitude: number | null,
  longitude: number | null,
  speciesGroup: SpeciesGroup,
  precinctId?: string | null,
  signal?: AbortSignal,
): Promise<ApiEnvelope<ConnectivityData>> {
  const params = new URLSearchParams({ species_group: speciesGroup })
  if (latitude != null && longitude != null) {
    params.set('lat', String(latitude))
    params.set('lng', String(longitude))
  }
  if (precinctId) params.set('precinct_id', precinctId)
  return requestJson(`/connectivity?${params}`, signal)
}

export async function getStreetEcosystem(
  streetId: string,
  signal?: AbortSignal,
): Promise<ApiEnvelope<StreetEcosystemContext>> {
  return requestJson(`/streets/${encodeURIComponent(streetId)}/ecosystem`, signal)
}
