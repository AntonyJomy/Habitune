// @ts-nocheck
export const locations = {
  Carlton: { name: 'Carlton, Melbourne', center: [-37.8004, 144.9671] },
  'Melbourne CBD': { name: 'Melbourne CBD', center: [-37.8136, 144.9631] },
  Parkville: { name: 'Parkville, Melbourne', center: [-37.7982, 144.9567] },
  Kensington: { name: 'Kensington, Melbourne', center: [-37.793, 144.927] },
  'North & West Melbourne': { name: 'North & West Melbourne', center: [-37.805, 144.947] },
  Docklands: { name: 'Docklands, Melbourne', center: [-37.817, 144.946] },
  'Central City': { name: 'Central City, Melbourne', center: [-37.813, 144.963] },
  'East Melbourne': { name: 'East Melbourne', center: [-37.812, 144.982] },
  Southbank: { name: 'Southbank, Melbourne', center: [-37.824, 144.964] },
  'South Yarra': { name: 'South Yarra, Melbourne', center: [-37.838, 144.989] },
  'Fishermans Bend': { name: 'Fishermans Bend, Melbourne', center: [-37.828, 144.927] },
}

export const suburbPolygons = [
  { id: 'parkville', name: 'Parkville', positions: [[-37.787,144.943],[-37.787,144.962],[-37.798,144.963],[-37.802,144.951],[-37.797,144.941]] },
  { id: 'carlton', name: 'Carlton', positions: [[-37.798,144.963],[-37.796,144.978],[-37.808,144.979],[-37.811,144.963]] },
  { id: 'kensington', name: 'Kensington', positions: [[-37.786,144.914],[-37.784,144.936],[-37.799,144.941],[-37.806,144.925],[-37.801,144.913]] },
  { id: 'north-west', name: 'North & West Melbourne', label: 'North / West Melbourne', positions: [[-37.799,144.941],[-37.798,144.963],[-37.813,144.963],[-37.817,144.944],[-37.806,144.925]] },
  { id: 'docklands', name: 'Docklands', positions: [[-37.807,144.925],[-37.817,144.944],[-37.827,144.946],[-37.826,144.928],[-37.817,144.918]] },
  { id: 'central-city', name: 'Central City', positions: [[-37.811,144.963],[-37.808,144.979],[-37.821,144.981],[-37.826,144.963],[-37.817,144.944]] },
  { id: 'east-melbourne', name: 'East Melbourne', positions: [[-37.808,144.979],[-37.807,144.993],[-37.821,144.994],[-37.821,144.981]] },
  { id: 'southbank', name: 'Southbank', positions: [[-37.826,144.946],[-37.826,144.975],[-37.835,144.978],[-37.837,144.948]] },
  { id: 'south-yarra', name: 'South Yarra', positions: [[-37.828,144.978],[-37.822,144.997],[-37.847,145.004],[-37.847,144.981],[-37.837,144.973]] },
  { id: 'fishermans-bend', name: 'Fishermans Bend', positions: [[-37.826,144.915],[-37.826,144.946],[-37.84,144.95],[-37.848,144.921]] },
]

export const trees = [
  { id: 't1', position: [-37.7991, 144.9652], commonName: 'River Red Gum', scientificName: 'Eucalyptus camaldulensis', treeType: 'Native evergreen', source: 'Mock City of Melbourne tree record' },
  { id: 't2', position: [-37.8022, 144.9694], commonName: 'Moreton Bay Fig', scientificName: 'Ficus macrophylla', treeType: 'Native evergreen', source: 'Mock City of Melbourne tree record' },
  { id: 't3', position: [-37.7977, 144.9708], commonName: 'Spotted Gum', scientificName: 'Corymbia maculata', treeType: 'Native evergreen', source: 'Mock City of Melbourne tree record' },
  { id: 't4', position: [-37.8036, 144.9641], commonName: 'English Elm', scientificName: 'Ulmus procera', treeType: 'Deciduous street tree', source: 'Mock City of Melbourne tree record' },
]

