// @ts-nocheck
import { useState } from 'react'
import Navbar from './components/Navbar'
import LandingPage from './pages/LandingPage'
import HomePage from './pages/HomePage'

export default function App() {
  const [page, setPage] = useState('landing')
  const [selectedSuburb, setSelectedSuburb] = useState(null)
  const [searchedLocation, setSearchedLocation] = useState(null)
  const selectArea = (suburb, location = null) => {
    setSelectedSuburb(suburb)
    setSearchedLocation(location)
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
  }
  const showAreaSelection = () => { setPage('area'); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  if (page === 'landing') return <LandingPage onExploreArea={showAreaSelection} />
  return <><Navbar page="home" onNavigate={navigate} showBack /><HomePage selectedSuburb={selectedSuburb} searchedLocation={searchedLocation} onSelectArea={selectArea} /></>
}
