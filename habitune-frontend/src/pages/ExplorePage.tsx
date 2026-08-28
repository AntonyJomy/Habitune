// @ts-nocheck
import { useEffect, useState } from 'react'
import { getEcosystemContext, getSpecies } from '../services/ecosystemApi'
import EcosystemMap from '../components/EcosystemMap'
import EcosystemSummary from '../components/EcosystemSummary'
import InsightCard from '../components/InsightCard'
import SpeciesCard from '../components/SpeciesCard'
import DataSources from '../components/DataSources'
import DashboardSidebar from '../components/DashboardSidebar'
import { ArrowLeft, Binoculars, MapPin, Ruler, Sprout, Trees } from 'lucide-react'

const insights = [
  ['Who lives here?', 'Explore recorded flora and fauna observations around your neighbourhood and see which species have been documented nearby.', 'Explore species', Binoculars],
  ['How green is my area?', 'Explore urban trees, canopy coverage and green habitat patches around your selected location.', 'Explore green structure', Trees],
  ['Could my small space contribute?', 'Future feature — after understanding your local ecosystem, explore how a balcony or small garden might contribute to local habitat functions.', 'Coming later', Sprout],
]

export default function ExplorePage({ location, searchedLocation, initialSection, onHome }) {
  const [data, setData] = useState(null)
  const [species, setSpecies] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setError('')

    Promise.all([getEcosystemContext(location || 'Carlton'), getSpecies()])
      .then(([context, records]) => {
        if (!active) return
        if (!context?.location?.name || !Array.isArray(context.location.center)) {
          throw new Error('The ecosystem location data is incomplete.')
        }
        setData(context)
        setSpecies(Array.isArray(records) ? records : [])
        if (initialSection !== 'explore') setTimeout(() => document.getElementById(initialSection)?.scrollIntoView(), 50)
      })
      .catch((requestError) => {
        if (active) setError(requestError.message || 'The local ecosystem data could not be loaded.')
      })

    return () => { active = false }
  }, [location, initialSection])

  if (error) return <main className="explore-error" role="alert"><strong>We couldn’t display this local ecosystem.</strong><p>{error}</p><button type="button" onClick={() => window.location.reload()}>Try again</button></main>
  if (!data) return <main className="loading">Loading local ecosystem…</main>
  return <div className="dashboard-app"><DashboardSidebar /><main className="explore-page">
    <header className="dashboard-topbar"><div><button type="button" className="choose-area-button" onClick={onHome}><ArrowLeft size={13} aria-hidden="true" /> Choose another area</button><div><span className="topbar-step">1. Explore</span><h1>My Urban Ecosystem</h1></div><p>Discover what exists around you</p></div><div className="topbar-controls"><div><small>Location</small><strong><MapPin size={14} aria-hidden="true" />{data.location.name}</strong></div><div><small>Radius</small><strong><Ruler size={14} aria-hidden="true" />{data.radius} m</strong></div><button type="button" className="profile-button" aria-label="Profile placeholder">FL</button></div></header>
    <div className="mobile-dashboard-brand"><button type="button" onClick={onHome}><span className="brand-mark">F</span><strong>Habitune</strong></button><span>Explore</span></div>
    <section className="dashboard-frame"><EcosystemSummary summary={data.summary} /><EcosystemMap data={data} searchedLocation={searchedLocation} /></section><div className="dashboard-tip"><span>i</span><p><strong>Tip:</strong> Click on map icons and corridors to see details</p><small>{searchedLocation ? `Map centred near ${searchedLocation.label}` : 'Prototype data — final version will use verified open datasets.'}</small></div>
    <section className="insights"><span className="section-kicker">Understand the landscape</span><h2>Explore your local habitat</h2><div className="insight-grid">{insights.map(([title,desc,cta,icon], i) => <InsightCard key={title} number={i + 1} title={title} description={desc} cta={cta} icon={icon} later={i === 2} />)}</div></section>
    <section className="species-section" id="species"><div className="section-heading"><div><span className="section-kicker">Demo observations</span><h2>Species recorded nearby</h2></div><p>Example records for demonstrating the interface. These species are not represented as verified Carlton observations.</p></div><div className="species-grid">{species.map((item) => <SpeciesCard key={item.id} item={item} />)}</div></section>
    <DataSources />
    <footer><div className="brand"><span className="brand-mark">F</span>Habitune</div><p>Exploring Melbourne’s urban biodiversity, one neighbourhood at a time.</p><small>Prototype · University project · Mock data only</small></footer>
  </main></div>
}
