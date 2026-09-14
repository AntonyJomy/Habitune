import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import Navbar from './components/Navbar'
import HomePage from './pages/HomePage'
import MapViewPage from './pages/MapViewPage'
import { readSearchLocation, removeInvalidLocationParams, setSearchLocation, type SearchLocation } from './utils/connectivityQuery'

function HomeRoute() {
  const navigate = useNavigate()
  const enterFreshMapView = () => navigate('/biodiversity', { state: null })
  return <HomePage onExploreArea={enterFreshMapView} />
}

function BiodiversityRoute() {
  const navigate = useNavigate()
  const location = useLocation()
  const locationParams = new URLSearchParams(location.search)
  const searchedLocation = readSearchLocation(locationParams)
  const [selectedPrecinctId, setSelectedPrecinctId] = useState<string | null>(null)

  useEffect(() => {
    const canonical = new URLSearchParams(location.search)
    removeInvalidLocationParams(canonical)
    canonical.delete('precinctId')
    const nextSearch = canonical.toString()
    if (nextSearch !== locationParams.toString()) {
      navigate({ pathname: '/biodiversity', search: nextSearch ? `?${nextSearch}` : '' }, { replace: true })
    }
  }, [location.search, navigate])

  const selectArea = (area: { id: string }, nextLocation: SearchLocation | null = null) => {
    setSelectedPrecinctId(area.id)
    const next = new URLSearchParams(location.search)
    next.delete('streetId')
    next.delete('precinctId')
    setSearchLocation(next, nextLocation)
    const suffix = next.toString()
    navigate(`/biodiversity${suffix ? `?${suffix}` : ''}`)
  }

  return <>
    <Navbar page="home" onNavigate={() => navigate('/')} showBack hideNavigation />
    <MapViewPage
      selectedPrecinctId={selectedPrecinctId}
      searchedLocation={searchedLocation}
      onSelectArea={selectArea}
      onResolvePrecinct={setSelectedPrecinctId}
    />
  </>
}

export default function App() {
  return <Routes>
    <Route path="/" element={<HomeRoute />} />
    <Route path="/biodiversity" element={<BiodiversityRoute />} />
    <Route path="/biodiversity/:precinctId" element={<Navigate to="/biodiversity" replace />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
}
