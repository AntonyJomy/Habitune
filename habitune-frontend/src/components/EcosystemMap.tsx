// @ts-nocheck
import { Component, useEffect, useState } from 'react'
import L from 'leaflet'
import { renderToStaticMarkup } from 'react-dom/server'
import { Circle, MapContainer, Marker, Polygon, Polyline, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import MapLegend from './MapLegend'
import LayerControl from './LayerControl'
import BiodiversityIcon from './BiodiversityIcon'
import { getBiodiversityCategory } from '../config/biodiversityCategories'
import { findSpeciesVisualByScientificName } from '../config/speciesVisuals'
import PollinatorDetails from './PollinatorDetails'
import { MapPin } from 'lucide-react'

const markerIcon = (kind, selected = false, illustrationType = null) => {
  const category = getBiodiversityCategory(kind)
  const isSpecies = Boolean(illustrationType)
  const svg = renderToStaticMarkup(<BiodiversityIcon type={illustrationType || kind} size={isSpecies ? 35 : 24} variant={isSpecies ? 'species' : 'marker'} />)
  const badgeSize = isSpecies ? 44 : 34
  return L.divIcon({
    className: 'custom-marker-wrap',
    html: `<span class="map-marker-badge${isSpecies ? ' species-marker' : ''}${selected ? ' selected' : ''}" style="color:${category.color}">${svg}</span>`,
    iconSize: [badgeSize, badgeSize],
    iconAnchor: [badgeSize / 2, badgeSize / 2],
    popupAnchor: [0, -(badgeSize / 2 - 2)],
  })
}

const searchedLocationIcon = L.divIcon({
  className: 'searched-location-marker',
  html: renderToStaticMarkup(<span><MapPin size={20} strokeWidth={2.5} /></span>),
  iconSize: [32, 32],
  iconAnchor: [16, 28],
  popupAnchor: [0, -25],
})

class MapErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false } }
  static getDerivedStateFromError() { return { hasError: true } }
  componentDidCatch(error) { console.error('Habitune map failed to render:', error) }
  render() {
    if (this.state.hasError) return <div className="map-error" role="alert"><strong>Map temporarily unavailable</strong><p>The ecosystem summary and records are still available below.</p></div>
    return this.props.children
  }
}

function MapLayoutFix() {
  const map = useMap()
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => map.invalidateSize())
    return () => window.cancelAnimationFrame(frame)
  }, [map])
  return null
}

function MapZoomObserver({ onZoomChange }) {
  const map = useMapEvents({ zoomend: () => onZoomChange(map.getZoom()) })
  return null
}

const activityStyles = {
  pollinator: { color: '#d99a22', fillColor: '#efbd52' },
  bird: { color: '#4b91be', fillColor: '#8fc8e6' },
  wildlife: { color: '#8661a8', fillColor: '#bba2d2' },
  flora: { color: '#66a83e', fillColor: '#9bcf77' },
}

const corridorColors = { high: '#d58a12', medium: '#e4a936', low: '#efc56e' }
const titleCase = (value = '') => value.charAt(0).toUpperCase() + value.slice(1)
const corridorPathOptions = (corridor, showStreetDetail) => ({
  className: `pollination-corridor corridor-${corridor.status} corridor-${corridor.quality}`,
  color: corridorColors[corridor.quality] || corridorColors.low,
  weight: showStreetDetail ? 3.5 : 4.5,
  opacity: corridor.quality === 'low' ? .62 : .74,
  dashArray: corridor.status === 'potential' ? '3 9' : corridor.quality === 'medium' ? '14 5' : undefined,
  lineCap: 'round',
  lineJoin: 'round',
})

