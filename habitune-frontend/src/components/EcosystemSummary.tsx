// @ts-nocheck
import BiodiversityIcon from './BiodiversityIcon'

const ecosystemRows = [
  { icon: 'tree', title: 'Trees & Vegetation', value: 'High', detail: 'Tree canopy: 21%' },
  { icon: 'pollinator', title: 'Pollinators', value: '28 species', detail: 'Observed in last 12 months' },
  { icon: 'bird', title: 'Birds', value: '35 species', detail: 'Observed in last 12 months' },
  { icon: 'wildlife', title: 'Other Wildlife', value: '61 species', detail: 'Insects, reptiles, mammals…' },
  { icon: 'habitat', title: 'Habitats', value: '5 areas', detail: 'Parks, reserves & green spaces' },
]
export default function EcosystemSummary({ summary = [] }) {
  return <aside className="summary-panel"><div className="summary-heading"><div><span className="summary-kicker">Local overview</span><h2>Your ecosystem</h2></div><span className="mock-label">Prototype values</span></div><div className="ecosystem-rows">{ecosystemRows.map((item) => <article className="ecosystem-row" key={item.title}><span className="row-icon"><BiodiversityIcon type={item.icon} size={29} variant="summary" /></span><div><strong>{item.title}</strong><small>{item.detail}</small></div><b>{item.value}</b></article>)}</div><div className="original-totals" aria-label="Original prototype totals">{summary.map((item) => <span key={item.label}><strong>{item.value}</strong> {item.label}</span>)}</div><button className="report-button" type="button">View full report <span>→</span></button></aside>
}
