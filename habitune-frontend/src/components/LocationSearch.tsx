// @ts-nocheck
import { useState } from 'react'
import { Search } from 'lucide-react'
import { getLocationSuggestions, resolveLocation } from '../services/locationSearchApi'

export default function LocationSearch({ onChoose, suburbs = [] }) {
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [focused, setFocused] = useState(false)
  const [searching, setSearching] = useState(false)
  const matches = getLocationSuggestions(query, suburbs)
  const choose = (area) => { setError(''); setQuery(area.primary); onChoose(area.suburb, area.searchedLocation) }
  const submit = async (event) => {
    event.preventDefault()
    if (!query.trim()) return setError('Enter a suburb, street, address, place or postcode.')
    setSearching(true)
    setError('')
    const result = await resolveLocation(query, suburbs)
    setSearching(false)
    if (result.status === 'supported') return onChoose(result.suburb, result.searchedLocation)
    if (result.status === 'outside') return setError('This location is outside the current Habitune study area.')
    if (result.status === 'unavailable') return setError('Location search is temporarily unavailable. Please try again.')
    setError('No matching location found. Try another suburb, street, address or postcode.')
  }
  return (
    <form className="location-search" onSubmit={submit}>
      <label htmlFor="location">Search for a Melbourne location</label>
      <div className="location-search-box"><div className="search-row"><Search size={19} aria-hidden="true" /><input id="location" type="search" value={query} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} onChange={(event) => { setQuery(event.target.value); setError('') }} placeholder="Search suburb, street, address or postcode" autoComplete="off" aria-autocomplete="list" aria-expanded={focused && matches.length > 0} aria-controls="location-results" />{searching && <span className="searching-indicator">Searching…</span>}</div>{focused && matches.length > 0 && <div className="search-suggestions" id="location-results" role="listbox" aria-label="Matching Melbourne locations">{matches.map((area) => <button key={`${area.type}-${area.primary}`} type="button" role="option" onMouseDown={(event) => event.preventDefault()} onClick={() => choose(area)}><Search size={14} aria-hidden="true" /><span><strong>{area.primary}</strong><small>{area.secondary}</small></span><em>{area.type}</em></button>)}<small className="search-attribution">Search data © OpenStreetMap contributors</small></div>}</div>
      {error && <p className="error" role="alert">{error}</p>}
      <p className="source-note"><span>●</span> Using Melbourne open biodiversity and urban forest data</p>
    </form>
  )
}
