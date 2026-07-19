import { NextResponse } from "next/server"

type OpenMeteoLocation = {
  id?: number
  name?: string
  admin1?: string
  admin2?: string
  country?: string
  latitude?: number
  longitude?: number
  timezone?: string
}

function makeLabel(location: OpenMeteoLocation) {
  const parts = [location.name, location.admin2, location.admin1, location.country]
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .map(part => part.trim())

  return [...new Set(parts)].join(", ")
}

export async function GET(req: Request) {
  const query = new URL(req.url).searchParams.get("q")?.trim() || ""
  if (query.length < 2 || query.length > 120) {
    return NextResponse.json({ message: "Enter at least two characters to search for a farm location." }, { status: 400 })
  }

  const params = new URLSearchParams({
    name: query,
    count: "6",
    language: "en",
  })
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)

  try {
    const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params.toString()}`, {
      cache: "no-store",
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`Open-Meteo geocoding returned ${response.status}`)

    const data = await response.json()
    const results = (Array.isArray(data?.results) ? data.results : [])
      .filter((location: OpenMeteoLocation) =>
        typeof location?.name === "string" &&
        Number.isFinite(location?.latitude) &&
        Number.isFinite(location?.longitude),
      )
      .map((location: OpenMeteoLocation) => ({
        id: location.id ?? `${location.latitude},${location.longitude}`,
        label: makeLabel(location),
        latitude: Number(location.latitude),
        longitude: Number(location.longitude),
        timezone: location.timezone || "auto",
      }))

    return NextResponse.json({ results })
  } catch {
    return NextResponse.json(
      { message: "Location search is temporarily unavailable. You can use your device location instead." },
      { status: 502 },
    )
  } finally {
    clearTimeout(timeout)
  }
}
