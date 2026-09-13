import { useEffect, useRef, useState } from 'react'
import type { LatLng } from 'leaflet'
import { Popup, useMapEvents } from 'react-leaflet'
import { identifyNatureKitHabitatValue, type NatureKitHabitatValue } from '../services/natureKitApi'
import { isInsideProjectArea } from '../utils/projectAreaGeometry'

type IdentifyState = {
  location: LatLng
  status: 'loading' | 'available' | 'unavailable' | 'error'
  value: NatureKitHabitatValue | null
}

export default function NatureKitHabitatIdentify() {
  const [state, setState] = useState<IdentifyState | null>(null)
  const controllerRef = useRef<AbortController | null>(null)
  const map = useMapEvents({
    click: (event) => {
      controllerRef.current?.abort()
      setState(null)
      if (!isInsideProjectArea(event.latlng.lng, event.latlng.lat)) return
      const controller = new AbortController()
      controllerRef.current = controller
      const bounds = map.getBounds()
      const size = map.getSize()
      const location = event.latlng
      setState({ location, status: 'loading', value: null })
      identifyNatureKitHabitatValue(location.lat, location.lng, {
        west: bounds.getWest(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        north: bounds.getNorth(),
      }, {
        width: size.x,
        height: size.y,
      }, controller.signal)
        .then((value) => {
          if (!controller.signal.aborted) setState({ location, status: value ? 'available' : 'unavailable', value })
        })
        .catch((error) => {
          if (error?.name !== 'AbortError') setState({ location, status: 'error', value: null })
        })
    },
  })

  useEffect(() => () => controllerRef.current?.abort(), [])

  if (!state) return null
  return <Popup key={`${state.location.lat}-${state.location.lng}`} position={state.location}>
    <strong>NatureKit Habitat Value</strong><br />
    {state.status === 'loading' && 'Retrieving rank…'}
    {state.status === 'available' && <>{state.value!.rank} / 100<br /><small>0 is low value; 100 is high value.</small></>}
    {state.status === 'unavailable' && 'No Habitat Value rank is available at this location.'}
    {state.status === 'error' && 'Habitat Value rank could not be retrieved.'}
  </Popup>
}