export default function EcosystemMap({ data, searchedLocation }) {
  const [layers, setLayers] = useState({ trees: true, flora: false, pollinators: true, birds: true, wildlife: true, canopy: false, habitats: false, corridors: true })
  const [pollinatorFilters, setPollinatorFilters] = useState({ nativeBees: true, butterfliesMoths: true, hoverflies: true, otherPollinators: true })
  const [zoom, setZoom] = useState(15)
  const [selectedMarker, setSelectedMarker] = useState(null)
  const toggle = (key) => setLayers((current) => ({ ...current, [key]: !current[key] }))
  const togglePollinatorFilter = (key) => setPollinatorFilters((current) => ({ ...current, [key]: !current[key] }))
  const hasSearchedLocation = Number.isFinite(searchedLocation?.lat) && Number.isFinite(searchedLocation?.lng)
  const center = hasSearchedLocation ? [searchedLocation.lat, searchedLocation.lng] : Array.isArray(data?.location?.center) && data.location.center.length === 2 ? data.location.center : [-37.8004, 144.9671]
  const trees = Array.isArray(data?.trees) ? data.trees : []
  const observations = Array.isArray(data?.observations) ? data.observations : []
  const canopyPolygons = Array.isArray(data?.canopyPolygons) ? data.canopyPolygons : []
  const habitatPolygons = Array.isArray(data?.habitatPolygons) ? data.habitatPolygons : []
  const ecologicalActivityAreas = Array.isArray(data?.ecologicalActivityAreas) ? data.ecologicalActivityAreas : []
  const pollinationCorridors = Array.isArray(data?.pollinationCorridors) ? data.pollinationCorridors : []
  const suburbBoundary = Array.isArray(data?.suburbBoundary) ? data.suburbBoundary : []
  const showStreetDetail = zoom >= 14
  const observationById = new Map(observations.map((observation) => [observation.id, observation]))
  const observationCategory = (item) => item.kind === 'flora' ? 'flora' : item.kind === 'wildlife' ? 'wildlife' : item.pollinatorGroup ? 'pollinator' : 'bird'
  const categoryIsVisible = (category, item) => {
    if (category === 'pollinator') return layers.pollinators && pollinatorFilters[item?.pollinatorGroup]
    return layers[category === 'bird' ? 'birds' : category]
  }
  const canopyStyle = getBiodiversityCategory('canopy')
  const habitatStyle = getBiodiversityCategory('habitat')
  return <div className="map-shell">
    <MapErrorBoundary>
      <MapContainer center={center} zoom={hasSearchedLocation ? 17 : 15} scrollWheelZoom className="ecosystem-map">
        <MapLayoutFix />
        <MapZoomObserver onZoomChange={setZoom} />
        <TileLayer className="minimal-basemap" maxZoom={19} attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {hasSearchedLocation && <Marker position={center} icon={searchedLocationIcon} zIndexOffset={1200}><Popup className="habitune-popup"><div className="popup-card"><span className="popup-category location">Searched location</span><strong>{searchedLocation.label}</strong><p>Initial map focus within {data.location.name}.</p></div></Popup></Marker>}
        {!showStreetDetail && suburbBoundary.length >= 3 && <Polygon positions={suburbBoundary} interactive={false} pathOptions={{ color: '#56836b', fillColor: '#8fb29c', fillOpacity: .045, weight: 1.5, dashArray: '5 6' }} />}
        {layers.canopy && canopyPolygons.filter((feature) => Array.isArray(feature.positions) && feature.positions.length >= 3).map((feature) => <Polygon key={feature.id} positions={feature.positions} pathOptions={{ color: canopyStyle.color, fillColor: canopyStyle.color, fillOpacity: .13, weight: 1.1 }}><Popup className="habitune-popup"><div className="popup-card"><span className="popup-category canopy">Tree Canopy</span><strong>{feature.name}</strong><p>Layer type · Mock canopy polygon</p><small>Source · {feature.source}</small><span className="prototype-status">Prototype data · Not verified</span></div></Popup></Polygon>)}
        {layers.habitats && habitatPolygons.filter((feature) => Array.isArray(feature.positions) && feature.positions.length >= 3).map((feature) => <Polygon key={feature.id} positions={feature.positions} pathOptions={{ color: habitatStyle.color, fillColor: habitatStyle.color, fillOpacity: .17, weight: 1.4, dashArray: '4 4' }}><Popup className="habitune-popup"><div className="popup-card"><span className="popup-category habitat">Habitats / Green Spaces</span><strong>{feature.name}</strong><p>Layer type · Mock habitat patch</p><small>Source · {feature.source}</small><span className="prototype-status">Prototype data · Not verified</span></div></Popup></Polygon>)}
        {layers.corridors && pollinationCorridors.filter((corridor) => Array.isArray(corridor.geometry) && corridor.geometry.length >= 2).map((corridor) => {
          const baseStyle = corridorPathOptions(corridor, showStreetDetail)
          return <Polyline key={corridor.id} positions={corridor.geometry} pathOptions={baseStyle} eventHandlers={{ mouseover: (event) => event.target.setStyle({ opacity: .95, weight: baseStyle.weight + 1.5 }), mouseout: (event) => event.target.setStyle(baseStyle) }}><Popup className="habitune-popup"><div className="popup-card corridor-popup"><span className="popup-category corridor">Pollination corridor</span><strong>{corridor.name}</strong><div className="corridor-meta"><span>{titleCase(corridor.status)}</span><span>{titleCase(corridor.quality)} quality</span></div><p>{corridor.explanation}</p><div className="connected-areas"><b>Connected ecological areas</b><ul>{(corridor.connectedAreas || []).map((area) => <li key={area}>{area}</li>)}</ul></div><small>Source · {corridor.source}</small><span className="prototype-status">Prototype data · Not verified</span></div></Popup></Polyline>
        })}
        {showStreetDetail && ecologicalActivityAreas.filter((area) => {
          if (!Array.isArray(area.center) || !Number.isFinite(area.radius)) return false
          return categoryIsVisible(area.category, observationById.get(area.observationId))
        }).map((area) => {
          const style = activityStyles[area.category] || activityStyles.wildlife
          const linkedObservation = observationById.get(area.observationId)
          return <Circle key={area.id} center={area.center} radius={area.radius} pathOptions={{ ...style, fillOpacity: .1, opacity: .55, weight: 1.2, dashArray: '3 4' }}><Popup className="habitune-popup">{area.category === 'pollinator' ? <PollinatorDetails observation={linkedObservation} areaName={area.name} /> : <div className="popup-card"><span className={`popup-category ${area.category}`}>Activity / potential area</span><strong>{area.name}</strong><p>Prototype area around a recorded observation; not verified habitat.</p><small>Source · {area.source}</small><span className="prototype-status">Prototype data · Not verified</span></div>}</Popup></Circle>
        })}
        {showStreetDetail && layers.trees && trees.filter((tree) => Array.isArray(tree.position)).map((tree) => <Marker key={tree.id} position={tree.position} icon={markerIcon('tree', selectedMarker === tree.id)} eventHandlers={{ click: () => setSelectedMarker(tree.id), popupclose: () => setSelectedMarker(null) }}><Popup className="habitune-popup"><div className="popup-card"><span className="popup-category tree">Urban tree</span><strong>{tree.commonName}</strong><em>{tree.scientificName}</em><p>Category · Urban Tree</p><small>Source · {tree.source}</small><span className="prototype-status">Prototype data · Not verified</span></div></Popup></Marker>)}
        {showStreetDetail && observations.filter((item) => {
          if (!Array.isArray(item.position)) return false
          return categoryIsVisible(observationCategory(item), item)
        }).map((item) => {
          const markerKind = observationCategory(item)
          const category = markerKind === 'flora' ? 'Flora' : markerKind === 'pollinator' ? 'Pollinator' : markerKind === 'bird' ? 'Bird' : 'Other wildlife'
          const speciesVisual = findSpeciesVisualByScientificName(item.scientificName)
          return <Marker key={item.id} position={item.position} icon={markerIcon(markerKind, selectedMarker === item.id, speciesVisual?.illustrationType)} eventHandlers={{ click: () => setSelectedMarker(item.id), popupclose: () => setSelectedMarker(null) }}><Popup className="habitune-popup">{markerKind === 'pollinator' ? <PollinatorDetails observation={item} /> : <div className="popup-card">{speciesVisual && <span className={`popup-species-visual ${speciesVisual.category}`} data-species-visual={speciesVisual.id}><BiodiversityIcon type={speciesVisual.illustrationType} size={58} variant="species" /></span>}<span className={`popup-category ${markerKind}`}>{category}</span><strong>{item.species}</strong><em>{item.scientificName}</em><p>Type · {item.type}<span>·</span>{item.date}</p><small>Source · {item.source}</small><span className="prototype-status">Prototype data · Not verified</span></div>}</Popup></Marker>
        })}
      </MapContainer>
    </MapErrorBoundary>
    <LayerControl layers={layers} onChange={toggle} pollinatorFilters={pollinatorFilters} onPollinatorFilterChange={togglePollinatorFilter} /><MapLegend />
    <div className="map-zoom-status">{showStreetDetail ? 'Street detail' : 'Suburb context · zoom in for observations'}</div>
    <div className="prototype-map-note">Prototype data</div>
  </div>
}
