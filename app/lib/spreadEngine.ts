/**
 * Deterministic, weather-aware disease-spread projection for the farm map.
 *
 * This is intentionally a model, not a diagnosis or an agronomy prescription.
 * It consumes active detections, the real A1–B6 zone graph, and current
 * weather/climate signals to compare protection strategies consistently across
 * the UI. Fixed seeds make a result reproducible for a given input snapshot.
 */

export type SpreadSeverity = "low" | "moderate" | "high"

export type SpreadZone = {
  id: string
  row: number
  col: number
  soilMoisture: number
  disease?: string
  severityLevel?: SpreadSeverity
  severityScore?: number
  mlConfidence?: number
  activeDetection?: boolean
}

export type SpreadDetection = {
  id: string
  zoneId: string
  disease?: string
  severityLevel?: string
  confidence?: number
  status?: string
  cropMatch?: "matched" | "review" | "not_applicable"
}

export type SpreadWeather = {
  source: "live" | "cached" | "fallback"
  current: {
    temperature: number
    humidity: number
    precipitation: number
    windSpeed: number
    description: string
  }
  derived: {
    nextRainHours: number | null
    totalRain24h: number
    fungalPressure: { score: number; band: "low" | "moderate" | "high"; drivers: string[] }
  }
}

export type SpreadClimate = {
  fresh: boolean
  humidity: number | null
  temperature: number | null
  vpd: number | null
}

export type SpreadEngineInput = {
  zones: SpreadZone[]
  detections: SpreadDetection[]
  weather: SpreadWeather
  climate: SpreadClimate
  days?: number
  runs?: number
  budget?: number
  seed?: number
}

export type SpreadTimelinePoint = {
  day: number
  expectedInfected: number
  expectedNewInfections: number
  zoneProbability: Record<string, number>
}

export type SpreadSimulation = {
  protectedZoneIds: string[]
  timeline: SpreadTimelinePoint[]
  finalExpectedInfected: number
  finalExpectedNewInfections: number
}

export type SpreadBottleneck = {
  zoneId: string
  projectedInfectionsAvoided: number
  isArticulationPoint: boolean
  degree: number
  rationale: string
}

export type SpreadPlan = {
  engineVersion: "farm-spread-v1"
  modelLabel: "Weather-aware model projection"
  generatedFrom: {
    activeDetectionCount: number
    seedZoneIds: string[]
    weatherSource: SpreadWeather["source"]
    fieldClimateSource: "dht11" | "regional-weather"
    assumptions: string[]
  }
  graph: {
    nodes: { id: string; row: number; col: number; soilMoisture: number }[]
    edges: { source: string; target: string }[]
  }
  urgency: {
    headline: string
    actWithinHours: number | null
    reason: string
  }
  baseline: SpreadSimulation
  protected: SpreadSimulation
  bottlenecks: SpreadBottleneck[]
}

type SeededRandom = () => number

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function normalizeSeverity(level?: string): SpreadSeverity {
  if (level === "high") return "high"
  if (level === "moderate" || level === "medium") return "moderate"
  return "low"
}

function hash(value: string) {
  let result = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index)
    result = Math.imul(result, 16777619)
  }
  return result >>> 0
}

