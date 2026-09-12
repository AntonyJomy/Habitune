import { useEffect, useRef, useState } from 'react'
import type { LatLngExpression } from 'leaflet'
import { LoaderCircle } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import ConnectivityOverviewMap from '../components/ConnectivityOverviewMap'
import ConnectivitySummaryPanel from '../components/ConnectivitySummaryPanel'
import LocationSearch from '../components/LocationSearch'
import LoadingFacts from '../components/LoadingFacts'
import SpeciesPerspectiveSelector from '../components/SpeciesPerspectiveSelector'
import SuburbOverviewMap from '../components/SuburbOverviewMap'
import SelectedAreaPanel from '../components/SelectedAreaPanel'
import { getPrecinctOverview, getSuburbOverview } from '../services/ecosystemApi'
import { getConnectivity, getLocationContext } from '../services/iteration2Api'
import { normalizeSuburbName, resolveOverviewSuburbName, type SuburbBiodiversitySummary } from '../data/suburbBiodiversityData'
import type { ConnectivityData, DataAvailability, SpeciesGroup } from '../types/iteration2'
import { readSpeciesGroup, setSearchLocation, validSpeciesGroups, type SearchLocation } from '../utils/connectivityQuery'

type OverviewArea = {
  id: string
  name: string
  label?: string
  positions: LatLngExpression[] | LatLngExpression[][] | LatLngExpression[][][]
  summary: SuburbBiodiversitySummary
}

type MapViewPageProps = {
  selectedPrecinctId: string | null
  searchedLocation: SearchLocation | null
  onSelectArea: (area: OverviewArea, location?: SearchLocation | null) => void
  onResolvePrecinct: (precinctId: string | null) => void
}

type OverviewStatus = 'loading' | 'success' | 'empty' | 'error'
type DetailStatus = 'idle' | 'loading' | 'success' | 'empty' | 'error'

const emptyConnectivityData = (): ConnectivityData => ({ context: null, supportRecords: [], connectivity: [], connectivityStatus: 'not_modelled' })

