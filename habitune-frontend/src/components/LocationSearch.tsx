// @ts-nocheck
import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { getLocationSuggestions, resolveLocation, searchLocationSuggestions } from '../services/locationSearchApi'

export default function LocationSearch({ onChoose, suburbs = [] }) {
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [focused, setFocused] = useState(false)
  const [searching, setSearching] = useState(false)
  const [remoteMatches, setRemoteMatches] = useState([])
  const localMatches = getLocationSuggestions(query, suburbs)
  const matches = useMemo(() => {
    const seen = new Set()
    return [...localMatches, ...remoteMatches].filter((area) => {
      const key = `${area.primary}-${area.suburb}`.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    }).slice(0, 6)
  }, [localMatches, remoteMatches])

  useEffect(() => {
    const term = query.trim()
    setRemoteMatches([])
    setSearching(false)
    if (term.length < 3) return undefined

    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setSearching(true)
      searchLocationSuggestions(term, suburbs, controller.signal)
        .then(setRemoteMatches)
        .catch((requestError) => {
          if (requestError?.name !== 'AbortError') setRemoteMatches([])
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearching(false)
        })
    }, 450)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [query, suburbs])

  const choose = (area) => {
    setError('')
    setQuery(area.primary)
    setFocused(false)
    onChoose(area.suburb, area.searchedLocation)
  }

  const submit = async (event) => {
    event.preventDefault()
    if (!query.trim()) return setError('Enter a suburb, street, address, place or postcode.')
    setSearching(true)
    setError('')
    const result = await resolveLocation(query, suburbs)
    setSearching(false)
    if (result.status === 'supported') {
      setFocused(false)
      return onChoose(result.suburb, result.searchedLocation)
    }
    if (result.status === 'outside') return setError('This location is outside the current Habitune study area.')
    if (result.status === 'unavailable') return setError('Location search is temporarily unavailable. Please try again.')
    setError('No matching location found. Try another suburb, street, address or postcode.')
  }

  return (
    <form className={`location-search${error ? ' has-error' : ''}`} onSubmit={submit}>
      <label htmlFor="location">Search for a Melbourne location</label>
      <div className="location-search-box">
        <div className="search-row">
          <Search size={19} aria-hidden="true" />
          <input
            id="location"
            type="search"
            value={query}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault()
                setFocused(false)
                event.currentTarget.blur()
              }
            }}
            onChange={(event) => {
              setQuery(event.target.value)
              setError('')
              setFocused(true)
            }}
            placeholder="Search suburb, street, address or postcode"
            autoComplete="off"
            aria-autocomplete="list"
            aria-expanded={focused && Boolean(query.trim())}
            aria-controls="location-results"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'location-error' : undefined}
          />
          {searching && <span className="searching-indicator">Searching…</span>}
        </div>
        {focused && query.trim() && (
          <div className="search-suggestions" id="location-results" role="listbox" aria-label="Matching Melbourne locations">
            {matches.map((area) => (
              <button key={`${area.type}-${area.primary}`} type="button" role="option" onMouseDown={(event) => event.preventDefault()} onClick={() => choose(area)}>
                <Search size={14} aria-hidden="true" />
                <span><strong>{area.primary}</strong><small>{area.secondary}</small></span>
                <em>{area.type}</em>
              </button>
            ))}
            {!searching && matches.length === 0 && <p className="search-no-match">No location inside the supported precincts was found. Press Enter to verify the address.</p>}
            <small className="search-attribution">Search data © OpenStreetMap contributors</small>
          </div>
        )}
      </div>
      {error && <p className="error" id="location-error" role="alert">{error}</p>}
      <p className="source-note"><span>●</span> Using Melbourne open biodiversity and urban forest data</p>
    </form>
  )
}
