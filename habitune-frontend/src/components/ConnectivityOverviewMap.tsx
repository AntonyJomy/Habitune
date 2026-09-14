import { useEffect, useRef } from 'react'
import { canvas, divIcon } from 'leaflet'
import { Circle, CircleMarker, MapContainer, Marker, Pane, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { hasValidTreeCoordinates, type UrbanForestTree } from '../services/cityTreesApi'
import { getGardenBedRadiusMetres, hasValidGardenBedCoordinates, type GardenBedRecord } from '../services/gardenBedsApi'
import type { StreetPollinatorSupport } from '../types/iteration2'
import NatureKitHabitatOverlay from './NatureKitHabitatOverlay'
import NatureKitHabitatIdentify from './NatureKitHabitatIdentify'
import NatureKitHabitatLegend from './NatureKitHabitatLegend'
import { viewportKey, type ViewportBounds } from '../utils/projectAreaGeometry'

type SearchLocation = { label: string; lat: number; lng: number }

type ConnectivityOverviewMapProps = {
  searchedLocation?: SearchLocation | null
  supportPoints: StreetPollinatorSupport[]
  urbanForestTrees: UrbanForestTree[]
  gardenBeds: GardenBedRecord[]
  selectedStreetId?: string | null
  onSelectStreet: (streetId: string) => void
  onViewportChange: (viewport: { bounds: ViewportBounds; zoom: number; key: string }) => void
}

const treeIcon = divIcon({
  className: 'urban-tree-div-icon',
  html: '<svg viewBox="0 0 32 40" aria-hidden="true"><circle cx="16" cy="12" r="10"/><circle cx="9" cy="18" r="7"/><circle cx="23" cy="18" r="7"/><path d="M13 19h6v17h-6z"/></svg>',
  iconSize: [16, 20],
  iconAnchor: [8, 18],
  popupAnchor: [0, -18],
})

function UrbanForestTreeLayer({ trees }: { trees: UrbanForestTree[] }) {
  return <>{trees.filter(hasValidTreeCoordinates).map((tree) => <Marker
    key={`urban-tree-${tree.com_id}`}
    icon={treeIcon}
    position={[tree.latitude!, tree.longitude!]}
  >
    <Popup>
      <strong>{tree.common_name || 'Urban forest tree'}</strong><br />
      {tree.scientific_name || 'Scientific name unavailable'}<br />
      {tree.projectPrecinct || tree.precinct || 'Precinct unavailable'}
    </Popup>
  </Marker>)}</>
}

function ViewportDataListener({ onChange }: { onChange: ConnectivityOverviewMapProps['onViewportChange'] }) {
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const previousKey = useRef('')
  const map = useMapEvents({ moveend: schedule, zoomend: schedule })

  function schedule() {
    if (timeout.current) clearTimeout(timeout.current)
    timeout.current = setTimeout(() => {
      const leafletBounds = map.getBounds()
      const bounds = { west: leafletBounds.getWest(), south: leafletBounds.getSouth(), east: leafletBounds.getEast(), north: leafletBounds.getNorth() }
      const zoom = map.getZoom(), key = viewportKey(bounds, zoom)
      if (key !== previousKey.current) {
        previousKey.current = key
        onChange({ bounds, zoom, key })
      }
    }, 400)
  }

  useEffect(() => {
    schedule()
    return () => { if (timeout.current) clearTimeout(timeout.current) }
  }, [map])
  return null
}

function ConnectivityFocus({ searchedLocation, selectedStreet }: { searchedLocation?: SearchLocation | null; selectedStreet?: StreetPollinatorSupport | null }) {
  const map = useMap()
  useEffect(() => {
    if (selectedStreet?.centroid) {
      map.flyTo([selectedStreet.centroid.latitude, selectedStreet.centroid.longitude], 17, { duration: 0.7 })
    } else if (Number.isFinite(searchedLocation?.lat) && Number.isFinite(searchedLocation?.lng)) {
      map.flyTo([searchedLocation!.lat, searchedLocation!.lng], 17, { duration: 0.7 })
    }
  }, [map, searchedLocation?.lat, searchedLocation?.lng, selectedStreet?.streetId])
  return null
}

export default function ConnectivityOverviewMap({
  searchedLocation,
  supportPoints,
  urbanForestTrees,
  gardenBeds,
  selectedStreetId,
  onSelectStreet,
  onViewportChange,
}: ConnectivityOverviewMapProps) {
  const selectedStreet = supportPoints.find((point) => point.streetId === selectedStreetId)
  return <div className="connectivity-map-shell">
    <MapContainer center={[-37.816, 144.958]} zoom={12} minZoom={11} maxZoom={22} renderer={canvas({ padding: 0.5 })} scrollWheelZoom className="suburb-overview-map">
      <ConnectivityFocus searchedLocation={searchedLocation} selectedStreet={selectedStreet} />
      <ViewportDataListener onChange={onViewportChange} />
      <TileLayer className="corridor-basemap" maxNativeZoom={19} maxZoom={22} attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Pane name="naturekit-habitat" style={{ zIndex: 350 }}><NatureKitHabitatOverlay /></Pane>
      <NatureKitHabitatIdentify />
      {searchedLocation && <Marker position={[searchedLocation.lat, searchedLocation.lng]}><Popup><strong>Selected location</strong><br />{searchedLocation.label}</Popup></Marker>}
      <Pane name="urban-forest-trees" style={{ zIndex: 620 }}>
        <UrbanForestTreeLayer trees={urbanForestTrees} />
      </Pane>
      <Pane name="garden-bed-areas" style={{ zIndex: 650 }}>
        {gardenBeds.flatMap((bed) => {
          const radius = getGardenBedRadiusMetres(bed)
          if (!hasValidGardenBedCoordinates(bed) || radius == null) return []
          return [<Circle
            key={`garden-bed-${bed.id}`}
            center={[bed.latitude!, bed.longitude!]}
            radius={radius}
            pathOptions={{ color: '#A45B00', weight: 2, fillColor: '#FFD84D', fillOpacity: 0.68 }}
          >
            <Popup>
              <strong>{bed.site || 'City of Melbourne garden bed'}</strong><br />
              {bed.assessedBedType || 'Garden bed type unavailable'}<br />
              {bed.projectPrecinct || bed.neighbourhood || 'Neighbourhood unavailable'}<br />
              Area: {bed.areaM2!.toLocaleString()} m²<br />
              <small>Approximate area representation</small>
            </Popup>
          </Circle>]
        })}
      </Pane>
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
    <NatureKitHabitatLegend />
    {supportPoints.length > 0 && <div className="connectivity-legend" aria-label="Street evidence marker legend">
      <strong>Street vegetation evidence</strong>
      <span><i style={{ background: '#4F8062' }} /> Street centroid</span>
      <small>Uniform markers · no connectivity score or corridor geometry</small>
    </div>}
  </div>
}
