// @ts-nocheck
import { useEffect, useState } from 'react'
import LocationSearch from '../components/LocationSearch'
import SuburbOverviewMap from '../components/SuburbOverviewMap'
import SelectedAreaPanel from '../components/SelectedAreaPanel'
import { getSuburbOverview } from '../services/ecosystemApi'
import { normalizeSuburbName, resolveOverviewSuburbName } from '../data/suburbBiodiversityData'

export default function HomePage({ selectedSuburb, searchedLocation, onSelectArea, onExploreArea, onLanding }) {
  const [suburbs, setSuburbs] = useState([])
  useEffect(() => { getSuburbOverview().then((result) => setSuburbs(Array.isArray(result?.polygons) ? result.polygons : [])) }, [])
  const selectedArea = suburbs.find((suburb) => normalizeSuburbName(suburb.name) === normalizeSuburbName(resolveOverviewSuburbName(selectedSuburb || '')))
  const selectSearchResult = (suburb, location) => {
    const resolvedName = resolveOverviewSuburbName(suburb)
    const matchingArea = suburbs.find((area) => normalizeSuburbName(area.name) === normalizeSuburbName(resolvedName))
    onSelectArea(matchingArea?.name || resolvedName, location)
  }
  return (
    <main className="biodiversity-overview" id="area-selection">
      <section className="overview-panel">
        <button className="back-to-landing" type="button" onClick={onLanding}>← Back to Habitune home</button>
        <div className="overview-toggle" aria-label="Overview mode"><button className="active" type="button">Precinct view</button><button type="button" disabled title="Corridor overview data is not yet available">Corridor view</button></div>
        <p className="corridor-unavailable" role="status">Corridor view is not yet available in the current dataset.</p>
        <div className="overview-intro"><span className="section-kicker">Melbourne study area</span><h1>Explore local biodiversity</h1><p>Choose an area to see its biodiversity indicators before opening the detailed ecosystem map.</p></div>
        <LocationSearch onChoose={selectSearchResult} />
        {!selectedArea?.summary && <div className="overview-empty"><span aria-hidden="true">⌖</span><p>Click an area on the map to explore its biodiversity data.</p></div>}
        {selectedArea?.summary && <SelectedAreaPanel name={selectedArea.name} summary={selectedArea.summary} onExplore={onExploreArea} />}
      </section>
      <aside className="overview-map" aria-label="Select a Melbourne precinct on the map"><SuburbOverviewMap suburbs={suburbs} selectedSuburb={selectedSuburb} searchedLocation={searchedLocation} onSelect={onSelectArea} /></aside>
    </main>
  )
}