export const observations = [
  { id: 'f1', kind: 'flora', position: [-37.7987, 144.9684], species: 'Correa', scientificName: 'Correa reflexa', type: 'Flora observation', date: '12 May 2026', source: 'Mock biodiversity record' },
  { id: 'f2', kind: 'flora', position: [-37.8014, 144.9633], species: 'Native Daisy', scientificName: 'Brachyscome multifida', type: 'Flora observation', date: '28 April 2026', source: 'Mock biodiversity record' },
  { id: 'a1', kind: 'fauna', position: [-37.7972, 144.966], species: 'Rainbow Lorikeet', scientificName: 'Trichoglossus moluccanus', type: 'Fauna observation', date: '03 June 2026', source: 'Mock biodiversity record' },
  { id: 'a2', kind: 'fauna', pollinatorGroup: 'nativeBees', position: [-37.8011, 144.971], species: 'Common Blue-banded Bee', scientificName: 'Amegilla cingulata', type: 'Pollinator observation', date: '19 March 2026', source: 'Mock biodiversity record', observationCount: 7, lastObserved: '19 March 2026', nativeStatus: 'Native', supportedPlants: ['Blue flax-lily', 'Native mint', 'Coast rosemary'] },
  { id: 'a4', kind: 'fauna', pollinatorGroup: 'butterfliesMoths', position: [-37.7984, 144.9637], species: 'Common Brown Butterfly', scientificName: 'Heteronympha merope', type: 'Pollinator observation', date: '02 April 2026', source: 'Mock biodiversity record', observationCount: 5, lastObserved: '02 April 2026', nativeStatus: 'Native', supportedPlants: ['Kangaroo grass', 'Wallaby grass', 'Native violet'] },
  { id: 'a5', kind: 'fauna', pollinatorGroup: 'hoverflies', position: [-37.803, 144.9688], species: 'Yellow-shouldered Hoverfly', scientificName: 'Simosyrphus grandicornis', type: 'Pollinator observation', date: '22 February 2026', source: 'Mock biodiversity record', observationCount: 4, lastObserved: '22 February 2026', nativeStatus: 'Native', supportedPlants: ['Native daisy', 'Correa', 'Grevillea'] },
  { id: 'a6', kind: 'fauna', pollinatorGroup: 'otherPollinators', position: [-37.8001, 144.9655], species: 'European Honey Bee', scientificName: 'Apis mellifera', type: 'Pollinator observation', date: '08 May 2026', source: 'Mock biodiversity record', observationCount: 12, lastObserved: '08 May 2026', nativeStatus: 'Introduced', supportedPlants: ['Rosemary', 'Lavender', 'Citrus'] },
  { id: 'a3', kind: 'wildlife', position: [-37.8041, 144.9668], species: 'Common Brushtail Possum', scientificName: 'Trichosurus vulpecula', type: 'Other wildlife observation', date: '07 February 2026', source: 'Mock biodiversity record' },
]

// Prototype activity / potential-use areas inferred around observations. These are
// intentionally not labelled as verified habitat.
export const ecologicalActivityAreas = [
  { id: 'ea1', name: 'Blue-banded bee activity area', category: 'pollinator', observationId: 'a2', center: [-37.8011, 144.971], radius: 105, source: 'Prototype area inferred from mock observation' },
  { id: 'ea2', name: 'Butterfly activity area', category: 'pollinator', observationId: 'a4', center: [-37.7984, 144.9637], radius: 90, source: 'Prototype area inferred from mock observation' },
  { id: 'ea3', name: 'Hoverfly activity area', category: 'pollinator', observationId: 'a5', center: [-37.803, 144.9688], radius: 80, source: 'Prototype area inferred from mock observation' },
  { id: 'ea4', name: 'Honey bee activity area', category: 'pollinator', observationId: 'a6', center: [-37.8001, 144.9655], radius: 85, source: 'Prototype area inferred from mock observation' },
  { id: 'ea5', name: 'Lorikeet activity area', category: 'bird', observationId: 'a1', center: [-37.7972, 144.966], radius: 115, source: 'Prototype area inferred from mock observation' },
  { id: 'ea6', name: 'Possum potential-use area', category: 'wildlife', observationId: 'a3', center: [-37.8041, 144.9668], radius: 100, source: 'Prototype area inferred from mock observation' },
  { id: 'ea7', name: 'Correa flora area', category: 'flora', observationId: 'f1', center: [-37.7987, 144.9684], radius: 75, source: 'Prototype area inferred from mock observation' },
]

