import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import ConnectivitySummaryPanel from './ConnectivitySummaryPanel'
import type { ConnectivityData } from '../types/iteration2'

const emptyData: ConnectivityData = { context: null, supportRecords: [], connectivity: [], connectivityStatus: 'not_modelled' }

describe('ConnectivitySummaryPanel framework states', () => {
  it('uses a location-first prompt before a precinct context exists', () => {
    const html = renderToStaticMarkup(<ConnectivitySummaryPanel status="idle" speciesGroup="native_bee" data={emptyData} />)
    expect(html).toContain('Search for a Melbourne location')
    expect(html).not.toContain('Select or search for a precinct')
  })

  it('renders a loading state', () => {
    const html = renderToStaticMarkup(<ConnectivitySummaryPanel status="loading" speciesGroup="native_bee" data={emptyData} />)
    expect(html).toContain('Loading street vegetation evidence')
  })

  it('renders an error state', () => {
    const html = renderToStaticMarkup(<ConnectivitySummaryPanel status="error" speciesGroup="butterfly" data={emptyData} />)
    expect(html).toContain('Street vegetation evidence is unavailable')
  })

  it('renders a no-data state without ecological claims', () => {
    const html = renderToStaticMarkup(<ConnectivitySummaryPanel status="empty" speciesGroup="small_bird" data={emptyData} />)
    expect(html).toContain('Street vegetation evidence is not available')
    expect(html).toContain('No corridor geometry or ecological result is inferred')
  })

  it('preserves zero and null street evidence values', () => {
    const street = {
      streetId: 'Carlton|379', streetKey: 'Carlton|379', streetName: 'Alma Place', precinctId: 'carlton',
      plantedTreeCount: 0, plantSpeciesCount: 0, nearbyCanopyAreaM2: null,
    }
    const data: ConnectivityData = { ...emptyData, supportRecords: [street] }
    const html = renderToStaticMarkup(<ConnectivitySummaryPanel status="available" speciesGroup="native_bee" data={data} precinctName="Carlton" selectedStreet={street} />)
    expect(html).toContain('Alma Place')
    expect(html).toContain('Planted trees</dt><dd>0')
    expect(html).toContain('Nearby canopy area</dt><dd>Not available')
    expect(html).not.toContain('View street ecosystem')
    expect(html).toContain('Connectivity status: not modelled')
  })
})
