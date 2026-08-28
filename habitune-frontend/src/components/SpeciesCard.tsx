// @ts-nocheck
import BiodiversityIcon from './BiodiversityIcon'
import { getSpeciesVisual } from '../config/speciesVisuals'

export default function SpeciesCard({ item }) {
  const visual = getSpeciesVisual(item.visualId)
  if (!visual) return null
  return <article className="species-card" data-species-visual={visual.id}><div className={`species-image ${visual.category}`}><BiodiversityIcon type={visual.illustrationType} size={104} variant="species" /><small>Demo record</small></div><div className="species-body"><div className="species-meta"><span className="species-category"><BiodiversityIcon type={visual.category} size={17} variant="legend" />{visual.typeLabel}</span><span>{item.count} observations</span></div><h3>{visual.commonName}</h3><em>{visual.scientificName}</em><p>Source: {item.source}</p><button type="button" onClick={() => alert(`${visual.commonName}\nDemo record details only.`)}>View details <span>→</span></button></div></article>
}
