import { useEffect } from 'react'
import { CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import type { StreetPollinatorSupport } from '../types/iteration2'

type SearchLocation = { label: string; lat: number; lng: number }

type ConnectivityOverviewMapProps = {
  searchedLocation?: SearchLocation | null
  supportPoints: StreetPollinatorSupport[]
  selectedStreetId?: string | null
  onSelectStreet: (streetId: string) => void
}

function ConnectivityFocus({ searchedLocation, selectedStreet }: { searchedLocation?: SearchLocation | null; selectedStreet?: StreetPollinatorSupport | null }) {
  const map = useMap()
  useEffect(() => {
    if (selectedStreet?.centroid) {
      map.flyTo([selectedStreet.centroid.latitude, selectedStreet.centroid.longitude], 16, { duration: 0.7 })
    } else if (Number.isFinite(searchedLocation?.lat) && Number.isFinite(searchedLocation?.lng)) {
      map.flyTo([searchedLocation!.lat, searchedLocation!.lng], 15, { duration: 0.7 })
    }
  }, [map, searchedLocation?.lat, searchedLocation?.lng, selectedStreet?.streetId])
  return null
}

export default function ConnectivityOverviewMap({
  searchedLocation,
  supportPoints,
  selectedStreetId,
  onSelectStreet,
}: ConnectivityOverviewMapProps) {
  const selectedStreet = supportPoints.find((point) => point.streetId === selectedStreetId)
  return <div className="connectivity-map-shell">
    <MapContainer center={[-37.816, 144.958]} zoom={12} minZoom={11} maxZoom={18} scrollWheelZoom className="suburb-overview-map">
      <ConnectivityFocus searchedLocation={searchedLocation} selectedStreet={selectedStreet} />
      <TileLayer maxZoom={19} attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {searchedLocation && <Marker position={[searchedLocation.lat, searchedLocation.lng]}><Popup><strong>Selected location</strong><br />{searchedLocation.label}</Popup></Marker>}
      {supportPoints.flatMap((point) => point.centroid ? [<CircleMarker
        key={point.streetId}
        center={[point.centroid.latitude, point.centroid.longitude]}
        radius={point.streetId === selectedStreetId ? 9 : 6}
        eventHandlers={{ click: () => onSelectStreet(point.streetId) }}
        pathOptions={{
          color: point.streetId === selectedStreetId ? '#123C2B' : '#ffffff',
          weight: point.streetId === selectedStreetId ? 3 : 1.5,
          fillColor: '#4F8062',
          fillOpacity: 0.82,
        }}
      ><Popup><strong>{point.streetName}</strong><br />Street centroid · select to view recorded vegetation evidence</Popup></CircleMarker>] : [])}
    </MapContainer>
    {supportPoints.length > 0 && <div className="connectivity-legend" aria-label="Street evidence marker legend">
      <strong>Street vegetation evidence</strong>
      <span><i style={{ background: '#4F8062' }} /> Street centroid</span>
      <small>Uniform markers · no connectivity score or corridor geometry</small>
    </div>}
  </div>
}