export const pollinationCorridors = [
  { id: 'pc1', name: 'University green-link corridor', status: 'existing', quality: 'high', geometry: [[-37.7971, 144.9612], [-37.7984, 144.9637], [-37.8001, 144.9655], [-37.8011, 144.971]], connectedAreas: ['University habitat patch', 'Butterfly activity area', 'Carlton tree cluster', 'Blue-banded bee activity area'], explanation: 'Links established vegetation and tree cover so pollinators can move between feeding and shelter areas with fewer exposed gaps.', source: 'Prototype corridor connecting mock green spaces and observations' },
  { id: 'pc2', name: 'Carlton street-garden link', status: 'existing', quality: 'medium', geometry: [[-37.8014, 144.9633], [-37.8001, 144.9655], [-37.8018, 144.9676], [-37.803, 144.9688]], connectedAreas: ['Native Daisy flora area', 'Honey bee activity area', 'Neighbourhood street trees', 'Hoverfly activity area'], explanation: 'Connects small garden and street-tree stepping stones that help pollinators cross the built-up neighbourhood.', source: 'Prototype corridor connecting mock flora and tree clusters' },
  { id: 'pc3', name: 'Southern pollinator opportunity', status: 'potential', quality: 'low', geometry: [[-37.803, 144.9688], [-37.8038, 144.9705], [-37.8047, 144.9723]], connectedAreas: ['Hoverfly activity area', 'Southern tree cluster', 'Neighbourhood green space'], explanation: 'Highlights a vegetation gap where additional flowering plants or canopy could strengthen connectivity to the southern green space.', source: 'Prototype opportunity inferred from gaps between green spaces' },
]

export const suburbBoundary = [[-37.7952,144.958],[-37.7951,144.9735],[-37.8066,144.9742],[-37.8068,144.9583]]

export const canopyPolygons = [
  { id: 'c1', name: 'Canopy patch A', positions: [[-37.7986,144.9639],[-37.7973,144.965],[-37.798,144.967],[-37.7995,144.9662]], source: 'Mock canopy geometry' },
  { id: 'c2', name: 'Canopy patch B', positions: [[-37.8027,144.9677],[-37.8012,144.969],[-37.8021,144.971],[-37.8035,144.9701]], source: 'Mock canopy geometry' },
  { id: 'c3', name: 'Canopy patch C', positions: [[-37.801,144.9624],[-37.7998,144.9632],[-37.8005,144.965],[-37.8018,144.9642]], source: 'Mock canopy geometry' },
]

export const habitatPolygons = [
  { id: 'h1', name: 'University habitat patch', positions: [[-37.7968,144.9589],[-37.7957,144.9616],[-37.7971,144.963],[-37.7984,144.9605]], source: 'Mock habitat geometry' },
  { id: 'h2', name: 'Neighbourhood green space', positions: [[-37.8045,144.9704],[-37.8033,144.9726],[-37.8051,144.9737],[-37.806,144.9715]], source: 'Mock habitat geometry' },
]

export const summary = [
  { label: 'Urban Trees', value: '126', category: 'tree' },
  { label: 'Recorded Species', value: '42', category: 'flora' },
  { label: 'Fauna Observations', value: '34', category: 'wildlife' },
  { label: 'Tree Canopy', value: '21%', category: 'canopy' },
]

export const species = [
  { id: 'rainbow-lorikeet', visualId: 'rainbowLorikeet', count: 12, source: 'Mock ALA record' },
  { id: 'blue-banded-bee', visualId: 'blueBandedBee', count: 7, source: 'Mock biodiversity record' },
  { id: 'correa', visualId: 'correa', count: 9, source: 'Mock flora record' },
  { id: 'native-daisy', visualId: 'nativeDaisy', count: 14, source: 'Mock flora record' },
]
