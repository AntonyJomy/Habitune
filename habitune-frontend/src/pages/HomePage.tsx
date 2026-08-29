// @ts-nocheck
import { useEffect, useState } from 'react'
import LocationSearch from '../components/LocationSearch'
import SuburbOverviewMap from '../components/SuburbOverviewMap'
import { getSuburbOverview } from '../services/ecosystemApi'

export default function HomePage({ selectedSuburb, onChooseSuburb, onLanding }) {
  const [suburbs, setSuburbs] = useState([])
  useEffect(() => { getSuburbOverview().then((result) => setSuburbs(Array.isArray(result?.polygons) ? result.polygons : [])) }, [])
  return (
    <main className="home" id="area-selection">
      <section className="hero area-selection-copy">
        <button className="back-to-landing" type="button" onClick={onLanding}>← Back to Habitune home</button>
        <div className="eyebrow">Melbourne’s living landscape</div>
        <h1>Discover the ecosystem <em>around you</em></h1>
        <p className="hero-copy">Explore trees, canopy and recorded biodiversity around your Melbourne neighbourhood.</p>
        <LocationSearch onChoose={onChooseSuburb} />
      </section>
      <aside className="home-suburb-selector" aria-label="Select a Melbourne suburb on the map"><SuburbOverviewMap suburbs={suburbs} selectedSuburb={selectedSuburb} onSelect={onChooseSuburb} /></aside>
    </main>
  )
}