export default function MapViewPage({ selectedPrecinctId, searchedLocation, onSelectArea, onResolvePrecinct }: MapViewPageProps) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedView = searchParams.get('view')
  const viewMode: 'precinct' | 'connectivity' = requestedView === 'connectivity' ? 'connectivity' : 'precinct'
  const speciesGroup = readSpeciesGroup(searchParams)
  const [suburbs, setSuburbs] = useState<OverviewArea[]>([])
  const [overviewStatus, setOverviewStatus] = useState<OverviewStatus>('loading')
  const [selectedSummary, setSelectedSummary] = useState<SuburbBiodiversitySummary | null>(null)
  const [detailStatus, setDetailStatus] = useState<DetailStatus>('idle')
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false)
  const [connectivityStatus, setConnectivityStatus] = useState<DataAvailability>('idle')
  const [connectivityData, setConnectivityData] = useState<ConnectivityData>(emptyConnectivityData)
  const [searchSelectionError, setSearchSelectionError] = useState<string | null>(null)
  const hadCorridorSearch = useRef(false)
  const selectedStreetId = searchParams.get('streetId')
  const selectedStreet = connectivityData.supportRecords.find((street) => street.streetId === selectedStreetId)

  useEffect(() => {
    if (viewMode === 'connectivity' && searchedLocation) hadCorridorSearch.current = true
    if (viewMode === 'precinct' && !searchedLocation && !selectedStreetId && hadCorridorSearch.current) {
      hadCorridorSearch.current = false
      onResolvePrecinct(null)
    }
  }, [onResolvePrecinct, searchedLocation, selectedStreetId, viewMode])

  useEffect(() => {
    const next = new URLSearchParams(searchParams)
    if (requestedView && requestedView !== 'connectivity') next.delete('view')
    if (viewMode === 'precinct') next.delete('species')
    else if (next.has('species') && !validSpeciesGroups.has(next.get('species') as SpeciesGroup)) next.set('species', 'native_bee')
    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true })
  }, [requestedView, searchParams, setSearchParams, viewMode])

  useEffect(() => {
    let active = true
    getSuburbOverview()
      .then((result) => {
        if (!active) return
        const polygons = Array.isArray(result?.polygons) ? result.polygons : []
        setSuburbs(polygons as OverviewArea[])
        setOverviewStatus(polygons.length > 0 ? 'success' : 'empty')
      })
      .catch(() => active && setOverviewStatus('error'))
    return () => { active = false }
  }, [])

  const selectedArea = suburbs.find((suburb) => suburb.id === selectedPrecinctId)

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

  const selectSearchResult = (suburb: string, location: SearchLocation) => {
    if (viewMode === 'connectivity') {
      const next = new URLSearchParams(searchParams)
      next.set('view', 'connectivity')
      next.delete('streetId')
      next.delete('precinctId')
      setSearchLocation(next, location)
      setSearchSelectionError(null)
      navigate(`/biodiversity?${next}`)
      return
    }
    const resolvedName = resolveOverviewSuburbName(suburb)
    const normalizedResolvedName = normalizeSuburbName(resolvedName)
    const matchingArea = suburbs.find((area) => area.id === suburb
      || normalizeSuburbName(area.name) === normalizedResolvedName
      || normalizeSuburbName(area.label || '') === normalizedResolvedName)
    if (matchingArea) {
      setSearchSelectionError(null)
      onSelectArea(matchingArea, location)
    } else {
      setSearchSelectionError(`The resolved location belongs to ${resolvedName}, but that precinct is not available on the current map.`)
    }
  }

  useEffect(() => {
    if (viewMode !== 'connectivity' || (!selectedPrecinctId && !searchedLocation)) {
      setConnectivityData(emptyConnectivityData())
      setConnectivityStatus('idle')
      return undefined
    }
    const controller = new AbortController()
    const hasLocation = Boolean(searchedLocation && Number.isFinite(searchedLocation.lat) && Number.isFinite(searchedLocation.lng))
    const latitude = hasLocation ? searchedLocation!.lat : null
    const longitude = hasLocation ? searchedLocation!.lng : null
    setConnectivityStatus('loading')
    const loadConnectivity = async () => {
      const locationResponse = hasLocation
        ? await getLocationContext(latitude!, longitude!, controller.signal)
        : { data: null, meta: { status: 'not_available' } }
      const context = locationResponse.data ? { ...locationResponse.data, label: locationResponse.data.label || searchedLocation!.label } : null
      const resolvedPrecinctId = context?.precinctId || selectedPrecinctId
      if (!resolvedPrecinctId) {
        setConnectivityData(emptyConnectivityData())
        setConnectivityStatus('unavailable')
        return
      }
      const connectivityResponse = await getConnectivity(null, null, speciesGroup, resolvedPrecinctId, controller.signal)
      if (controller.signal.aborted) return
      const data = { ...connectivityResponse.data, context }
      setConnectivityData(data)
      setConnectivityStatus(data.supportRecords.length > 0 ? 'available' : 'empty')
      if (context?.precinctId && context.precinctId !== selectedPrecinctId) onResolvePrecinct(context.precinctId)
      const next = new URLSearchParams(searchParams)
      next.delete('precinctId')
      if (context?.streetId && data.supportRecords.some((street) => street.streetId === context.streetId)) {
        next.set('streetId', context.streetId)
      } else if (hasLocation) {
        next.delete('streetId')
      }
      const nextSearch = next.toString()
      if (nextSearch !== searchParams.toString()) navigate(`/biodiversity${nextSearch ? `?${nextSearch}` : ''}`, { replace: true })
    }
    loadConnectivity().catch((error) => {
      if (error?.name !== 'AbortError') setConnectivityStatus('error')
    })
    return () => controller.abort()
  }, [viewMode, speciesGroup, selectedPrecinctId, searchedLocation?.lat, searchedLocation?.lng, searchedLocation?.label])

  const setViewMode = (mode: 'precinct' | 'connectivity') => {
    const next = new URLSearchParams(searchParams)
    setSearchLocation(next, null)
    next.delete('streetId')
    next.delete('precinctId')
    if (mode === 'connectivity') {
      hadCorridorSearch.current = false
      onResolvePrecinct(null)
    }
    setSearchSelectionError(null)
    if (mode === 'connectivity') {
      next.set('view', 'connectivity')
      navigate(`/biodiversity?${next}`)
      return
    }
    next.delete('view')
    next.delete('species')
    const nextSearch = next.toString()
    navigate(`/biodiversity${nextSearch ? `?${nextSearch}` : ''}`)
  }

  const setSpeciesGroup = (species: SpeciesGroup) => {
    const next = new URLSearchParams(searchParams)
    next.set('view', 'connectivity')
    next.set('species', species)
    setSearchParams(next)
  }

  return (
    <main className={`biodiversity-overview${isPanelCollapsed ? ' is-panel-collapsed' : ''}`} id="area-selection">
      <aside className="overview-map" aria-label="Select a Melbourne precinct on the map">
        {viewMode === 'precinct'
          ? <SuburbOverviewMap suburbs={suburbs} selectedPrecinctId={selectedPrecinctId} searchedLocation={searchedLocation} onSelect={onSelectArea} />
          : <ConnectivityOverviewMap
              searchedLocation={searchedLocation}
              supportPoints={connectivityData.supportRecords}
              selectedStreetId={selectedStreet?.streetId || null}
              onSelectStreet={(streetId) => {
                const next = new URLSearchParams(searchParams)
                next.set('streetId', streetId)
                setSearchParams(next)
              }}
            />}
      </aside>

      <section className="overview-panel" id="biodiversity-overlay-panel" aria-label="Biodiversity search and selected-area details">
        <div className="overview-mode-row">
          <div className="overview-toggle" aria-label="Overview mode">
            <button className={viewMode === 'precinct' ? 'active' : ''} type="button" onClick={() => setViewMode('precinct')}>Precinct View</button>
            <button className={viewMode === 'connectivity' ? 'active' : ''} type="button" onClick={() => setViewMode('connectivity')}>Corridor View</button>
          </div>
          {viewMode === 'connectivity' && <p className="corridor-unavailable" role="status">Street evidence only · connectivity not modelled</p>}
        </div>

        <div className="overview-intro">
          <h1>{viewMode === 'precinct' ? 'Explore local biodiversity' : 'Browse street vegetation evidence'}</h1>
          <p>{viewMode === 'precinct' ? 'Choose an area to see its biodiversity indicators before opening the detailed ecosystem map.' : 'Select a street centroid or search for a location to inspect existing street-level vegetation and nearby-canopy records.'}</p>
        </div>

        {viewMode === 'connectivity' && <SpeciesPerspectiveSelector value={speciesGroup} onChange={setSpeciesGroup} />}
        <LocationSearch
          key={viewMode}
          onChoose={selectSearchResult}
          suburbs={suburbs}
        />
        {searchSelectionError && <p className="error" role="alert">{searchSelectionError}</p>}

        {viewMode === 'precinct' ? <><div className="overview-selection-region">
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
          {overviewStatus === 'success' && selectedPrecinctId && !selectedArea && <div className="overview-empty" role="alert"><span aria-hidden="true">⌖</span><p>The requested precinct is not available. Search for a location or choose a precinct on the map.</p></div>}
          {overviewStatus === 'success' && !selectedPrecinctId && <div className="overview-empty"><span aria-hidden="true">⌖</span><p>Click an area on the map to explore its biodiversity data.</p></div>}
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
        )}</> : <ConnectivitySummaryPanel
          status={connectivityStatus}
          speciesGroup={speciesGroup}
          data={connectivityData}
          precinctName={selectedArea?.name}
          selectedStreet={selectedStreet}
        />}
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
