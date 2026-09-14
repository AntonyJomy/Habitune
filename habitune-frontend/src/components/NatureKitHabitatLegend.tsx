const officialHabitatValueRamp = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAA8CAYAAABmdppWAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAAvUlEQVRYhc3WwREDIQxDUWPJC2wNOaWM9N9VwpIm/gEKeGMbDdjv12cHeNycpBduZRYMiwUbDYZosPAZmgU3PcN9fIWLBh+8woLBH/04LOXhFX6rseAyDD40uNnUhIOeoeiWRbd8+XSwC10cwpOe4U23fNMVTrzlhIM9RYMJg4P+AiYNjjweFAz2PB4UvNsMGux8bHT6DBNe2i8VDGZnwRIMyhMGa7Bg0hUmDhZ8KVn0pZiOTcGg62JBmc3hH6pEEr+qyYNGAAAAAElFTkSuQmCC'

export default function NatureKitHabitatLegend() {
  return <div className="naturekit-habitat-legend" aria-label="NatureKit Habitat Value: 100 high habitat value to 0 low habitat value">
    <strong>NatureKit Habitat Value</strong>
    <div className="naturekit-habitat-scale">
      <img src={officialHabitatValueRamp} alt="" aria-hidden="true" />
      <span><b>100</b><small>High habitat value</small></span>
      <span><b>0</b><small>Low habitat value</small></span>
    </div>
  </div>
}
