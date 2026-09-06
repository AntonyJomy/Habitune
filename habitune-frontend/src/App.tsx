import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import Navbar from './components/Navbar'
import BiodiversityOverviewPage from './pages/BiodiversityOverviewPage'
import HomePage from './pages/HomePage'

function BiodiversityRoute() {
  const navigate = useNavigate()
  return <><Navbar page="home" onNavigate={() => navigate('/')} showBack hideNavigation /><BiodiversityOverviewPage /></>
}

export default function App() {
  return <Routes>
    <Route path="/" element={<HomePage />} />
    <Route path="/biodiversity" element={<BiodiversityRoute />} />
    <Route path="/biodiversity/:precinctId" element={<BiodiversityRoute />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
}
