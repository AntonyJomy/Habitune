// @ts-nocheck
import { useEffect } from 'react'
import L from 'leaflet'
import { MapContainer, Polygon, TileLayer, Tooltip, useMap } from 'react-leaflet'
import { biodiversityScoreClasses, getBiodiversityScoreColor } from '../config/biodiversityScoreScale'

const precinctLabelAnchors = {
  central_city: [-37.8158, 144.967],
  southbank: [-37.825308, 144.963907],
}

function MapFocus({ selectedArea, searchedLocation }) {
  const map = useMap()
  useEffect(() => {
    if (selectedArea?.positions?.length) {
      const bounds = L.latLngBounds([])
      const extendBounds = (positions) => positions.forEach((position) => {
        if (Array.isArray(position) && Number.isFinite(position[0]) && Number.isFinite(position[1])) bounds.extend(position)
        else if (Array.isArray(position)) extendBounds(position)
      })
      extendBounds(selectedArea.positions)

      if (bounds.isValid()) {
        map.flyToBounds(bounds, { padding: [60, 60], maxZoom: 14, duration: .7 })
        return
      }
    }
    if (Number.isFinite(searchedLocation?.lat) && Number.isFinite(searchedLocation?.lng)) map.flyTo([searchedLocation.lat, searchedLocation.lng], 14, { duration: .7 })
  }, [map, selectedArea?.id, searchedLocation?.lat, searchedLocation?.lng])
  return null
}

export default function SuburbOverviewMap({ suburbs = [], selectedSuburb, searchedLocation, onSelect }) {
  const selectedArea = suburbs.find((suburb) => suburb.name === selectedSuburb)
  return <div className="suburb-map-shell">
    <MapContainer center={[-37.816, 144.958]} zoom={12} minZoom={11} maxZoom={14} scrollWheelZoom className="suburb-overview-map">
      <MapFocus selectedArea={selectedArea} searchedLocation={searchedLocation} />
      <TileLayer className="minimal-basemap" maxZoom={19} attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {suburbs.filter((suburb) => Array.isArray(suburb.positions) && suburb.positions.length > 0).map((suburb) => {
        const isSelected = suburb.name === selectedSuburb
        const score = suburb.summary?.biodiversityScore ?? 0
        const displayScore = suburb.summary ? Math.round(score) : '—'
        const baseStyle = { color: isSelected ? '#124C2E' : '#F8FBF6', fillColor: getBiodiversityScoreColor(score), fillOpacity: .72, weight: isSelected ? 3 : 1.25, lineJoin: 'round' }
        return <Polygon key={suburb.id} positions={suburb.positions} pathOptions={{ ...baseStyle, className: `suburb-polygon${isSelected ? ' selected' : ''}` }} eventHandlers={{ click: () => onSelect(suburb.name, null), mouseover: (event) => event.target.setStyle({ color: isSelected ? '#124C2E' : '#2F7048', fillColor: baseStyle.fillColor, fillOpacity: .75, weight: isSelected ? 3 : 2 }), mouseout: (event) => event.target.setStyle(baseStyle) }}><Tooltip permanent position={precinctLabelAnchors[suburb.id]} direction="center" className={`suburb-label score-badge${isSelected ? ' selected' : ''}`}><strong>{displayScore}</strong><span>{suburb.label || suburb.name}</span></Tooltip></Polygon>
      })}
    </MapContainer>
    <div className="biodiversity-score-legend" aria-label="Provisional biodiversity indicator color scale">
      <strong>Provisional biodiversity indicator</strong>
      <div className="score-legend-steps">{biodiversityScoreClasses.map((scoreClass) => <span key={scoreClass.label} style={{ backgroundColor: scoreClass.color }} title={scoreClass.label}><small>{scoreClass.label}</small></span>)}</div>
      <div className="score-legend-labels"><span>Lower among 10 areas</span><span>Higher among 10 areas</span></div>
    </div>
  </div>
}
