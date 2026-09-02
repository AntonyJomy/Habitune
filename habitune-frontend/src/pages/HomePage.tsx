// @ts-nocheck
import { useEffect, useState } from 'react'
import LocationSearch from '../components/LocationSearch'
import SuburbOverviewMap from '../components/SuburbOverviewMap'
import SelectedAreaPanel from '../components/SelectedAreaPanel'
import { getPrecinctOverview, getSuburbOverview } from '../services/ecosystemApi'
import { normalizeSuburbName, resolveOverviewSuburbName } from '../data/suburbBiodiversityData'

export default function HomePage({ selectedSuburb, searchedLocation, onSelectArea, onLanding }) {
  const [suburbs, setSuburbs] = useState([])
  const [overviewStatus, setOverviewStatus] = useState('loading')
  const [selectedSummary, setSelectedSummary] = useState(null)
  const [detailStatus, setDetailStatus] = useState('idle')
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
    <main className="biodiversity-overview" id="area-selection">
      <section className="overview-panel">
        <button className="back-to-landing" type="button" onClick={onLanding}>← Back to Habitune home</button>
        <div className="overview-mode-row"><div className="overview-toggle" aria-label="Overview mode"><button className="active" type="button">Precinct view</button><button type="button" disabled title="Corridor overview data is not yet available">Corridor view</button></div><p className="corridor-unavailable" role="status">Corridor view coming later.</p></div>
        <div className="overview-intro"><span className="section-kicker">Melbourne study area</span><h1>Explore local biodiversity</h1><p>Choose an area to see its biodiversity indicators before opening the detailed ecosystem map.</p></div>
        <LocationSearch onChoose={selectSearchResult} suburbs={suburbs} />
        <div className="overview-selection-region">
          {overviewStatus === 'loading' && <div className="overview-empty"><span aria-hidden="true">⌖</span><p>Loading Melbourne biodiversity data…</p></div>}
          {overviewStatus === 'error' && <div className="overview-empty" role="alert"><span aria-hidden="true">⌖</span><p>Biodiversity data is temporarily unavailable. Please try again later.</p></div>}
          {overviewStatus === 'empty' && <div className="overview-empty"><span aria-hidden="true">⌖</span><p>No precinct biodiversity data is currently available.</p></div>}
          {overviewStatus === 'success' && !selectedArea && <div className="overview-empty"><span aria-hidden="true">⌖</span><p>Click an area on the map to explore its biodiversity data.</p></div>}
          {selectedArea && detailStatus === 'loading' && <div className="overview-empty"><span aria-hidden="true">⌖</span><p>Loading {selectedArea.name} biodiversity data…</p></div>}
          {selectedArea && detailStatus === 'error' && <div className="overview-empty" role="alert"><span aria-hidden="true">⌖</span><p>Unable to load biodiversity details for {selectedArea.name}.</p></div>}
          {selectedArea && detailStatus === 'empty' && <div className="overview-empty"><span aria-hidden="true">⌖</span><p>No biodiversity details are available for {selectedArea.name}.</p></div>}
          {selectedArea && selectedSummary && <SelectedAreaPanel name={selectedArea.name} summary={selectedSummary} />}
        </div>
      </section>
      <aside className="overview-map" aria-label="Select a Melbourne precinct on the map"><SuburbOverviewMap suburbs={suburbs} selectedSuburb={selectedSuburb} searchedLocation={searchedLocation} onSelect={onSelectArea} /></aside>
    </main>
  )
}
