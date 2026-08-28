// @ts-nocheck
import { MapContainer, Polygon, TileLayer, Tooltip } from 'react-leaflet'

export default function SuburbOverviewMap({ suburbs = [], selectedSuburb, onSelect }) {
  return <div className="suburb-map-shell">
    <MapContainer center={[-37.816, 144.958]} zoom={13} minZoom={12} maxZoom={14} scrollWheelZoom className="suburb-overview-map">
      <TileLayer className="minimal-basemap" maxZoom={19} attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {suburbs.filter((suburb) => Array.isArray(suburb.positions) && suburb.positions.length >= 3).map((suburb) => {
        const isSelected = suburb.name === selectedSuburb
        const baseStyle = { color: isSelected ? '#164f35' : '#f8fbf6', fillColor: isSelected ? '#4f9365' : '#91b88c', fillOpacity: isSelected ? .72 : .45, weight: isSelected ? 3 : 1.5, lineJoin: 'round' }
        return <Polygon key={suburb.id} positions={suburb.positions} pathOptions={{ ...baseStyle, className: `suburb-polygon${isSelected ? ' selected' : ''}` }} eventHandlers={{ click: () => onSelect(suburb.name), mouseover: (event) => event.target.setStyle({ fillOpacity: .72, weight: isSelected ? 3 : 2.4 }), mouseout: (event) => event.target.setStyle(baseStyle) }}><Tooltip permanent direction="center" className={`suburb-label${isSelected ? ' selected' : ''}`}>{suburb.label || suburb.name}</Tooltip></Polygon>
      })}
    </MapContainer>
  </div>
}
