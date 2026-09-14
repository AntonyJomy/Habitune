import { AlertCircle, LoaderCircle, MapPin } from 'lucide-react'
import type { ConnectivityData, DataAvailability, SpeciesGroup, StreetPollinatorSupport } from '../types/iteration2'

type ConnectivitySummaryPanelProps = {
  status: DataAvailability
  speciesGroup: SpeciesGroup
  data: ConnectivityData
  precinctName?: string | null
  selectedStreet?: StreetPollinatorSupport | null
}

const speciesLabels: Record<SpeciesGroup, string> = {
  native_bee: 'native bees',
  butterfly: 'butterflies',
  small_bird: 'small birds',
}

const metric = (value?: number | null, suffix = '') => value == null ? 'Not available' : `${value.toLocaleString()}${suffix}`

export default function ConnectivitySummaryPanel({ status, speciesGroup, data, precinctName, selectedStreet }: ConnectivitySummaryPanelProps) {
  if (status === 'idle') return <div className="connectivity-state"><MapPin size={22} /><h2>Search for a Melbourne location</h2><p>Search for an address, street, place or postcode to explore street-level vegetation evidence.</p></div>
  if (status === 'loading') return <div className="connectivity-state" role="status"><LoaderCircle className="overview-loading-spinner" size={22} /><h2>Loading street vegetation evidence…</h2></div>
  if (status === 'error') return <div className="connectivity-state" role="alert"><AlertCircle size={22} /><h2>Street vegetation evidence is unavailable</h2><p>The existing Precinct View remains available. Try this view again later.</p></div>
  if (status === 'unavailable') return <div className="connectivity-state"><AlertCircle size={22} /><h2>This location is not currently supported</h2><p>Search for another Melbourne location to explore available street-level vegetation evidence.</p></div>
  if (status === 'empty') return <div className="connectivity-state"><AlertCircle size={22} /><h2>Street vegetation evidence is not available</h2><p>No supported street records were found for this precinct. No corridor geometry or ecological result is inferred.</p></div>

  if (!selectedStreet) return <section className="connectivity-summary-panel">
    <span className="section-kicker">{precinctName || 'Selected precinct'}</span>
    <h2>Street vegetation evidence</h2>
    <p>{data.supportRecords.length.toLocaleString()} supported street records are available. Select a street centroid on the map or search for an address to inspect its recorded metrics.</p>
    <strong>Species perspective: {speciesLabels[speciesGroup]} · interpretation not modelled</strong>
  </section>

  return <section className="connectivity-summary-panel">
    <span className="section-kicker">Selected street · {precinctName || selectedStreet.precinctId || 'Precinct unavailable'}</span>
    <h2>{selectedStreet.streetName}</h2>
    <p>Street vegetation evidence from the existing Habitune dataset. Species-specific interpretation for {speciesLabels[speciesGroup]} is not modelled.</p>
    <dl className="connectivity-metrics">
      <div><dt>Address count</dt><dd>{metric(selectedStreet.addressCount)}</dd></div>
      <div><dt>Plant species</dt><dd>{metric(selectedStreet.plantSpeciesCount)}</dd></div>
      <div><dt>Planted trees</dt><dd>{metric(selectedStreet.plantedTreeCount)}</dd></div>
      <div><dt>Planted tree species</dt><dd>{metric(selectedStreet.plantedTreeSpeciesCount)}</dd></div>
      <div><dt>Garden plant rows</dt><dd>{metric(selectedStreet.gardenPlantRowCount)}</dd></div>
      <div><dt>Garden plant species</dt><dd>{metric(selectedStreet.gardenPlantSpeciesCount)}</dd></div>
      <div><dt>Pollinator-linked flowering plants</dt><dd>{metric(selectedStreet.pollinatorFloweringPlantSpeciesCount)}</dd></div>
      <div><dt>Nearby canopy area</dt><dd>{metric(selectedStreet.nearbyCanopyAreaM2, ' m²')}</dd></div>
      <div><dt>Nearby canopy polygons</dt><dd>{metric(selectedStreet.nearbyCanopyPolygonCount)}</dd></div>
    </dl>
    <p className="connectivity-note">Connectivity status: not modelled. These markers do not represent a corridor or connectivity quality.</p>
  </section>
}
