import { useCallback, useEffect, useState } from 'react'
import L, { type LatLngBounds } from 'leaflet'
import { SVGOverlay, useMapEvents } from 'react-leaflet'
import { buildNatureKitHabitatExportUrl } from '../services/natureKitApi'
import { projectAreaPolygons } from '../utils/projectAreaGeometry'

type OverlayRequest = {
  bounds: LatLngBounds
  url: string
  clipPath: string
}

function buildClipPath(bounds: LatLngBounds, crs: L.CRS) {
  const southWest = crs.project(bounds.getSouthWest())
  const northEast = crs.project(bounds.getNorthEast())
  const width = northEast.x - southWest.x
  const height = northEast.y - southWest.y
  return projectAreaPolygons.flatMap((polygon) => polygon.map((ring) => ring.map(([longitude, latitude], index) => {
    const point = crs.project(L.latLng(latitude, longitude))
    const x = (point.x - southWest.x) / width
    const y = (northEast.y - point.y) / height
    return `${index === 0 ? 'M' : 'L'}${x} ${y}`
  }).join(' ') + ' Z')).join(' ')
}

export default function NatureKitHabitatOverlay() {
  const [request, setRequest] = useState<OverlayRequest | null>(null)
  const map = useMapEvents({
    moveend: () => refresh(),
    zoomend: () => refresh(),
    resize: () => refresh(),
  })

  const refresh = useCallback(() => {
    const bounds = map.getBounds()
    const crs = map.options.crs ?? L.CRS.EPSG3857
    const southWest = crs.project(bounds.getSouthWest())
    const northEast = crs.project(bounds.getNorthEast())
    const size = map.getSize()
    const url = buildNatureKitHabitatExportUrl({
      west: southWest.x,
      south: southWest.y,
      east: northEast.x,
      north: northEast.y,
    }, {
      width: size.x,
      height: size.y,
    })
    const clipPath = buildClipPath(bounds, crs)
    setRequest((current) => current?.url === url ? current : { bounds, url, clipPath })
  }, [map])

  useEffect(() => refresh(), [refresh])

  if (!request) return null
  return <SVGOverlay
    bounds={request.bounds}
    opacity={0.4}
    interactive={false}
    attributes={{ 'aria-hidden': 'true', viewBox: '0 0 1 1', preserveAspectRatio: 'none' }}
  >
    <defs>
      <clipPath id="naturekit-project-area-clip" clipPathUnits="objectBoundingBox">
        <path d={request.clipPath} fillRule="evenodd" clipRule="evenodd" />
      </clipPath>
    </defs>
    <image
      href={request.url}
      x="0"
      y="0"
      width="100%"
      height="100%"
      preserveAspectRatio="none"
      clipPath="url(#naturekit-project-area-clip)"
      onError={() => {
        if (import.meta.env.DEV) console.error('NatureKit Habitat Value overlay could not be loaded')
      }}
    />
  </SVGOverlay>
}
