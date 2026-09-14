type MapIconLegendProps = {
  showSearchedLocation: boolean
  showTrees: boolean
  showGardenBeds: boolean
  showStreetEvidence: boolean
}

function TreeLegendIcon() {
  return <svg className="map-icon-legend-tree" viewBox="0 0 24 28" aria-hidden="true">
    <rect x="10.5" y="16" width="3" height="9" fill="#754C29" />
    <circle cx="12" cy="9" r="6" fill="#236B45" />
    <circle cx="7.5" cy="14" r="5" fill="#236B45" />
    <circle cx="16.5" cy="14" r="5" fill="#236B45" />
  </svg>
}

function LocationLegendIcon() {
  return <svg className="map-icon-legend-pin" viewBox="0 0 32 42" aria-hidden="true">
    <path d="M16 40C12 34 4 25 4 16a12 12 0 1 1 24 0c0 9-8 18-12 24Z" fill="#17633f" stroke="#fff" strokeWidth="2" />
    <circle cx="16" cy="16" r="5" fill="#fff" />
  </svg>
}

export default function MapIconLegend({
  showSearchedLocation,
  showTrees,
  showGardenBeds,
  showStreetEvidence,
}: MapIconLegendProps) {
  if (!showSearchedLocation && !showTrees && !showGardenBeds && !showStreetEvidence) return null

  return <section className="map-icon-legend" aria-label="Map icon legend">
    <strong className="map-icon-legend-title">Map icons</strong>
    <div className="map-icon-legend-items">
      {showSearchedLocation && <span><i><LocationLegendIcon /></i>Selected location</span>}
      {showTrees && <span><i><TreeLegendIcon /></i>Individual tree</span>}
      {showGardenBeds && <span><i className="map-icon-legend-garden" />Garden bed area</span>}
      {showStreetEvidence && <span><i className="map-icon-legend-street" />Street vegetation evidence</span>}
    </div>
  </section>
}
