import mapViewData from './dataset/map_view1.json'

type ProjectPrecinctRow = { precinct_id: string; suburb: string }
export type ProjectPrecinct = { id: string; name: string }

/** Authoritative project precincts come from the checked-in Iteration 1 data contract. */
export const projectPrecincts: ProjectPrecinct[] = (mapViewData.suburbs as ProjectPrecinctRow[]).map((row) => ({
  id: row.precinct_id,
  name: row.suburb,
}))

const gardenSourceNames: Record<string, string[]> = {
  'Central City': ['CBD Hoddle Grid'],
  'North and West Melbourne': ['North Melbourne', 'West Melbourne'],
}

/** Source labels are candidate reducers only; polygon containment remains authoritative. */
export function gardenSourceNamesForProjectPrecincts(names: string[]) {
  return Array.from(new Set(names.flatMap((name) => gardenSourceNames[name] || [name])))
}
