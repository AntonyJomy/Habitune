// @ts-nocheck
import { useEffect, useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import LocationSearch from '../components/LocationSearch'
import LoadingFacts from '../components/LoadingFacts'
import SuburbOverviewMap from '../components/SuburbOverviewMap'
import SelectedAreaPanel from '../components/SelectedAreaPanel'
import { getPrecinctOverview, getSuburbOverview } from '../services/ecosystemApi'
import { normalizeSuburbName, resolveOverviewSuburbName } from '../data/suburbBiodiversityData'

export default function HomePage({ selectedSuburb, searchedLocation, onSelectArea }) {
  const [suburbs, setSuburbs] = useState([])
  const [overviewStatus, setOverviewStatus] = useState('loading')
  const [selectedSummary, setSelectedSummary] = useState(null)
  const [detailStatus, setDetailStatus] = useState('idle')
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false)

  useEffect(() => {
    let active = true
    getSuburbOverview()
      .then((result) => {
        if (!active) return
        const polygons = Array.isArray(result?.polygons) ? result.polygons : []
        setSuburbs(polygons)
        setOverviewStatus(polygons.length > 0 ? 'success' : 'empty')
      })
      .catch(() => active && setOverviewStatus('error'))
    return () => { active = false }
  }, [])

  const selectedArea = suburbs.find((suburb) => normalizeSuburbName(suburb.name) === normalizeSuburbName(resolveOverviewSuburbName(selectedSuburb || '')))

  useEffect(() => {
    let active = true
    if (!selectedArea?.id) {
      setSelectedSummary(null)
      setDetailStatus('idle')
      return () => { active = false }
    }
    setSelectedSummary(null)
    setDetailStatus('loading')
    getPrecinctOverview(selectedArea.id)
      .then((summary) => {
        if (!active) return
        setSelectedSummary(summary)
        setDetailStatus(summary ? 'success' : 'empty')
      })
      .catch(() => active && setDetailStatus('error'))
    return () => { active = false }
  }, [selectedArea?.id])

  const selectSearchResult = (suburb, location) => {
    const resolvedName = resolveOverviewSuburbName(suburb)
    const matchingArea = suburbs.find((area) => normalizeSuburbName(area.name) === normalizeSuburbName(resolvedName))
    onSelectArea(matchingArea?.name || resolvedName, location)
  }

  return (
    <main className={`biodiversity-overview${isPanelCollapsed ? ' is-panel-collapsed' : ''}`} id="area-selection">
      <aside className="overview-map" aria-label="Select a Melbourne precinct on the map">
        <SuburbOverviewMap suburbs={suburbs} selectedSuburb={selectedSuburb} searchedLocation={searchedLocation} onSelect={onSelectArea} />
      </aside>

      <section className="overview-panel" id="biodiversity-overlay-panel" aria-label="Biodiversity search and selected-area details">
        <div className="overview-mode-row">
          <div className="overview-toggle" aria-label="Overview mode">
            <button className="active" type="button">Precinct view</button>
            <button type="button" disabled title="Corridor overview data is not yet available">Corridor view</button>
          </div>
          <p className="corridor-unavailable" role="status">Corridor view coming later.</p>
        </div>

        <div className="overview-intro">
          <h1>Explore local biodiversity</h1>
          <p>Choose an area to see its biodiversity indicators before opening the detailed ecosystem map.</p>
        </div>

        <LocationSearch onChoose={selectSearchResult} suburbs={suburbs} />

        <div className="overview-selection-region">
          {overviewStatus === 'loading' && (
            <div className="overview-empty overview-loading" role="status">
              <span className="overview-loading-spinner" aria-hidden="true"><LoaderCircle size={17} /></span>
              <div>
                <p className="overview-loading-label">Loading Melbourne biodiversity data…</p>
                <LoadingFacts />
              </div>
            </div>
          )}
          {overviewStatus === 'error' && <div className="overview-empty" role="alert"><span aria-hidden="true">⌖</span><p>Biodiversity data is temporarily unavailable. Please try again later.</p></div>}
          {overviewStatus === 'empty' && <div className="overview-empty"><span aria-hidden="true">⌖</span><p>No precinct biodiversity data is currently available.</p></div>}
          {overviewStatus === 'success' && !selectedArea && <div className="overview-empty"><span aria-hidden="true">⌖</span><p>Click an area on the map to explore its biodiversity data.</p></div>}
          {selectedArea && <div className="overview-active-selection"><span aria-hidden="true" /><strong>1 Active Precinct selected</strong><a href="#selected-area-details">View details ↓</a></div>}
        </div>

        {selectedArea && (
          <section className="overview-selected-details" id="selected-area-details">
            {detailStatus === 'loading' && (
              <div className="overview-empty overview-loading" role="status">
                <span className="overview-loading-spinner" aria-hidden="true"><LoaderCircle size={17} /></span>
                <div>
                  <p className="overview-loading-label">Loading {selectedArea.name} biodiversity data…</p>
                  <LoadingFacts />
                </div>
              </div>
            )}
            {detailStatus === 'error' && <div className="overview-empty" role="alert"><span aria-hidden="true">⌖</span><p>Unable to load biodiversity details for {selectedArea.name}.</p></div>}
            {detailStatus === 'empty' && <div className="overview-empty"><span aria-hidden="true">⌖</span><p>No biodiversity details are available for {selectedArea.name}.</p></div>}
            {selectedSummary && <SelectedAreaPanel name={selectedArea.name} summary={selectedSummary} />}
          </section>
        )}
      </section>

      <button
        className="overview-panel-collapse"
        type="button"
        aria-expanded={!isPanelCollapsed}
        aria-controls="biodiversity-overlay-panel"
        onClick={() => setIsPanelCollapsed((current) => !current)}
      >
        <span aria-hidden="true">{isPanelCollapsed ? '→' : '←'}</span>
        {isPanelCollapsed ? 'Show panel' : 'Collapse panel'}
      </button>
    </main>
  )
}
