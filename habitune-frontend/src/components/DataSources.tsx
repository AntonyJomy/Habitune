const defaultSources = ['Atlas of Living Australia', 'City of Melbourne Urban Forest', 'City of Melbourne Tree Canopy', 'Melbourne biodiversity survey datasets']

type DataSourcesProps = {
  description?: string
  sources?: string[]
}

export default function DataSources({
  description = 'Current prototype uses mock data. Production data will be source-verified and will display dataset provenance and update information.',
  sources = defaultSources,
}: DataSourcesProps) {
  return <section className="data-sources" id="about"><div><span className="section-kicker">Source-aware by design</span><h2>Data transparency</h2><p>{description}</p></div><div className="source-list">{sources.map((source, index) => <div key={source}><span>{String(index + 1).padStart(2, '0')}</span>{source}</div>)}</div></section>
}
