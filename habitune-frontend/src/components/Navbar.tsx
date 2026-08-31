// @ts-nocheck
import HabituneBrand from './HabituneBrand'

export default function Navbar({ page, onNavigate }) {
  return (
    <header className="navbar">
      <button className="brand" onClick={() => onNavigate('home')} aria-label="Habitune home"><HabituneBrand /></button>
      <nav aria-label="Main navigation">
        {['Explore', 'Species', 'About'].map((item) => <button key={item} className={page === item.toLowerCase() ? 'active' : ''} onClick={() => onNavigate(item.toLowerCase())}>{item}</button>)}
      </nav>
    </header>
  )
}
