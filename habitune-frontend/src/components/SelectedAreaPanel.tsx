import { Info } from 'lucide-react'
import type { SuburbBiodiversitySummary } from '../data/suburbBiodiversityData'

type SelectedAreaPanelProps = {
  name: string
  summary: SuburbBiodiversitySummary
}

export default function SelectedAreaPanel({ name, summary }: SelectedAreaPanelProps) {
  return (
    <section className="selected-area-panel" aria-live="polite">
      <div className="selected-area-heading">
        <div><span>Selected area</span><h2>{name}</h2></div>
        {summary.isPrototype && <small>Prototype summary</small>}
      </div>

      <div className="biodiversity-score">
        <span>Provisional biodiversity indicator</span>
        <strong>{summary.biodiversityScore.toFixed(2)} <small>/ 100</small></strong>
        <p>Compares canopy coverage and recorded species density across the 10 areas in this dataset. It is not a complete biodiversity assessment.</p>
        <span className="score-info" title="The mean of min-max scaled canopy, plant-density and animal-density scores across 10 precincts.">
          <Info size={13} aria-hidden="true" /> Relative dataset indicator
        </span>
      </div>

      <h3 className="area-data-heading">What the data shows</h3>
      <dl className="area-metrics">
        <div>
          <dt>Estimated canopy coverage</dt>
          <dd><strong>{summary.canopyCoverage.toFixed(2)}%</strong><span>Share of the precinct covered by allocated 2019 canopy polygons.</span></dd>
        </div>
        <div>
          <dt>Recorded plant diversity</dt>
          <dd><strong>{summary.plantSpecies}</strong><span>Distinct scientific names in available council tree and garden inventories.</span></dd>
        </div>
        <div>
          <dt>Pollinator-linked flowering plants</dt>
          <dd><strong>{summary.pollinatorLinkedPlants}</strong><span>Inventory species linked to pollinator evidence in the supporting dataset.</span></dd>
        </div>
        <div>
          <dt>Recorded wildlife indicators</dt>
          <dd><strong>{summary.pollinatorInsectSpecies} insects · {summary.relevantBirdSpecies} birds</strong><span>Pollinator-candidate insects and nectar/fruit diet-filtered bird species.</span></dd>
        </div>
        <div>
          <dt>Combined recorded species density</dt>
          <dd><strong>{summary.speciesDensityPerHa.toFixed(2)} per hectare</strong><span>Recorded plant and filtered animal species divided by precinct area.</span></dd>
        </div>
      </dl>

      <p className="area-data-note"><Info size={14} aria-hidden="true" /> Counts describe available inventory and occurrence records, not wildlife population size or confirmed habitat quality.</p>
    </section>
  )
}
