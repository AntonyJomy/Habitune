// @ts-nocheck
export const biodiversityCategories = {
  tree: { type: 'tree', layerKey: 'trees', label: 'Urban Trees', color: '#2E8B57' },
  flora: { type: 'flora', layerKey: 'flora', label: 'Vegetation / Flora', color: '#66A83E' },
  pollinator: { type: 'pollinator', layerKey: 'pollinators', label: 'Pollinators', color: '#D99A22' },
  bird: { type: 'bird', layerKey: 'birds', label: 'Birds', color: '#3F83B5' },
  wildlife: { type: 'wildlife', layerKey: 'wildlife', label: 'Other Wildlife', color: '#8661A8' },
  canopy: { type: 'canopy', layerKey: 'canopy', label: 'Tree Canopy', color: '#74B77A' },
  habitat: { type: 'habitat', layerKey: 'habitats', label: 'Habitats / Green Spaces', color: '#3F927F' },
}

export const biodiversityCategoryOrder = ['tree', 'flora', 'pollinator', 'bird', 'wildlife', 'canopy', 'habitat']

export function getBiodiversityCategory(type) {
  return biodiversityCategories[type] || biodiversityCategories.wildlife
}
