import { ArrowLeft } from 'lucide-react'
import HabituneBrand from './HabituneBrand'

type NavbarProps = {
  page: string
  onNavigate: (page: string) => void
  showBack?: boolean
  hideNavigation?: boolean
  onExploreArea?: (() => void) | null
}

export default function Navbar({ page, onNavigate, showBack = false, hideNavigation = false, onExploreArea = null }: NavbarProps) {
  return (
    <header className="navbar floating-navbar">
      <div className="navbar-home-actions">
        {showBack && <button className="navbar-back" type="button" onClick={() => onNavigate('home')} aria-label="Back to Habitune home"><ArrowLeft size={19} aria-hidden="true" /></button>}
        <button className="brand" type="button" onClick={() => onNavigate('home')} aria-label="Habitune home"><HabituneBrand /></button>
      </div>
      {!hideNavigation && <nav aria-label="Main navigation">
        {['Explore', 'Species', 'About'].map((item) => <button key={item} className={page === item.toLowerCase() ? 'active' : ''} onClick={() => onNavigate(item.toLowerCase())}>{item}</button>)}
      </nav>}
      {onExploreArea && <button className="floating-navbar-cta" type="button" onClick={onExploreArea}>Explore my area</button>}
    </header>
  )
}
