"use client"

import { useState } from "react"
import { CheckCircle2, LocateFixed, Loader2, MapPin, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { FarmLocation } from "@/app/lib/farmLocation"

type LocationSearchResult = {
  id: number | string
  label: string
  latitude: number
  longitude: number
  timezone: string
}

type Props = {
  value: FarmLocation | null
  onChange: (location: FarmLocation) => void
  fallbackLabel?: string
  disabled?: boolean
}

function formatCoordinates(latitude: number, longitude: number) {
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
}

export default function FarmLocationPicker({ value, onChange, fallbackLabel = "", disabled = false }: Props) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<LocationSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState("")

  const buildLocation = (input: Omit<FarmLocation, "updatedAt">): FarmLocation => ({
    ...input,
    updatedAt: new Date().toISOString(),
  })

  const useDeviceLocation = () => {
    setError("")
    setResults([])

    if (!navigator.geolocation) {
      setError("This browser cannot provide location. Search for your village or town instead.")
      return
    }

    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const label = fallbackLabel.trim().length >= 2
          ? fallbackLabel.trim()
          : "Current farm location"

        onChange(buildLocation({
          label,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "auto",
          source: "device",
        }))
        setLocating(false)
      },
      (locationError) => {
        const message = locationError.code === locationError.PERMISSION_DENIED
          ? "Location permission was not granted. Search for your farm location below instead."
          : "We could not determine your location. Search for your farm location below instead."
        setError(message)
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    )
  }

  const searchLocations = async () => {
    const term = query.trim()
    if (term.length < 2) {
      setError("Type at least two characters to search.")
      return
    }

    setSearching(true)
    setError("")
    try {
      const response = await fetch(`/api/location/search?q=${encodeURIComponent(term)}`)
      const data = await response.json()
      if (!response.ok) throw new Error(data?.message || "Location search failed")

      const nextResults = Array.isArray(data?.results) ? data.results : []
      setResults(nextResults)
      if (nextResults.length === 0) {
        setError("No matching place found. Try a nearby town, district, or PIN code.")
      }
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Location search failed")
      setResults([])
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-sky-200 bg-sky-50/70 p-4">
      <div>
        <p className="text-sm font-semibold text-sky-950">Farm location</p>
        <p className="mt-1 text-xs text-sky-800">
          Used only to fetch the local forecast for irrigation and spray recommendations.
        </p>
      </div>

      <Button type="button" variant="outline" className="w-full border-sky-300 bg-white text-sky-900 hover:bg-sky-100" onClick={useDeviceLocation} disabled={disabled || locating}>
        {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
        {locating ? "Getting your location..." : "Use my current farm location"}
      </Button>

      <div className="flex items-center gap-2 text-xs text-slate-500 before:h-px before:flex-1 before:bg-sky-200 after:h-px after:flex-1 after:bg-sky-200">
        or search manually
      </div>

      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              searchLocations()
            }
          }}
          disabled={disabled || searching}
          placeholder="Village, town, district, or PIN code"
        />
        <Button type="button" size="icon" onClick={searchLocations} disabled={disabled || searching} aria-label="Search farm location">
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
      </div>

      {results.length > 0 && (
        <div className="max-h-48 space-y-2 overflow-auto">
          {results.map((result) => (
            <button
              key={result.id}
              type="button"
              disabled={disabled}
              onClick={() => {
                onChange(buildLocation({
                  label: result.label,
                  latitude: result.latitude,
                  longitude: result.longitude,
                  timezone: result.timezone || "auto",
                  source: "search",
                }))
                setResults([])
              }}
              className="w-full rounded-lg border border-sky-200 bg-white px-3 py-2 text-left transition hover:border-sky-400 hover:bg-sky-100 disabled:opacity-60"
            >
              <span className="block text-sm font-medium text-slate-900">{result.label}</span>
              <span className="mt-0.5 block text-xs text-slate-500">{formatCoordinates(result.latitude, result.longitude)}</span>
            </button>
          ))}
        </div>
      )}

      {value && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
          <div className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>{value.label}</span>
          </div>
          <div className="mt-1 flex items-center gap-1 text-xs text-emerald-800">
            <MapPin className="h-3.5 w-3.5" /> {formatCoordinates(value.latitude, value.longitude)}
          </div>
        </div>
      )}

      {error && <p className="text-xs font-medium text-red-600">{error}</p>}
    </div>
  )
}
