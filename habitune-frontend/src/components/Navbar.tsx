// @ts-nocheck
import { ArrowLeft } from 'lucide-react'
import HabituneBrand from './HabituneBrand'

export default function Navbar({ page, onNavigate, showBack = false }) {
  return (
    <header className="navbar">
      <div className="navbar-home-actions">
        {showBack && <button className="navbar-back" type="button" onClick={() => onNavigate('home')} aria-label="Back to Habitune home"><ArrowLeft size={19} aria-hidden="true" /></button>}
        <button className="brand" type="button" onClick={() => onNavigate('home')} aria-label="Habitune home"><HabituneBrand /></button>
      </div>
      <nav aria-label="Main navigation">
        {['Explore', 'Species', 'About'].map((item) => <button key={item} className={page === item.toLowerCase() ? 'active' : ''} onClick={() => onNavigate(item.toLowerCase())}>{item}</button>)}
      </nav>
    </header>
  )
}