function createRandom(seed: number): SeededRandom {
  let state = seed >>> 0
  return () => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function buildAdjacency(zones: SpreadZone[]) {
  const neighbors = new Map<string, string[]>()
  zones.forEach((zone) => neighbors.set(zone.id, []))

  for (let left = 0; left < zones.length; left += 1) {
    for (let right = left + 1; right < zones.length; right += 1) {
      const a = zones[left]
      const b = zones[right]
      const orthogonal = Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1
      if (!orthogonal) continue
      neighbors.get(a.id)?.push(b.id)
      neighbors.get(b.id)?.push(a.id)
    }
  }

  return neighbors
}

function makeEdges(adjacency: Map<string, string[]>) {
  const edges: { source: string; target: string }[] = []
  adjacency.forEach((targets, source) => {
    targets.forEach((target) => {
      if (source < target) edges.push({ source, target })
    })
  })
  return edges
}

function activeSeedMap(input: SpreadEngineInput) {
  const seeds = new Map<string, { severity: SpreadSeverity; confidence: number }>()
  input.detections
    .filter((detection) => detection.status === "active" && detection.cropMatch !== "review")
    .forEach((detection) => {
      const previous = seeds.get(detection.zoneId)
      const severity = normalizeSeverity(detection.severityLevel)
      const confidence = clamp(Number(detection.confidence) || 0.5, 0.2, 1)
      if (!previous || confidence > previous.confidence) {
        seeds.set(detection.zoneId, { severity, confidence })
      }
    })

  // `zones` supports a live UI state even before an API process has hydrated
  // the database. It is only used if the database supplied no active seeds.
  if (seeds.size === 0) {
    input.zones
      .filter((zone) => zone.activeDetection)
      .forEach((zone) => {
        seeds.set(zone.id, {
          severity: zone.severityLevel || "moderate",
          confidence: clamp(Number(zone.mlConfidence) || 0.5, 0.2, 1),
        })
      })
  }

  return seeds
}

function spreadProbability(input: {
  sourceSeverity: SpreadSeverity
  sourceConfidence: number
  targetSoilMoisture: number
  weather: SpreadWeather
  climate: SpreadClimate
}) {
  const severityFactor = input.sourceSeverity === "high" ? 0.12 : input.sourceSeverity === "moderate" ? 0.08 : 0.045
  const confidenceFactor = 0.55 + input.sourceConfidence * 0.45
  const humidity = input.climate.fresh && input.climate.humidity != null
    ? input.climate.humidity
    : input.weather.current.humidity
  const temperature = input.climate.fresh && input.climate.temperature != null
    ? input.climate.temperature
    : input.weather.current.temperature
  const humidityFactor = clamp((humidity - 60) / 35, 0, 1)
  const wetSoilFactor = clamp((input.targetSoilMoisture - 40) / 45, 0, 1)
  const rainFactor = input.weather.current.precipitation >= 0.1 || input.weather.derived.nextRainHours === 0
    ? 1
    : input.weather.derived.totalRain24h >= 2
      ? 0.7
      : input.weather.derived.nextRainHours != null && input.weather.derived.nextRainHours <= 12
        ? 0.45
        : 0
  const temperatureFactor = temperature >= 18 && temperature <= 30 ? 1 : temperature >= 14 && temperature <= 34 ? 0.55 : 0.2

  // Dry soil does not create an automatic fungal-risk uplift. It merely
  // removes the zone-level moisture contribution while farm-wide leaf-climate
  // and rain signals can still matter.
  const environmentalFactor = 0.45 + humidityFactor * 0.2 + wetSoilFactor * 0.15 + rainFactor * 0.2
  return clamp(severityFactor * confidenceFactor * environmentalFactor * temperatureFactor, 0.01, 0.32)
}

function simulate(
  input: SpreadEngineInput,
  adjacency: Map<string, string[]>,
  seedMap: Map<string, { severity: SpreadSeverity; confidence: number }>,
  protectedZoneIds: string[],
  seed: number,
) {
  const days = clamp(Math.round(input.days ?? 5), 1, 14)
  const runs = clamp(Math.round(input.runs ?? 350), 50, 1000)
  const protectedSet = new Set(protectedZoneIds)
  const zonesById = new Map(input.zones.map((zone) => [zone.id, zone]))
  const probabilitySums = Array.from({ length: days + 1 }, () => new Map<string, number>())
  const expectedCounts = new Array<number>(days + 1).fill(0)

  for (let run = 0; run < runs; run += 1) {
    const random = createRandom(seed + run * 7919)
    const infected = new Set<string>(seedMap.keys())

    for (let day = 0; day <= days; day += 1) {
      expectedCounts[day] += infected.size
      infected.forEach((zoneId) => {
        probabilitySums[day].set(zoneId, (probabilitySums[day].get(zoneId) || 0) + 1)
      })
      if (day === days) break

      const nextInfected = new Set(infected)
      infected.forEach((sourceId) => {
        const source = seedMap.get(sourceId) || {
          severity: zonesById.get(sourceId)?.severityLevel || "moderate",
          confidence: clamp(Number(zonesById.get(sourceId)?.mlConfidence) || 0.55, 0.2, 1),
        }
        adjacency.get(sourceId)?.forEach((targetId) => {
          if (infected.has(targetId) || protectedSet.has(targetId)) return
          const target = zonesById.get(targetId)
          if (!target) return
          const probability = spreadProbability({
            sourceSeverity: source.severity,
            sourceConfidence: source.confidence,
            targetSoilMoisture: target.soilMoisture,
            weather: input.weather,
            climate: input.climate,
          })
          if (random() < probability) nextInfected.add(targetId)
        })
      })
      infected.clear()
      nextInfected.forEach((zoneId) => infected.add(zoneId))
    }
  }

  const timeline: SpreadTimelinePoint[] = expectedCounts.map((count, day) => {
    const zoneProbability: Record<string, number> = {}
    input.zones.forEach((zone) => {
      zoneProbability[zone.id] = Number(((probabilitySums[day].get(zone.id) || 0) / runs).toFixed(3))
    })
    return {
      day,
      expectedInfected: Number((count / runs).toFixed(2)),
      expectedNewInfections: day === 0 ? 0 : Number(((count - expectedCounts[day - 1]) / runs).toFixed(2)),
      zoneProbability,
    }
  })

  const final = timeline[timeline.length - 1]
  return {
    protectedZoneIds: [...protectedZoneIds],
    timeline,
    finalExpectedInfected: final.expectedInfected,
    finalExpectedNewInfections: final.expectedNewInfections,
  } satisfies SpreadSimulation
}

function findArticulationPoints(adjacency: Map<string, string[]>) {
  const visited = new Set<string>()
  const discovery = new Map<string, number>()
  const low = new Map<string, number>()
  const parents = new Map<string, string | null>()
  const points = new Set<string>()
  let time = 0

  const visit = (node: string) => {
    visited.add(node)
    time += 1
    discovery.set(node, time)
    low.set(node, time)
    let children = 0

    adjacency.get(node)?.forEach((neighbor) => {
      if (!visited.has(neighbor)) {
        children += 1
        parents.set(neighbor, node)
        visit(neighbor)
        low.set(node, Math.min(low.get(node) || Infinity, low.get(neighbor) || Infinity))
        const parent = parents.get(node) ?? null
        if ((parent === null && children > 1) || (parent !== null && (low.get(neighbor) || 0) >= (discovery.get(node) || 0))) {
          points.add(node)
        }
      } else if (neighbor !== parents.get(node)) {
        low.set(node, Math.min(low.get(node) || Infinity, discovery.get(neighbor) || Infinity))
      }
    })
  }

  adjacency.forEach((_neighbors, node) => {
    if (!visited.has(node)) {
      parents.set(node, null)
      visit(node)
    }
  })
  return points
}

function buildUrgency(weather: SpreadWeather, climate: SpreadClimate) {
  const fieldHumidity = climate.fresh && climate.humidity != null ? climate.humidity : weather.current.humidity
  const rainIn = weather.derived.nextRainHours
  if (weather.current.precipitation >= 0.1 || rainIn === 0) {
    return { headline: "Rain conditions can accelerate leaf wetness", actWithinHours: 12, reason: "Rain is reported now; prepare containment and wait for the next verified safe spray window." }
  }
  if (rainIn != null && rainIn <= 18) {
    return { headline: "Forecast rain increases containment urgency", actWithinHours: Math.max(2, Math.round(rainIn)), reason: `Rain is projected in about ${rainIn} hours; inspect and prepare the protection plan before that window.` }
  }
  if (fieldHumidity >= 80) {
    return { headline: "High humidity supports disease spread", actWithinHours: 24, reason: "High field humidity raises foliar-disease pressure; prioritize the active detection and its neighbours today." }
  }
  return { headline: "No immediate rain-driven acceleration", actWithinHours: null, reason: "Use the model projection to sequence scouting and protection; continue checking the next forecast update." }
}

export function buildSpreadPlan(input: SpreadEngineInput): SpreadPlan {
  const zones = [...input.zones].sort((a, b) => a.row - b.row || a.col - b.col)
  const adjacency = buildAdjacency(zones)
  const seedMap = activeSeedMap({ ...input, zones })
  const seed = input.seed ?? hash([
    ...zones.map((zone) => `${zone.id}:${zone.soilMoisture}`),
    ...[...seedMap.entries()].map(([zoneId, value]) => `${zoneId}:${value.severity}:${value.confidence}`),
    input.weather.current.description,
    input.weather.current.humidity,
  ].join("|"))
  const baseline = simulate({ ...input, zones }, adjacency, seedMap, [], seed)
  const articulationPoints = findArticulationPoints(adjacency)
  const candidates = zones
    .filter((zone) => !seedMap.has(zone.id))
    .map((zone) => zone.id)
  const budget = clamp(Math.round(input.budget ?? 2), 1, Math.max(1, candidates.length))
  const chosen: string[] = []
  const bottlenecks: SpreadBottleneck[] = []
  let currentSimulation = baseline

  for (let slot = 0; slot < budget; slot += 1) {
    let best: { zoneId: string; simulation: SpreadSimulation; impact: number } | null = null
    for (const zoneId of candidates) {
      if (chosen.includes(zoneId)) continue
      const simulation = simulate({ ...input, zones }, adjacency, seedMap, [...chosen, zoneId], seed)
      const impact = currentSimulation.finalExpectedInfected - simulation.finalExpectedInfected
      if (!best || impact > best.impact || (impact === best.impact && zoneId < best.zoneId)) {
        best = { zoneId, simulation, impact }
      }
    }
    if (!best) break
    chosen.push(best.zoneId)
    const degree = adjacency.get(best.zoneId)?.length || 0
    bottlenecks.push({
      zoneId: best.zoneId,
      projectedInfectionsAvoided: Number(Math.max(0, best.impact).toFixed(2)),
      isArticulationPoint: articulationPoints.has(best.zoneId),
      degree,
      rationale: articulationPoints.has(best.zoneId)
        ? "Connects field sections in the real four-neighbour zone graph."
        : `Ranks highest in the current weather-aware protection comparison (${degree} adjacent zone${degree === 1 ? "" : "s"}).`,
    })
    currentSimulation = best.simulation
  }

  const climateSource = input.climate.fresh ? "dht11" : "regional-weather"
  return {
    engineVersion: "farm-spread-v1",
    modelLabel: "Weather-aware model projection",
    generatedFrom: {
      activeDetectionCount: seedMap.size,
      seedZoneIds: [...seedMap.keys()].sort(),
      weatherSource: input.weather.source,
      fieldClimateSource: climateSource,
      assumptions: [
        "Only orthogonally adjacent zones can transmit in this projection.",
        "Rain, field humidity, temperature, source severity, confidence, and receiver soil moisture affect probability.",
        "Dry soil does not create a fungal-risk uplift by itself.",
        "Protected zones are modelled as blocked transmission targets; results are probabilities, not confirmed infections.",
      ],
    },
    graph: {
      nodes: zones.map((zone) => ({ id: zone.id, row: zone.row, col: zone.col, soilMoisture: zone.soilMoisture })),
      edges: makeEdges(adjacency),
    },
    urgency: buildUrgency(input.weather, input.climate),
    baseline,
    protected: currentSimulation,
    bottlenecks,
  }
}
