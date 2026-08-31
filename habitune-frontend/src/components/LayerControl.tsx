// @ts-nocheck
import BiodiversityIcon from './BiodiversityIcon'
import { biodiversityCategories, biodiversityCategoryOrder } from '../config/biodiversityCategories'
import { ChevronDown, Route } from 'lucide-react'

const pollinatorGroups = [
  ['nativeBees', 'Native Bees'],
  ['butterfliesMoths', 'Butterflies & Moths'],
  ['hoverflies', 'Hoverflies'],
  ['otherPollinators', 'Other Pollinators'],
]

export default function LayerControl({ layers, onChange, pollinatorFilters, onPollinatorFilterChange }) {
  return <div className="layer-control" aria-label="Map layers"><div className="layer-title"><strong>Layers</strong><small>Map data</small></div>{biodiversityCategoryOrder.map((type) => {
    const category = biodiversityCategories[type]
    return <div className="layer-group" key={type}><label><BiodiversityIcon type={type} size={20} variant="legend" /><span className="layer-name">{category.label}</span><input type="checkbox" checked={Boolean(layers[category.layerKey])} onChange={() => onChange(category.layerKey)} /><span className="map-toggle" aria-hidden="true"></span></label>{type === 'pollinator' && <><details className="pollinator-filter" open><summary><ChevronDown size={11} /> Pollinator groups</summary><div>{pollinatorGroups.map(([key, label]) => <label className="subfilter" key={key}><input type="checkbox" checked={Boolean(pollinatorFilters[key])} onChange={() => onPollinatorFilterChange(key)} /><span aria-hidden="true"></span>{label}</label>)}</div></details><label className="corridor-layer"><Route size={17} aria-hidden="true" /><span className="layer-name">Pollination Corridors</span><input type="checkbox" checked={Boolean(layers.corridors)} onChange={() => onChange('corridors')} /><span className="map-toggle" aria-hidden="true"></span></label></>}</div>
  })}</div>
}
