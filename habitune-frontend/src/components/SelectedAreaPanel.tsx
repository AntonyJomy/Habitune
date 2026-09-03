import { Info } from 'lucide-react'
import type { SuburbBiodiversitySummary } from '../data/suburbBiodiversityData'

type SelectedAreaPanelProps = {
  name: string
  summary: SuburbBiodiversitySummary
}

export default function SelectedAreaPanel({ name, summary }: SelectedAreaPanelProps) {
  const precinctNumber = summary.precinctId.match(/\d+/)?.[0]?.padStart(2, '0') || summary.precinctId

  return (
    <section className="selected-area-panel" aria-live="polite">
      <div className="selected-area-header">
        <div className="selected-area-heading">
          <div className="selected-area-label-row"><span>Selected area</span><small><i aria-hidden="true" /> Active Precinct</small></div>
          <h2>{name}</h2>
          <p>Melbourne Study Area · Precinct {precinctNumber}</p>
        </div>

        <div className="biodiversity-score">
          <div><span>Overall score</span><small>Provisional biodiversity indicator</small></div>
          <strong>{summary.biodiversityScore.toFixed(2)} <small>/ 100</small></strong>
          <div className="score-progress" aria-hidden="true"><span style={{ width: `${Math.min(100, Math.max(0, summary.biodiversityScore))}%` }} /></div>
          <p>Compares canopy coverage and recorded species density across the 10 areas in this dataset. It is not a complete biodiversity assessment.</p>
        </div>
      </div>

      <h3 className="area-data-heading">Key biodiversity indicators</h3>
      <dl className="area-metrics">
        <div>
          <dt>Estimated canopy coverage</dt>
          <dd><strong>{summary.canopyCoverage.toFixed(2)}%</strong><span>Share of the precinct covered by allocated 2019 canopy polygons.</span></dd>
        </div>
        <div>
          <dt>Recorded plant diversity</dt>
          <dd><strong>{summary.plantSpecies} <small>species</small></strong><span>Distinct scientific names in available council tree and garden inventories.</span></dd>
        </div>
        <div>
          <dt>Pollinator-linked flowering plants</dt>
          <dd><strong>{summary.pollinatorLinkedPlants} <small>species</small></strong><span>Inventory species linked to pollinator evidence in the supporting dataset.</span></dd>
        </div>
        <div>
          <dt>Recorded wildlife indicators</dt>
          <dd><strong>{summary.pollinatorInsectSpecies} <small>insects</small> · {summary.relevantBirdSpecies} <small>birds</small></strong><span>Pollinator-candidate insects and nectar/fruit diet-filtered bird species.</span></dd>
        </div>
        <div>
          <dt>Combined recorded species density</dt>
          <dd><strong>{summary.speciesDensityPerHa.toFixed(2)} <small>/ ha</small></strong><span>Recorded plant and filtered animal species divided by precinct area.</span></dd>
        </div>
      </dl>

      <p className="area-data-note"><Info size={16} aria-hidden="true" /><span><strong>Methodology Note:</strong> Counts describe available inventory and occurrence records, not wildlife population size or confirmed habitat quality.</span></p>
    </section>
  )
}
