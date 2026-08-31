// @ts-nocheck
import { Binoculars, Compass, FlaskConical, House, Search, Share2 } from 'lucide-react'

const items = [
  ['Explore', Compass],
  ['Discover', Binoculars],
  ['Detective', Search],
  ['Connect', Share2],
  ['Simulate', FlaskConical],
  ['My Space', House],
]

export default function DashboardSidebar() {
  return <aside className="dashboard-sidebar">
    <div className="sidebar-brand"><span className="brand-mark">F</span><strong>Habitune</strong></div>
    <nav aria-label="Dashboard navigation">
      {items.map(([label, Icon], index) => <button key={label} type="button" className={index === 0 ? 'active' : ''} aria-current={index === 0 ? 'page' : undefined} title={index ? `${label} — coming later` : label}><Icon size={19} strokeWidth={1.9} aria-hidden="true" /><small>{label}</small></button>)}
    </nav>
    <div className="sidebar-status"><span></span><small>Prototype</small></div>
  </aside>
}
