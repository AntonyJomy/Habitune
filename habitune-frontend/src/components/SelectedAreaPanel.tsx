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
          <div><span>Overall score</span><small>Compared with the 10 Melbourne study areas</small></div>
          <strong>{summary.biodiversityScore.toFixed(2)} <small>/ 100</small></strong>
          <div className="score-progress" aria-hidden="true"><span style={{ width: `${Math.min(100, Math.max(0, summary.biodiversityScore))}%` }} /></div>
          <p>This helps you compare the area with the other Melbourne study areas. A higher score means it has more tree cover or more recorded plant and animal species per hectare. It is not a complete measure of biodiversity.</p>
        </div>
      </div>

      <h3 className="area-data-heading">Key biodiversity indicators</h3>
      <dl className="area-metrics">
        <div>
          <dt>Estimated canopy coverage</dt>
          <dd><strong>{summary.canopyCoverage.toFixed(2)}%</strong><span>This shows the estimated percentage of the area covered by tree canopy in the 2019 dataset.</span></dd>
        </div>
        <div>
          <dt>Recorded plant diversity</dt>
          <dd><strong>{summary.plantSpecies} <small>species</small></strong><span>This shows how many different plant species have been recorded in the area's trees and gardens.</span></dd>
        </div>
        <div>
          <dt>Pollinator-linked flowering plants</dt>
          <dd><strong>{summary.pollinatorLinkedPlants} <small>species</small></strong><span>These flowering plants may provide food for bees, butterflies and other pollinators in the area.</span></dd>
        </div>
        <div>
          <dt>Recorded wildlife indicators</dt>
          <dd><strong>{summary.pollinatorInsectSpecies} <small>insects</small> · {summary.relevantBirdSpecies} <small>birds</small></strong><span>This shows the variety of recorded pollinating insects and birds that feed on nectar or fruit.</span></dd>
        </div>
        <div>
          <dt>Combined recorded species density</dt>
          <dd><strong>{summary.speciesDensityPerHa.toFixed(2)} <small>/ ha</small></strong><span>This makes it easier to compare areas by showing the number of recorded species for the same amount of land.</span></dd>
        </div>
      </dl>

      <p className="area-data-note"><Info size={16} aria-hidden="true" /><span><strong>About this data:</strong> These numbers come from available records. They do not show how many individual animals live here or confirm the quality of local habitat.</span></p>
    </section>
  )
}
