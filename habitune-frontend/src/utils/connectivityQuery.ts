import type { SpeciesGroup } from '../types/iteration2'

export type SearchLocation = { label: string; lat: number; lng: number }

export const validSpeciesGroups = new Set<SpeciesGroup>(['native_bee', 'butterfly', 'small_bird'])

export function readSearchLocation(params: URLSearchParams): SearchLocation | null {
  if (!params.has('lat') || !params.has('lng')) return null
  const latitude = Number(params.get('lat'))
  const longitude = Number(params.get('lng'))
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) return null
  return { lat: latitude, lng: longitude, label: params.get('label')?.trim() || 'Selected location' }
}

export function setSearchLocation(params: URLSearchParams, location: SearchLocation | null) {
  if (!location) {
    params.delete('lat')
    params.delete('lng')
    params.delete('label')
    return
  }
  params.set('lat', String(location.lat))
  params.set('lng', String(location.lng))
  if (location.label.trim()) params.set('label', location.label.trim())
  else params.delete('label')
}

export function removeInvalidLocationParams(params: URLSearchParams) {
  const hasAnyLocationPart = params.has('lat') || params.has('lng') || params.has('label')
  if (hasAnyLocationPart && !readSearchLocation(params)) setSearchLocation(params, null)
}

export function readSpeciesGroup(params: URLSearchParams): SpeciesGroup {
  const requested = params.get('species') as SpeciesGroup | null
  return requested && validSpeciesGroups.has(requested) ? requested : 'native_bee'
}
