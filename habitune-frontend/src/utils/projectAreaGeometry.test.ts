import { describe, expect, it } from 'vitest'
import { findProjectPrecinct, isInsideProjectArea, projectAreaPolygons, projectPrecinctsNearViewport } from './projectAreaGeometry'

describe('Habitune project-area geometry', () => {
  it('finds a point inside a project polygon', () => expect(findProjectPrecinct(144.9672, -37.8001)).toBe('Carlton'))
  it('rejects a point outside despite a potentially matching source label', () => expect(findProjectPrecinct(144.87, -37.84)).toBeNull())
  it('treats polygon boundary points as contained', () => {
    expect(findProjectPrecinct(144.97400782800003, -37.80311035008592)).toBe('Carlton')
  })
  it('finds project polygons intersecting a viewport', () => {
    expect(projectPrecinctsNearViewport({ west: 144.95, south: -37.81, east: 144.98, north: -37.79 })).toContain('Carlton')
  })
  it('extracts all Polygon and MultiPolygon parts from the authoritative geometry', () => {
    expect(projectAreaPolygons.length).toBeGreaterThanOrEqual(10)
    expect(projectAreaPolygons.every((polygon) => polygon.length > 0 && polygon[0].length >= 4)).toBe(true)
  })
  it('gates Identify to the project area', () => {
    expect(isInsideProjectArea(144.9672, -37.8001)).toBe(true)
    expect(isInsideProjectArea(145.2, -37.8)).toBe(false)
  })
})
