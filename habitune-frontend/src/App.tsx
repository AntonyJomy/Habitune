// @ts-nocheck
import { useState } from 'react'
import Navbar from './components/Navbar'
import HomePage from './pages/HomePage'
import ExplorePage from './pages/ExplorePage'

export default function App() {
  const [page, setPage] = useState('home')
  const [selectedSuburb, setSelectedSuburb] = useState('Carlton')
  const [searchedLocation, setSearchedLocation] = useState(null)
  const selectAndExplore = (suburb, location = null) => {
    setSelectedSuburb(suburb)
    setSearchedLocation(location)
    setPage('explore')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const navigate = (nextPage) => {
    if (nextPage === 'explore') {
      setPage('home')
      return setTimeout(() => document.getElementById('area-selection')?.scrollIntoView({ behavior: 'smooth' }), 0)
    }
    setPage(nextPage)
    setTimeout(() => document.getElementById(nextPage)?.scrollIntoView({ behavior: 'smooth' }), 0)
  }
  const chooseAnotherArea = () => { setSearchedLocation(null); setPage('home') }
  return <>{page === 'home' && <Navbar page={page} onNavigate={navigate} />}{page === 'home' ? <HomePage selectedSuburb={selectedSuburb} onChooseSuburb={selectAndExplore} /> : <ExplorePage location={selectedSuburb} searchedLocation={searchedLocation} initialSection={page} onHome={chooseAnotherArea} />}</>
}
