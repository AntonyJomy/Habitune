import { Info } from 'lucide-react'
import type { SuburbBiodiversitySummary } from '../data/suburbBiodiversityData'

type SelectedAreaPanelProps = {
  name: string
  summary: SuburbBiodiversitySummary
  onExplore: () => void
}

const metrics: Array<[keyof SuburbBiodiversitySummary, string]> = [
  ['plantSpecies', 'Plant species'],
  ['pollinatorLinkedPlants', 'Pollinator-linked plants'],
  ['pollinatorInsectSpecies', 'Pollinator insect species'],
  ['relevantBirdSpecies', 'Relevant bird species'],
]

export default function SelectedAreaPanel({ name, summary, onExplore }: SelectedAreaPanelProps) {
  return (
    <section className="selected-area-panel" aria-live="polite">
      <div className="selected-area-heading">
        <div><span>Selected area</span><h2>{name}</h2></div>
        {summary.isPrototype && <small>Prototype summary</small>}
      </div>

      <div className="biodiversity-score">
        <span>Biodiversity Score</span>
        <strong>{Math.round(summary.biodiversityScore)} <small>/ 100</small></strong>
        <span className="score-info" title="Provisional score supplied by the processed Dataset contract.">
          <Info size={13} aria-hidden="true" /> Dataset score
        </span>
      </div>

      <dl className="area-metrics">
        {metrics.map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{summary[key]}</dd></div>)}
        <div><dt>Canopy coverage</dt><dd>{summary.canopyCoverage.toFixed(2)}%</dd></div>
        <div><dt>Species density</dt><dd>{summary.speciesDensityPerHa.toFixed(2)} / ha</dd></div>
      </dl>

      <button className="explore-selected-area" type="button" onClick={onExplore}>Explore {name} <span aria-hidden="true">→</span></button>
    </section>
  )
}
