// @ts-nocheck
import BiodiversityIcon from './BiodiversityIcon'
import { findSpeciesVisualByScientificName } from '../config/speciesVisuals'

const groupLabels = { nativeBees: 'Native Bees', butterfliesMoths: 'Butterflies & Moths', hoverflies: 'Hoverflies', otherPollinators: 'Other Pollinators' }

export default function PollinatorDetails({ observation, areaName }) {
  if (!observation) return null
  const speciesVisual = findSpeciesVisualByScientificName(observation.scientificName)
  return <div className="popup-card pollinator-details">{speciesVisual && <span className="popup-species-visual pollinator"><BiodiversityIcon type={speciesVisual.illustrationType} size={58} variant="species" /></span>}<span className="popup-category pollinator">{areaName ? 'Pollinator activity area' : 'Pollinator'}</span><strong>{observation.species}</strong><em>{observation.scientificName}</em>{areaName && <small className="area-name">{areaName} · prototype potential-use area</small>}<dl><div><dt>Group</dt><dd>{groupLabels[observation.pollinatorGroup]}</dd></div><div><dt>Observations</dt><dd>{observation.observationCount}</dd></div><div><dt>Last observed</dt><dd>{observation.lastObserved}</dd></div><div><dt>Native status</dt><dd>{observation.nativeStatus}</dd></div></dl><p className="supported-plants"><b>Supported plants</b>{observation.supportedPlants?.join(' · ')}</p><small>Source · {observation.source}</small><span className="prototype-status">Prototype data · Not verified</span></div>
}
