// @ts-nocheck
import { useState } from 'react'
import Navbar from './components/Navbar'
import LandingPage from './pages/LandingPage'
import HomePage from './pages/HomePage'
import ExplorePage from './pages/ExplorePage'

export default function App() {
  const [page, setPage] = useState('landing')
  const [selectedSuburb, setSelectedSuburb] = useState('Carlton')
  const [searchedLocation, setSearchedLocation] = useState(null)
  const selectAndExplore = (suburb, location = null) => {
    setSelectedSuburb(suburb)
    setSearchedLocation(location)
    setPage('explore')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const navigate = (nextPage) => {
    if (nextPage === 'home') {
      setPage('landing')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    if (nextPage === 'explore') {
      setPage('area')
      return setTimeout(() => document.getElementById('area-selection')?.scrollIntoView({ behavior: 'smooth' }), 0)
    }
    setPage(nextPage)
    setTimeout(() => document.getElementById(nextPage)?.scrollIntoView({ behavior: 'smooth' }), 0)
  }
  const showAreaSelection = () => { setPage('area'); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const showLanding = () => { setPage('landing'); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const chooseAnotherArea = () => { setSearchedLocation(null); showAreaSelection() }

  if (page === 'landing') return <LandingPage onExploreArea={showAreaSelection} />
  if (page === 'area') return <><Navbar page="home" onNavigate={navigate} /><HomePage selectedSuburb={selectedSuburb} onChooseSuburb={selectAndExplore} onLanding={showLanding} /></>
  return <ExplorePage location={selectedSuburb} searchedLocation={searchedLocation} initialSection={page} onHome={chooseAnotherArea} />
}
