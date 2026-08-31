// @ts-nocheck
export const speciesVisuals = {
  rainbowLorikeet: {
    id: 'rainbowLorikeet',
    commonName: 'Rainbow Lorikeet',
    scientificName: 'Trichoglossus moluccanus',
    category: 'bird',
    typeLabel: 'Bird',
    illustrationType: 'lorikeet',
  },
  blueBandedBee: {
    id: 'blueBandedBee',
    commonName: 'Common Blue-banded Bee',
    scientificName: 'Amegilla cingulata',
    category: 'pollinator',
    typeLabel: 'Insect / Pollinator',
    illustrationType: 'bee',
  },
  correa: {
    id: 'correa',
    commonName: 'Correa',
    scientificName: 'Correa reflexa',
    category: 'flora',
    typeLabel: 'Plant',
    illustrationType: 'correa',
  },
  nativeDaisy: {
    id: 'nativeDaisy',
    commonName: 'Native Daisy',
    scientificName: 'Brachyscome multifida',
    category: 'flora',
    typeLabel: 'Plant',
    illustrationType: 'daisy',
  },
}

export function getSpeciesVisual(id) {
  return speciesVisuals[id] || null
}

export function findSpeciesVisualByScientificName(scientificName) {
  return Object.values(speciesVisuals).find((species) => species.scientificName === scientificName) || null
}
