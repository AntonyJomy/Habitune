import { memo, useEffect, useMemo, useRef } from 'react'
import L, { canvas } from 'leaflet'
import { Circle, CircleMarker, MapContainer, Marker, Pane, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { hasValidTreeCoordinates, type UrbanForestTree } from '../services/cityTreesApi'
import { getGardenBedRadiusMetres, hasValidGardenBedCoordinates, type GardenBedRecord } from '../services/gardenBedsApi'
import type { StreetPollinatorSupport } from '../types/iteration2'
import NatureKitHabitatOverlay from './NatureKitHabitatOverlay'
import NatureKitHabitatIdentify from './NatureKitHabitatIdentify'
import NatureKitHabitatLegend from './NatureKitHabitatLegend'
import MapIconLegend from './MapIconLegend'
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

const locationEvidenceZoom = 18
const searchedLocationIcon = L.divIcon({
  className: 'searched-location-div-icon',
  html: '<svg viewBox="0 0 32 42" aria-hidden="true"><path d="M16 40C12 34 4 25 4 16a12 12 0 1 1 24 0c0 9-8 18-12 24Z" fill="#17633f" stroke="#fff" stroke-width="2"/><circle cx="16" cy="16" r="5" fill="#fff"/></svg>',
  iconSize: [32, 42],
  iconAnchor: [16, 40],
  popupAnchor: [0, -38],
})

const UrbanForestTreeLayer = memo(function UrbanForestTreeLayer({ trees }: { trees: UrbanForestTree[] }) {
  const validTrees = useMemo(() => trees.filter(hasValidTreeCoordinates), [trees])
  const map = useMap()

  useEffect(() => {
    const pane = map.getPane('urban-forest-trees')
    if (!pane) return undefined

    const iconCanvas = L.DomUtil.create('canvas', 'urban-tree-canvas-layer', pane)
    iconCanvas.style.pointerEvents = 'none'
    const hitPoints: Array<{ point: L.Point; tree: UrbanForestTree }> = []

    const drawTree = (context: CanvasRenderingContext2D, x: number, y: number) => {
      context.save()
      context.translate(x, y)
      context.fillStyle = '#754C29'
      context.fillRect(-1.5, -1, 3, 8)
      context.fillStyle = '#236B45'
      context.beginPath()
      context.arc(0, -7, 5.5, 0, Math.PI * 2)
      context.arc(-4, -3, 4.5, 0, Math.PI * 2)
      context.arc(4, -3, 4.5, 0, Math.PI * 2)
      context.fill()
      context.restore()
    }

    const redraw = () => {
      const size = map.getSize()
      const ratio = window.devicePixelRatio || 1
      const topLeft = map.containerPointToLayerPoint([0, 0])
      L.DomUtil.setPosition(iconCanvas, topLeft)
      iconCanvas.style.width = `${size.x}px`
      iconCanvas.style.height = `${size.y}px`
      iconCanvas.width = Math.round(size.x * ratio)
      iconCanvas.height = Math.round(size.y * ratio)
      const context = iconCanvas.getContext('2d')
      if (!context) return
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      context.clearRect(0, 0, size.x, size.y)
      hitPoints.length = 0
      validTrees.forEach((tree) => {
        const point = map.latLngToContainerPoint([tree.latitude!, tree.longitude!])
        if (point.x < -12 || point.y < -16 || point.x > size.x + 12 || point.y > size.y + 16) return
        drawTree(context, point.x, point.y)
        hitPoints.push({ point, tree })
      })
    }

    const openTreePopup = (event: MouseEvent) => {
      const mapBounds = map.getContainer().getBoundingClientRect()
      const point = L.point(event.clientX - mapBounds.left, event.clientY - mapBounds.top)
      let nearest: { point: L.Point; tree: UrbanForestTree } | undefined
      // Keep the painted icon compact while providing a comfortable click target.
      let nearestDistance = 15
      hitPoints.forEach((candidate) => {
        const distance = point.distanceTo(candidate.point)
        if (distance < nearestDistance) {
          nearest = candidate
          nearestDistance = distance
        }
      })
      if (!nearest) return
      const popupContent = document.createElement('div')
      const title = document.createElement('strong')
      title.textContent = nearest.tree.common_name || 'Urban forest tree'
      popupContent.append(title, document.createElement('br'))
      popupContent.append(nearest.tree.scientific_name || 'Scientific name unavailable', document.createElement('br'))
      popupContent.append(nearest.tree.projectPrecinct || nearest.tree.precinct || 'Precinct unavailable')
      const selectedTree = nearest.tree
      // Leaflet also handles the originating map click and may close an open
      // popup. Open this popup on the next task so it wins after that handling.
      window.setTimeout(() => {
        L.popup()
          .setLatLng([selectedTree.latitude!, selectedTree.longitude!])
          .setContent(popupContent)
          .openOn(map)
      }, 0)
    }

    map.on('moveend zoomend resize viewreset', redraw)
    // Capture clicks before overlapping Leaflet vector layers consume them.
    map.getContainer().addEventListener('click', openTreePopup, true)
    redraw()
    return () => {
      map.off('moveend zoomend resize viewreset', redraw)
      map.getContainer().removeEventListener('click', openTreePopup, true)
      iconCanvas.remove()
    }
  }, [map, validTrees])

  return null
})

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
    // Keep the location chosen by the user at the centre. The API also returns
    // the nearest supported street, but its centroid may be some distance away.
    if (Number.isFinite(searchedLocation?.lat) && Number.isFinite(searchedLocation?.lng)) {
      map.flyTo([searchedLocation!.lat, searchedLocation!.lng], locationEvidenceZoom, { duration: 0.7 })
    } else if (selectedStreet?.centroid) {
      map.flyTo([selectedStreet.centroid.latitude, selectedStreet.centroid.longitude], locationEvidenceZoom, { duration: 0.7 })
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
      {searchedLocation && <Marker position={[searchedLocation.lat, searchedLocation.lng]} icon={searchedLocationIcon}><Popup><strong>Selected location</strong><br />{searchedLocation.label}</Popup></Marker>}
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
    <MapIconLegend
      showSearchedLocation={Boolean(searchedLocation)}
      showTrees={urbanForestTrees.length > 0}
      showGardenBeds={gardenBeds.length > 0}
      showStreetEvidence={supportPoints.length > 0}
    />
  </div>
}
