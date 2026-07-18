"use client"

import { useEffect, useState } from "react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Info } from "lucide-react"
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts"

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<any>(null)
  const [historyData, setHistoryData] = useState<any>(null)
  const [showFormulas, setShowFormulas] = useState(false)

  const CalculationDetails = ({ title, formulas }: { title: string, formulas: { label: string, math: string, desc: string }[] }) => (
    <Card className={`mt-8 border-none bg-gradient-to-br from-slate-900 via-green-950 to-slate-900 text-white shadow-2xl overflow-hidden rounded-[2rem] border border-white/5 transition-all duration-700 ${showFormulas ? 'opacity-100 max-h-[2000px]' : 'opacity-0 max-h-0 pointer-events-none'}`}>
      <CardHeader className="py-6 border-b border-white/10 bg-black/40 backdrop-blur-2xl">
        <CardTitle className="text-[11px] font-black flex items-center gap-4 text-emerald-400 uppercase tracking-[0.4em] antialiased">
          <div className="h-4 w-1 bg-emerald-500 rounded-full shadow-[0_0_15px_#10b981]" />
          Engine Neural Logic: {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid md:grid-cols-1 lg:grid-cols-3 divide-x divide-y lg:divide-y-0 divide-white/10 outline-none">
          {formulas.map((f, i) => (
            <div key={i} className="p-8 space-y-6 hover:bg-white/[0.03] transition-all duration-700 ease-in-out group relative cursor-default">
              <div className="space-y-4">
                <span className="text-[10px] font-black text-emerald-500/40 uppercase tracking-widest">{f.label}</span>
                <div className="relative">
                  <div className="absolute -inset-2 bg-emerald-500 rounded-2xl blur-xl opacity-0 group-hover:opacity-20 transition duration-700" />
                  <code className="relative block bg-black/60 backdrop-blur-md px-4 py-4 rounded-xl border border-white/10 text-[13px] font-mono font-medium text-emerald-100 text-center overflow-x-auto whitespace-nowrap shadow-inner border-t-emerald-500/20">
                    {f.math}
                  </code>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed font-semibold group-hover:text-slate-200 transition-colors duration-500 border-l-2 border-emerald-900/50 pl-4 py-1">
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );

  const normalizeSeverityLevel = (level?: string): "low" | "moderate" | "high" => {
    if (level === "high") return "high"
    if (level === "medium" || level === "moderate") return "moderate"
    return "low"
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        const a = await fetch("/api/analytics")
        const aData = await a.json()
        setAnalytics(aData)

        const historyDataRaw = await fetch("/api/history")
        const hData = await historyDataRaw.json()
        setHistoryData(hData)
      } catch (err) {
        console.error("Analytics fetch error:", err)
      }
    }

    fetchData()
  }, [])

  if (!analytics) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">
          Loading Intelligence Engine...
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Intelligence Analytics</h1>
            <p className="text-muted-foreground font-medium">Headline risk &amp; stability reflect currently active detections; detailed zone, spray, disease, and trend views aggregate the full scan history.</p>
          </div>
          <Button 
            variant="outline" 
            onClick={() => setShowFormulas(!showFormulas)}
            className={`rounded-full px-6 font-bold transition-all duration-300 ${showFormulas ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-emerald-600 border-emerald-200'}`}
          >
            {showFormulas ? "Hide Core Logic" : "Inspect Neural Logic"}
          </Button>
        </div>

        <Tabs defaultValue="stability" className="w-full">

          <TabsList className="mb-6">
            <TabsTrigger value="stability">Farm Stability</TabsTrigger>
            <TabsTrigger value="zones">Zone Intelligence</TabsTrigger>
            <TabsTrigger value="spraying">Spraying Intelligence</TabsTrigger>
            <TabsTrigger value="disease">Disease Intelligence</TabsTrigger>
            <TabsTrigger value="impact">AI Impact & Executive</TabsTrigger>
          </TabsList>

          {/* TAB 1 */}
          <TabsContent value="stability">
            <div className="space-y-6">
              {/* ================= SECTION 1A – STABILITY CORE ENGINE ================= */}

              {(() => {
                /* ============================================================
                   RAW EXTRACTION
                ============================================================ */

                const detections = historyData?.detections || []
                const sprays = historyData?.sprays || []

                const totalDetections = detections.length
                const totalSprays = sprays.length

                let high = 0
                let medium = 0
                let low = 0

                detections.forEach((d: any) => {
                  if (d.severityLevel === "high") high++
                  else if (normalizeSeverityLevel(d.severityLevel) === "moderate") medium++
                  else if (d.severityLevel === "low") low++
                })

                const totalSeverity = high + medium + low || 1

                /* ============================================================
                   BACKEND-ALIGNED WEIGHTED RISK (6 / 3 / 1)
                ============================================================ */

                // Use the same farm-wide risk score the Farm Map shows
                // (severity × confidence × freshness, per zone) so the headline
                // risk/stability numbers agree across the app.
                const weightedRiskPercent =
                  Number(analytics?.currentRiskPercent ?? 0)

                /* ============================================================
                   DETECTION PRESSURE INDEX
                   Measures disease load intensity
                ============================================================ */

                const detectionPressure =
                  totalDetections === 0
                    ? 0
                    : (high * 2 + medium * 1.2 + low * 0.6) /
                    totalDetections

                const detectionPressureIndex = weightedRiskPercent

                /* ============================================================
                   SPRAY PRECISION INDEX
                ============================================================ */

                const requiredSprays =
                  high * 1 + medium * 0.7

                const sprayPrecision =
                  totalSprays === 0
                    ? 1
                    : requiredSprays / totalSprays

                const sprayPrecisionIndex =
                  Math.max(0, Math.min(100, sprayPrecision * 100))

                /* ============================================================
                   OVERSPray INDEX
                ============================================================ */

                const overSpray =
                  requiredSprays === 0
                    ? 0
                    : Math.max(
                      0,
                      ((totalSprays - requiredSprays) /
                        requiredSprays) *
                      100
                    )

                const overSprayIndex =
                  Math.max(0, 100 - overSpray)

                /* ============================================================
                   DELAY RESPONSIVENESS MODEL (Frontend Paired)
                ============================================================ */

                let totalDelayHours = 0
                let validPairs = 0

                detections.forEach((d: any) => {
                  const detectionTime = new Date(d.timestamp).getTime()

                  const futureSprays = sprays
                    .filter(
                      (s: any) =>
                        s.zoneId === d.zoneId &&
                        new Date(s.timestamp).getTime() >=
                        detectionTime
                    )
                    .sort(
                      (a: any, b: any) =>
                        new Date(a.timestamp).getTime() -
                        new Date(b.timestamp).getTime()
                    )

                  if (futureSprays.length === 0) return

                  const firstSprayTime =
                    new Date(
                      futureSprays[0].timestamp
                    ).getTime()

                  const delayHours =
                    (firstSprayTime - detectionTime) /
                    (1000 * 60 * 60)

                  if (delayHours >= 0) {
                    totalDelayHours += delayHours
                    validPairs++
                  }
                })

                const avgDelay =
                  validPairs === 0
                    ? 0
                    : totalDelayHours / validPairs

                const lambda = 0.08

                const responsivenessIndex =
                  100 * Math.exp(-lambda * avgDelay)

                /* ============================================================
                   ECOSYSTEM BALANCE INDEX
                ============================================================ */

                const ecosystemBalance =
                  100 -
                  weightedRiskPercent * 0.5 -
                  overSpray * 0.3 +
                  responsivenessIndex * 0.2

                const ecosystemBalanceIndex =
                  Math.max(0, Math.min(100, ecosystemBalance))

                /* ============================================================
                   STABILITY COMPOSITE INDEX
                ============================================================ */

                const stabilityIndex =
                  92 -
                  weightedRiskPercent * 0.15 -
                  (100 - sprayPrecisionIndex) * 0.1 +
                  responsivenessIndex * 0.1

                const finalStability =
                  Math.max(0, Math.min(100, stabilityIndex))

                /* ============================================================
                   RETURN UI
                ============================================================ */

                return (
                  <Card className="border-green-200 shadow-lg">
                    <CardHeader>
                      <CardTitle className="text-2xl text-green-700">
                        Farm Stability Command Center
                      </CardTitle>
                      <CardDescription>
                        Frontend-computed multi-factor ecosystem resilience engine
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-8">

                      {/* ===== STABILITY SCORE ===== */}

                      <div className="text-center space-y-4">
                        <div className="text-5xl font-bold text-green-700">
                          {finalStability.toFixed(1)}%
                        </div>
                        <div className="text-muted-foreground">
                          Stability Composite Index
                        </div>
                        <Progress value={finalStability} />
                      </div>

                      {/* ===== METRICS GRID ===== */}

                      <div className="grid md:grid-cols-3 gap-4">

                        <Card className="bg-green-50">
                          <CardHeader>
                            <CardTitle>Weighted Risk</CardTitle>
                          </CardHeader>
                          <CardContent className="text-xl font-bold text-green-700">
                            {weightedRiskPercent.toFixed(1)}%
                          </CardContent>
                        </Card>

                        <Card className="bg-green-50">
                          <CardHeader>
                            <CardTitle>Responsiveness</CardTitle>
                          </CardHeader>
                          <CardContent className="text-xl font-bold text-green-700">
                            {responsivenessIndex.toFixed(1)}%
                          </CardContent>
                        </Card>

                        <Card className="bg-green-50">
                          <CardHeader>
                            <CardTitle>Ecosystem Balance</CardTitle>
                          </CardHeader>
                          <CardContent className="text-xl font-bold text-green-700">
                            {ecosystemBalanceIndex.toFixed(1)}%
                          </CardContent>
                        </Card>

                      </div>

                    </CardContent>
                  </Card>
                )
              })()}
              {/* ================= SECTION 1B – ADVANCED STABILITY MODELING ================= */}

              {(() => {

                const detections = historyData?.detections || []
                const sprays = historyData?.sprays || []

                let high = 0
                let medium = 0
                let low = 0

                detections.forEach((d: any) => {
                  if (d.severityLevel === "high") high++
                  else if (normalizeSeverityLevel(d.severityLevel) === "moderate") medium++
                  else if (d.severityLevel === "low") low++
                })

                const total = high + medium + low || 1

                /* ============================================================
                   SEVERITY DISTRIBUTION MODEL
                ============================================================ */

                const severityData = [
                  { name: "High", value: high },
                  { name: "Moderate", value: medium },
                  { name: "Low", value: low },
                ]

                /* ============================================================
                   PRESSURE TREND MODEL (Grouped by Date)
                ============================================================ */

                const dateMap: Record<string, number> = {}

                detections.forEach((d: any) => {
                  if (!d.timestamp) return

                  const date = new Date(d.timestamp)
                    .toISOString()
                    .split("T")[0]

                  if (!dateMap[date]) dateMap[date] = 0

                  if (d.severityLevel === "high") dateMap[date] += 3
                  else if (normalizeSeverityLevel(d.severityLevel) === "moderate") dateMap[date] += 2
                  else if (d.severityLevel === "low") dateMap[date] += 1
                })

                const pressureTrend = Object.keys(dateMap)
                  .sort()
                  .map((date) => ({
                    date,
                    pressure: dateMap[date],
                  }))

                /* ============================================================
                   SPRAY ACTIVITY TREND
                ============================================================ */

                const sprayDateMap: Record<string, number> = {}

                sprays.forEach((s: any) => {
                  if (!s.timestamp) return

                  const date = new Date(s.timestamp)
                    .toISOString()
                    .split("T")[0]

                  sprayDateMap[date] =
                    (sprayDateMap[date] || 0) + 1
                })

                const sprayTrend = Object.keys(sprayDateMap)
                  .sort()
                  .map((date) => ({
                    date,
                    sprays: sprayDateMap[date],
                  }))

                /* ============================================================
                   DELAY RESPONSIVENESS MODEL (Frontend Paired)
                ============================================================ */

                let totalDelayHours = 0
                let validPairs = 0

                detections.forEach((d: any) => {
                  const detectionTime = new Date(d.timestamp).getTime()

                  const futureSprays = sprays
                    .filter(
                      (s: any) =>
                        s.zoneId === d.zoneId &&
                        new Date(s.timestamp).getTime() >=
                        detectionTime
                    )
                    .sort(
                      (a: any, b: any) =>
                        new Date(a.timestamp).getTime() -
                        new Date(b.timestamp).getTime()
                    )

                  if (futureSprays.length === 0) return

                  const firstSprayTime =
                    new Date(
                      futureSprays[0].timestamp
                    ).getTime()

                  const delayHours =
                    (firstSprayTime - detectionTime) /
                    (1000 * 60 * 60)

                  if (delayHours >= 0) {
                    totalDelayHours += delayHours
                    validPairs++
                  }
                })

                const avgDelay =
                  validPairs === 0
                    ? 0
                    : totalDelayHours / validPairs

                const lambda = 0.08

                const responsivenessIndex =
                  100 * Math.exp(-lambda * avgDelay)

                /* ============================================================
                   INTERVENTION INTENSITY SCORE
                ============================================================ */

                const interventionIntensity =
                  total === 0
                    ? 0
                    : (sprays.length / total) * 100

                const interventionIndex =
                  Math.min(100, interventionIntensity)

                /* ============================================================
                   RISK CONTAINMENT MODEL
                ============================================================ */

                const containmentRatio =
                  100 - (high / total) * 60 + (responsivenessIndex * 0.1)

                const containmentIndex =
                  Math.max(0, Math.min(100, containmentRatio))

                /* ============================================================
                   RETURN UI
                ============================================================ */

                return (
                  <Card className="border-green-200 shadow-lg">
                    <CardHeader>
                      <CardTitle className="text-xl text-green-700">
                        Stability Intelligence Modeling
                      </CardTitle>
                      <CardDescription>
                        Severity distribution, pressure evolution, and intervention dynamics
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-8">

                      {/* ===== SEVERITY BAR CHART ===== */}

                      <div>
                        <div className="font-semibold mb-2">
                          Severity Distribution
                        </div>

                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={severityData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="value" fill="#16a34a" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      {/* ===== PRESSURE TREND ===== */}

                      {pressureTrend.length > 0 && (
                        <div>
                          <div className="font-semibold mb-2">
                            Disease Pressure Trend
                          </div>

                          <ResponsiveContainer width="100%" height={300}>
                            <AreaChart data={pressureTrend}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="date" />
                              <YAxis />
                              <Tooltip />
                              <Area
                                type="monotone"
                                dataKey="pressure"
                                stroke="#16a34a"
                                fill="#bbf7d0"
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      )}

                      {/* ===== SPRAY TREND ===== */}

                      {sprayTrend.length > 0 && (
                        <div>
                          <div className="font-semibold mb-2">
                            Spray Activity Trend
                          </div>

                          <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={sprayTrend}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="date" />
                              <YAxis />
                              <Tooltip />
                              <Line
                                type="monotone"
                                dataKey="sprays"
                                stroke="#15803d"
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      )}

                      {/* ===== INTELLIGENCE METRICS ===== */}

                      <div className="grid md:grid-cols-3 gap-4">

                        <Card className="bg-green-50">
                          <CardHeader>
                            <CardTitle>Containment</CardTitle>
                          </CardHeader>
                          <CardContent className="text-xl font-bold text-green-700">
                            {containmentIndex.toFixed(1)}%
                          </CardContent>
                        </Card>

                        <Card className="bg-green-50">
                          <CardHeader>
                            <CardTitle>Intervention Intensity</CardTitle>
                          </CardHeader>
                          <CardContent className="text-xl font-bold text-green-700">
                            {interventionIndex.toFixed(1)}%
                          </CardContent>
                        </Card>

                        <Card className="bg-green-50">
                          <CardHeader>
                            <CardTitle>Total Events</CardTitle>
                          </CardHeader>
                          <CardContent className="text-xl font-bold text-green-700">
                            {total}
                          </CardContent>
                        </Card>

                      </div>

                      <CalculationDetails
                        title="Stability Core"
                        formulas={[
                          { label: "Stability Index", math: "SI = 92 - W_r*0.15 - (100-P_s)*0.1 + R*0.1", desc: "Composite of weighted risk, spray precision (P_s), and response speed (R), clamped to 0-100." },
                          { label: "Risk Weighting", math: "W_r = (H*6 + M*3 + L*1) / (T*6)", desc: "Normalizes biological threats by severity (High=6, Moderate=3, Low=1) over the worst case." },
                          { label: "Pressure Index", math: "PI = (H*2 + M*1.2 + L*0.6) / T", desc: "Determines the density of pathological pressure on the farm ecosystem." }
                        ]}
                      />

                    </CardContent>
                  </Card>
                )
              })()}
            </div>
          </TabsContent>

          {/* TAB 2 */}
          <TabsContent value="zones">
            <div className="space-y-6">
              {/* ================= SECTION 2A – ZONE RISK & SPRAY MODELING ================= */}

              {(() => {

                const detections = historyData?.detections || []
                const sprays = historyData?.sprays || []

                /* ============================================================
                   GROUP BY ZONE
                ============================================================ */

                const zoneMap: Record<string, any> = {}

                detections.forEach((d: any) => {
                  if (!zoneMap[d.zoneId]) {
                    zoneMap[d.zoneId] = {
                      detections: [],
                      sprays: []
                    }
                  }
                  zoneMap[d.zoneId].detections.push(d)
                })

                sprays.forEach((s: any) => {
                  if (!zoneMap[s.zoneId]) {
                    zoneMap[s.zoneId] = {
                      detections: [],
                      sprays: []
                    }
                  }
                  zoneMap[s.zoneId].sprays.push(s)
                })

                /* ============================================================
                   ZONE INTELLIGENCE CALCULATION
                ============================================================ */

                const zoneAnalytics = Object.keys(zoneMap).map((zoneId) => {

                  const zoneDetections = zoneMap[zoneId].detections
                  const zoneSprays = zoneMap[zoneId].sprays

                  let high = 0
                  let medium = 0
                  let low = 0

                  zoneDetections.forEach((d: any) => {
                    if (d.severityLevel === "high") high++
                    else if (normalizeSeverityLevel(d.severityLevel) === "moderate") medium++
                    else if (d.severityLevel === "low") low++
                  })

                  const total = high + medium + low || 1

                  /* ----- Risk Model ----- */

                  const weightedRisk =
                    (high * 6 + medium * 3 + low * 1) /
                    (total * 6)

                  const weightedRiskPercent = weightedRisk * 100

                  /* ----- Required Spray Model ----- */

                  const requiredSprays =
                    high * 1 + medium * 0.7

                  const actualSprays =
                    zoneSprays.length

                  /* ----- Over Spray Model ----- */

                  const overSpray =
                    requiredSprays === 0
                      ? 0
                      : Math.max(
                        0,
                        ((actualSprays - requiredSprays) /
                          requiredSprays) *
                        100
                      )

                  /* ----- Zone Spray Precision ----- */

                  const sprayPrecision =
                    actualSprays === 0
                      ? 0
                      : requiredSprays / actualSprays

                  const sprayPrecisionIndex =
                    Math.max(0, Math.min(100, sprayPrecision * 100))

                  /* ----- Zone Risk Index ----- */

                  const zoneRiskIndex =
                    Math.max(
                      0,
                      100 - weightedRiskPercent
                    )

                  /* ----- Zone Stability ----- */

                  const zoneStability =
                    100 -
                    weightedRiskPercent * 0.5 -
                    overSpray * 0.3 +
                    sprayPrecisionIndex * 0.2

                  const finalZoneStability =
                    Math.max(0, Math.min(100, zoneStability))

                  return {
                    zoneId,
                    high,
                    medium,
                    low,
                    total,
                    weightedRiskPercent,
                    requiredSprays,
                    actualSprays,
                    overSpray,
                    sprayPrecisionIndex,
                    zoneRiskIndex,
                    finalZoneStability
                  }

                })

                /* ============================================================
                   SORT BY RISK (Highest First)
                ============================================================ */

                zoneAnalytics.sort(
                  (a, b) =>
                    b.weightedRiskPercent -
                    a.weightedRiskPercent
                )

                /* ============================================================
                   GLOBAL ZONE STABILITY
                ============================================================ */

                const globalZoneStability =
                  zoneAnalytics.length === 0
                    ? 100
                    : zoneAnalytics.reduce(
                      (sum, z) =>
                        sum + z.finalZoneStability,
                      0
                    ) / zoneAnalytics.length

                /* ============================================================
                   RETURN UI
                ============================================================ */

                return (
                  <Card className="border-green-200 shadow-lg">
                    <CardHeader>
                      <CardTitle className="text-2xl text-green-700">
                        Zone Risk & Spray Intelligence
                      </CardTitle>
                      <CardDescription>
                        Frontend-computed zone-level disease pressure and intervention modeling
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-8">

                      {/* GLOBAL ZONE STABILITY */}

                      <div className="text-center space-y-2">
                        <div className="text-4xl font-bold text-green-700">
                          {globalZoneStability.toFixed(1)}%
                        </div>
                        <div className="text-muted-foreground">
                          Global Zone Stability
                        </div>
                        <Progress value={globalZoneStability} />
                      </div>

                      {/* ZONE TABLE */}

                      <div className="space-y-4">

                        {zoneAnalytics.map((zone) => (
                          <Card key={zone.zoneId} className="bg-green-50">
                            <CardContent className="p-4 grid md:grid-cols-6 gap-4 text-sm">

                              <div>
                                <div className="font-semibold">
                                  Zone
                                </div>
                                <div>{zone.zoneId}</div>
                              </div>

                              <div>
                                <div className="font-semibold">
                                  Risk %
                                </div>
                                <div>
                                  {zone.weightedRiskPercent.toFixed(1)}%
                                </div>
                              </div>

                              <div>
                                <div className="font-semibold">
                                  Required
                                </div>
                                <div>
                                  {zone.requiredSprays.toFixed(1)}
                                </div>
                              </div>

                              <div>
                                <div className="font-semibold">
                                  Actual
                                </div>
                                <div>
                                  {zone.actualSprays}
                                </div>
                              </div>

                              <div>
                                <div className="font-semibold">
                                  Precision
                                </div>
                                <div>
                                  {zone.sprayPrecisionIndex.toFixed(1)}%
                                </div>
                              </div>

                              <div>
                                <div className="font-semibold">
                                  Stability
                                </div>
                                <div>
                                  {zone.finalZoneStability.toFixed(1)}%
                                </div>
                              </div>

                            </CardContent>
                          </Card>
                        ))}

                      </div>

                    </CardContent>
                  </Card>
                )

              })()}
              {/* ================= SECTION 2B – ZONE DELAY & EFFICIENCY ENGINE ================= */}

              {(() => {

                const detections = historyData?.detections || []
                const sprays = historyData?.sprays || []

                /* ============================================================
                   GROUP BY ZONE (AGAIN – CLEAN LOCAL SCOPE)
                ============================================================ */

                const zoneMap: Record<string, any> = {}

                detections.forEach((d: any) => {
                  if (!zoneMap[d.zoneId]) {
                    zoneMap[d.zoneId] = {
                      detections: [],
                      sprays: []
                    }
                  }
                  zoneMap[d.zoneId].detections.push(d)
                })

                sprays.forEach((s: any) => {
                  if (!zoneMap[s.zoneId]) {
                    zoneMap[s.zoneId] = {
                      detections: [],
                      sprays: []
                    }
                  }
                  zoneMap[s.zoneId].sprays.push(s)
                })

                /* ============================================================
                   DELAY + LOG EFFICIENCY MODEL PER ZONE
                ============================================================ */

                const zoneDelayAnalytics = Object.keys(zoneMap).map((zoneId) => {

                  const zoneDetections = zoneMap[zoneId].detections
                  const zoneSprays = zoneMap[zoneId].sprays

                  let totalDelayHours = 0
                  let validPairs = 0

                  zoneDetections.forEach((d: any) => {
                    if (!d.timestamp) return

                    const detectionTime = new Date(d.timestamp).getTime()

                    const futureSprays = zoneSprays
                      .filter(
                        (s: any) =>
                          new Date(s.timestamp).getTime() >= detectionTime
                      )
                      .sort(
                        (a: any, b: any) =>
                          new Date(a.timestamp).getTime() -
                          new Date(b.timestamp).getTime()
                      )

                    if (futureSprays.length === 0) return

                    const firstSprayTime =
                      new Date(futureSprays[0].timestamp).getTime()

                    const delayHours =
                      (firstSprayTime - detectionTime) /
                      (1000 * 60 * 60)

                    if (delayHours >= 0) {
                      totalDelayHours += delayHours
                      validPairs++
                    }
                  })

                  const avgDelay =
                    validPairs === 0
                      ? 0
                      : totalDelayHours / validPairs

                  /* ----- Responsiveness Index ----- */

                  const responsivenessIndex =
                    Math.max(0, 100 - avgDelay * 2.5)

                  /* ----- Logarithmic Spray Efficiency ----- */

                  const actualSprays =
                    zoneSprays.length

                  const logEfficiency =
                    100 - Math.log(1 + actualSprays) * 8

                  const efficiencyIndex =
                    Math.max(0, Math.min(100, logEfficiency))

                  /* ----- Combined Zone Efficiency Score ----- */

                  const zoneEfficiency =
                    responsivenessIndex * 0.6 +
                    efficiencyIndex * 0.4

                  return {
                    zoneId,
                    avgDelay,
                    responsivenessIndex,
                    actualSprays,
                    efficiencyIndex,
                    zoneEfficiency
                  }

                })

                /* ============================================================
                   SORT BY LOWEST EFFICIENCY (Weak Zones First)
                ============================================================ */

                zoneDelayAnalytics.sort(
                  (a, b) =>
                    a.zoneEfficiency -
                    b.zoneEfficiency
                )

                /* ============================================================
                   PREPARE CHART DATA
                ============================================================ */

                const efficiencyChartData =
                  zoneDelayAnalytics.map((z) => ({
                    zone: z.zoneId,
                    efficiency: Number(
                      z.zoneEfficiency.toFixed(1)
                    )
                  }))

                /* ============================================================
                   RETURN UI
                ============================================================ */

                return (
                  <Card className="border-green-200 shadow-lg">
                    <CardHeader>
                      <CardTitle className="text-xl text-green-700">
                        Zone Delay & Efficiency Modeling
                      </CardTitle>
                      <CardDescription>
                        Response delay pairing and logarithmic spray efficiency scoring
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-8">

                      {/* EFFICIENCY CHART */}

                      {efficiencyChartData.length > 0 && (
                        <div>
                          <div className="font-semibold mb-2">
                            Zone Efficiency Ranking
                          </div>

                          <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={efficiencyChartData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="zone" />
                              <YAxis />
                              <Tooltip />
                              <Bar
                                dataKey="efficiency"
                                fill="#15803d"
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}

                      {/* ZONE DETAILS */}

                      <div className="space-y-4">

                        {zoneDelayAnalytics.map((zone) => (
                          <Card key={zone.zoneId} className="bg-green-50">
                            <CardContent className="p-4 grid md:grid-cols-5 gap-4 text-sm">

                              <div>
                                <div className="font-semibold">
                                  Zone
                                </div>
                                <div>{zone.zoneId}</div>
                              </div>

                              <div>
                                <div className="font-semibold">
                                  Avg Delay (hrs)
                                </div>
                                <div>
                                  {zone.avgDelay.toFixed(1)}
                                </div>
                              </div>

                              <div>
                                <div className="font-semibold">
                                  Responsiveness
                                </div>
                                <div>
                                  {zone.responsivenessIndex.toFixed(1)}%
                                </div>
                              </div>

                              <div>
                                <div className="font-semibold">
                                  Spray Count
                                </div>
                                <div>
                                  {zone.actualSprays}
                                </div>
                              </div>

                              <div>
                                <div className="font-semibold">
                                  Efficiency Score
                                </div>
                                <div>
                                  {zone.zoneEfficiency.toFixed(1)}%
                                </div>
                              </div>

                            </CardContent>
                          </Card>
                        ))}

                      </div>

                      <CalculationDetails 
                        title="Spatial Intelligence"
                        formulas={[
                          { label: "Zone Efficiency", math: "ZE = 100 - (O_s * 8) - (D_p * 4)", desc: "Row-level efficiency penalizing over-spray (O) and delayed response (D)." },
                          { label: "Response Delay", math: "D_p = (T_{spray} - T_{detect}) / 3600", desc: "Calculates the latency in hours between detection and hardware actuator trigger." },
                          { label: "Overspray Factor", math: "O_s = Max(0, A_c - R_c)", desc: "Measures excess chemical application beyond the AI-calculated requirement." }
                        ]}
                      />

                    </CardContent>
                  </Card>
                )

              })()}
            </div>
          </TabsContent>

          {/* TAB 3*/}
          <TabsContent value="spraying">
            <div className="space-y-6">
              {/* ================= SECTION 3A – PRECISION & OVERSPRAY MODELING ================= */}

              {(() => {

                const detections = historyData?.detections || []
                const sprays = historyData?.sprays || []

                let high = 0
                let medium = 0
                let low = 0

                detections.forEach((d: any) => {
                  if (d.severityLevel === "high") high++
                  else if (normalizeSeverityLevel(d.severityLevel) === "moderate") medium++
                  else if (d.severityLevel === "low") low++
                })

                const totalDetections = high + medium + low
                const totalSprays = sprays.length

                /* ============================================================
                   REQUIRED SPRAY MODEL (FRONTEND)
                ============================================================ */

                const requiredSprays =
                  high * 1 + medium * 0.7

                /* ============================================================
                   PRECISION INDEX
                ============================================================ */

                const deviation =
                  requiredSprays === 0
                    ? 0
                    : Math.abs(totalSprays - requiredSprays) /
                    requiredSprays

                const precisionIndex =
                  Math.max(0, Math.min(100, 100 - (deviation * 100)))

                /* ============================================================
                   OVERSPRAY PERCENTAGE
                ============================================================ */

                const overSprayPercent =
                  requiredSprays === 0
                    ? 0
                    : Math.max(
                      0,
                      ((totalSprays - requiredSprays) /
                        requiredSprays) *
                      100
                    )

                const oversprayIndex =
                  Math.max(0, Math.min(100, 100 - overSprayPercent))

                /* ============================================================
                   UNDER-SPRAY MODEL
                ============================================================ */

                const underSprayPercent =
                  totalSprays === 0
                    ? requiredSprays > 0 ? 100 : 0
                    : requiredSprays > totalSprays
                      ? ((requiredSprays - totalSprays) /
                        requiredSprays) * 100
                      : 0

                const underSprayIndex =
                  Math.max(0, Math.min(100, 100 - underSprayPercent))

                /* ============================================================
                   INTERVENTION EFFECTIVENESS SCORE
                ============================================================ */

                const interventionScore =
                  precisionIndex * 0.4 +
                  oversprayIndex * 0.3 +
                  underSprayIndex * 0.3

                const finalInterventionScore =
                  Math.max(0, Math.min(100, interventionScore))

                /* ============================================================
                   DISTRIBUTION DATA FOR CHART
                ============================================================ */

                const sprayComparisonData = [
                  {
                    name: "Sprays",
                    Required: Number(requiredSprays.toFixed(1)),
                    Actual: totalSprays,
                  }
                ]

                /* ============================================================
                   RETURN UI
                ============================================================ */

                return (
                  <Card className="border-green-200 shadow-lg">
                    <CardHeader>
                      <CardTitle className="text-2xl text-green-700">
                        Precision & Overspray Intelligence
                      </CardTitle>
                      <CardDescription>
                        Frontend-computed intervention accuracy and spray deviation modeling
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-8">

                      {/* ===== INTERVENTION SCORE ===== */}

                      <div className="text-center space-y-3">
                        <div className="text-4xl font-bold text-green-700">
                          {finalInterventionScore.toFixed(1)}%
                        </div>
                        <div className="text-muted-foreground">
                          Intervention Effectiveness Score
                        </div>
                        <Progress value={finalInterventionScore} />
                      </div>

                      {/* ===== METRICS GRID ===== */}

                      <div className="grid md:grid-cols-3 gap-4">

                        <Card className="bg-green-50">
                          <CardHeader>
                            <CardTitle>Precision</CardTitle>
                          </CardHeader>
                          <CardContent className="text-xl font-bold text-green-700">
                            {precisionIndex.toFixed(1)}%
                          </CardContent>
                        </Card>

                        <Card className="bg-green-50">
                          <CardHeader>
                            <CardTitle>Overspray</CardTitle>
                          </CardHeader>
                          <CardContent className="text-xl font-bold text-green-700">
                            {overSprayPercent.toFixed(1)}%
                          </CardContent>
                        </Card>

                        <Card className="bg-green-50">
                          <CardHeader>
                            <CardTitle>Under-Spray</CardTitle>
                          </CardHeader>
                          <CardContent className="text-xl font-bold text-green-700">
                            {underSprayPercent.toFixed(1)}%
                          </CardContent>
                        </Card>

                      </div>

                      {/* ===== REQUIRED VS ACTUAL CHART ===== */}

                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={sprayComparisonData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="Required" fill="#84cc16" />
                          <Bar dataKey="Actual" fill="#16a34a" />
                        </BarChart>
                      </ResponsiveContainer>

                    </CardContent>
                  </Card>
                )

              })()}
              {/* ================= SECTION 3B – LOG EFFICIENCY & RESOURCE MODELING ================= */}

              {(() => {

                const detections = historyData?.detections || []
                const sprays = historyData?.sprays || []

                let high = 0
                let medium = 0
                let low = 0

                detections.forEach((d: any) => {
                  if (d.severityLevel === "high") high++
                  else if (normalizeSeverityLevel(d.severityLevel) === "moderate") medium++
                  else if (d.severityLevel === "low") low++
                })

                const totalDetections = high + medium + low
                const totalSprays = sprays.length

                /* ============================================================
                   WATER MODEL (FRONTEND RECOMPUTED)
                ============================================================ */

                const waterPerSpray = 15

                const manualWaterUsage =
                  totalDetections * waterPerSpray

                const aiWaterUsage =
                  totalSprays * waterPerSpray

                const waterSaved =
                  manualWaterUsage - aiWaterUsage

                const waterOveruse =
                  Math.max(0, aiWaterUsage - manualWaterUsage)

                const waterReductionPercent =
                  manualWaterUsage === 0
                    ? 0
                    : (waterSaved / manualWaterUsage) * 100

                const waterEfficiencyIndex =
                  Math.max(0, Math.min(100, waterReductionPercent))

                /* ============================================================
                   LOGARITHMIC SPRAY LOAD PENALTY
                ============================================================ */

                const logPenalty =
                  100 - Math.log(1 + totalSprays) * 25

                const logEfficiencyIndex =
                  Math.max(0, Math.min(100, logPenalty))

                /* ============================================================
                   SPRAY LOAD INDEX
                ============================================================ */

                const sprayLoadIndex =
                  totalDetections === 0
                    ? 0
                    : (totalSprays / totalDetections) * 100

                /* ============================================================
                   RESOURCE OPTIMIZATION SCORE
                ============================================================ */

                const resourceScore =
                  waterEfficiencyIndex * 0.4 +
                  logEfficiencyIndex * 0.4 +
                  (100 - sprayLoadIndex) * 0.2

                const finalResourceScore =
                  Math.max(0, Math.min(100, resourceScore))

                /* ============================================================
                   EFFICIENCY CURVE DATA
                ============================================================ */

                const efficiencyCurve = Array.from({ length: 15 }, (_, i) => {
                  const spraysSimulated = i
                  return {
                    sprays: spraysSimulated,
                    efficiency:
                      100 - Math.log(1 + spraysSimulated) * 25
                  }
                })

                /* ============================================================
                   RETURN UI
                ============================================================ */

                return (
                  <Card className="border-green-200 shadow-lg">
                    <CardHeader>
                      <CardTitle className="text-xl text-green-700">
                        Resource Optimization & Log Efficiency
                      </CardTitle>
                      <CardDescription>
                        Water savings modeling and logarithmic spray penalty intelligence
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-8">

                      {/* RESOURCE SCORE */}

                      <div className="text-center space-y-3">
                        <div className="text-4xl font-bold text-green-700">
                          {finalResourceScore.toFixed(1)}%
                        </div>
                        <div className="text-muted-foreground">
                          Resource Optimization Score
                        </div>
                        <Progress value={finalResourceScore} />
                      </div>

                      {/* METRICS GRID */}

                      <div className="grid md:grid-cols-3 gap-4">

                        <Card className="bg-green-50">
                          <CardHeader>
                            <CardTitle>Water Delta</CardTitle>
                          </CardHeader>
                          <CardContent className={`text-xl font-bold ${waterOveruse > 0 ? "text-red-600" : "text-green-700"}`}>
                            {waterSaved.toFixed(1)} L
                          </CardContent>
                        </Card>

                        <Card className="bg-green-50">
                          <CardHeader>
                            <CardTitle>Water Reduction</CardTitle>
                          </CardHeader>
                          <CardContent className={`text-xl font-bold ${waterReductionPercent < 0 ? "text-red-600" : "text-green-700"}`}>
                            {waterReductionPercent.toFixed(1)}%
                          </CardContent>
                        </Card>

                        <Card className="bg-green-50">
                          <CardHeader>
                            <CardTitle>Log Efficiency</CardTitle>
                          </CardHeader>
                          <CardContent className="text-xl font-bold text-green-700">
                            {logEfficiencyIndex.toFixed(1)}%
                          </CardContent>
                        </Card>

                      </div>

                      {/* LOG CURVE CHART */}

                      <div>
                        <div className="font-semibold mb-2">
                          Logarithmic Efficiency Curve
                        </div>

                        <ResponsiveContainer width="100%" height={300}>
                          <LineChart data={efficiencyCurve}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="sprays" />
                            <YAxis />
                            <Tooltip />
                            <Line
                              type="monotone"
                              dataKey="efficiency"
                              stroke="#15803d"
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>

                      <CalculationDetails 
                        title="Delivery Precision"
                        formulas={[
                          { label: "Precision Index", math: "Pi = (Σ D_{target} / Σ D_{actual}) * 100", desc: "Compares AI-calculated targeted dosage against actual sprayer discharge." },
                          { label: "Dosage Model", math: "D = H*1.0 + M*0.7", desc: "Assigns chemical dosage units based on the severity of the pathogen detection." },
                          { label: "Waste Reduction", math: "W_r = 1 - (Pi / 100)", desc: "Tracks the percentage of chemical runoff prevented by nozzle-level precision." }
                        ]}
                      />

                    </CardContent>
                  </Card>
                )

              })()}
            </div>
          </TabsContent>

          {/* TAB 4 */}
          <TabsContent value="disease">
            <div className="space-y-6">
              {/* ================= SECTION 4A – EPIDEMIOLOGY ENGINE ================= */}

              {(() => {

                const detections = historyData?.detections || []

                /* ============================================================
                   DISEASE FREQUENCY MAP
                ============================================================ */

                const diseaseMap: Record<string, any> = {}

                detections.forEach((d: any) => {
                  const name =
                    d.diseaseName || d.disease || "Unknown"

                  if (!diseaseMap[name]) {
                    diseaseMap[name] = {
                      count: 0,
                      high: 0,
                      medium: 0,
                      low: 0
                    }
                  }

                  diseaseMap[name].count++

                  if (d.severityLevel === "high")
                    diseaseMap[name].high++
                  else if (normalizeSeverityLevel(d.severityLevel) === "moderate")
                    diseaseMap[name].medium++
                  else if (d.severityLevel === "low")
                    diseaseMap[name].low++
                })

                const totalDetections = detections.length || 1

                /* ============================================================
                   DISEASE INTELLIGENCE MODEL
                ============================================================ */
                const x = (raw: string) => {
                  if (!raw) return "Unknown"

                  const parts = raw.split("___")
                  if (parts.length !== 2) return raw

                  let plant = parts[0]
                  let disease = parts[1]

                  // Clean formatting
                  plant = plant.replaceAll("_", " ")
                  disease = disease.replaceAll("_", " ")

                  // Remove brackets from plant name
                  plant = plant.replace(/\(.*?\)/g, "").trim()

                  if (disease.toLowerCase() === "healthy") {
                    return `Healthy - ${plant}`
                  }

                  return `${disease} - ${plant}`
                }

                const diseaseAnalytics = Object.keys(diseaseMap).map((name) => {

                  const data = diseaseMap[name]

                  const weightedImpact =
                    (data.high * 3 +
                      data.medium * 2 +
                      data.low * 1) /
                    (data.count * 3)

                  const dominanceIndex =
                    (data.count / totalDetections) * 100

                  const severityIntensity =
                    weightedImpact * 100

                  const compositeRisk =
                    dominanceIndex * 0.6 +
                    severityIntensity * 0.4

                  return {
                    name: x(name),
                    count: data.count,
                    high: data.high,
                    medium: data.medium,
                    low: data.low,
                    dominanceIndex,
                    severityIntensity,
                    compositeRisk
                  }

                })

                /* ============================================================
                   SORT BY COMPOSITE RISK
                ============================================================ */

                diseaseAnalytics.sort(
                  (a, b) =>
                    b.compositeRisk -
                    a.compositeRisk
                )

                /* ============================================================
                   CHART DATA
                ============================================================ */

                const diseaseChartData =
                  diseaseAnalytics.map((d) => ({
                    name: d.name,
                    risk: Number(d.compositeRisk.toFixed(1))
                  }))

                /* ============================================================
                   MOST DOMINANT DISEASE
                ============================================================ */

                const dominantDisease =
                  diseaseAnalytics.length > 0
                    ? diseaseAnalytics[0].name
                    : "No Data"

                /* ============================================================
                   GLOBAL DISEASE PRESSURE INDEX
                ============================================================ */

                const globalDiseasePressure =
                  diseaseAnalytics.length === 0
                    ? 0
                    : diseaseAnalytics.reduce(
                      (sum, d) =>
                        sum + d.compositeRisk,
                      0
                    ) / diseaseAnalytics.length

                /* ============================================================
                   RETURN UI
                ============================================================ */

                return (
                  <Card className="border-green-200 shadow-lg">
                    <CardHeader>
                      <CardTitle className="text-2xl text-green-700">
                        Epidemiology Intelligence Engine
                      </CardTitle>
                      <CardDescription>
                        Disease dominance, severity weighting and composite risk modeling
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-8">

                      {/* GLOBAL PRESSURE */}

                      <div className="text-center space-y-2">
                        <div className="text-4xl font-bold text-green-700">
                          {globalDiseasePressure.toFixed(1)}%
                        </div>
                        <div className="text-muted-foreground">
                          Global Disease Pressure
                        </div>
                        <Progress value={globalDiseasePressure} />
                      </div>

                      {/* DOMINANT DISEASE */}

                      <Card className="bg-green-50">
                        <CardHeader>
                          <CardTitle>
                            Dominant Disease
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="text-xl font-bold text-green-700">
                          {dominantDisease}
                        </CardContent>
                      </Card>

                      {/* RISK CHART */}

                      {diseaseChartData.length > 0 && (
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={diseaseChartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Bar
                              dataKey="risk"
                              fill="#15803d"
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      )}

                      {/* DISEASE TABLE */}

                      <div className="space-y-3">

                        {diseaseAnalytics.map((disease) => (
                          <Card key={disease.name} className="bg-green-50">
                            <CardContent className="p-4 grid md:grid-cols-5 gap-4 text-sm">

                              <div>
                                <div className="font-semibold">
                                  Disease
                                </div>
                                <div>{disease.name}</div>
                              </div>

                              <div>
                                <div className="font-semibold">
                                  Cases
                                </div>
                                <div>{disease.count}</div>
                              </div>

                              <div>
                                <div className="font-semibold">
                                  Dominance
                                </div>
                                <div>
                                  {disease.dominanceIndex.toFixed(1)}%
                                </div>
                              </div>

                              <div>
                                <div className="font-semibold">
                                  Severity Intensity
                                </div>
                                <div>
                                  {disease.severityIntensity.toFixed(1)}%
                                </div>
                              </div>

                              <div>
                                <div className="font-semibold">
                                  Composite Risk
                                </div>
                                <div>
                                  {disease.compositeRisk.toFixed(1)}%
                                </div>
                              </div>

                            </CardContent>
                          </Card>
                        ))}

                      </div>

                    </CardContent>
                  </Card>
                )

              })()}
              {/* ================= SECTION 4B – SPREAD & OUTBREAK INTELLIGENCE ================= */}

              {(() => {

                const detections = historyData?.detections || []
                const x = (raw: string) => {
                  if (!raw) return "Unknown"

                  const parts = raw.split("___")
                  if (parts.length !== 2) return raw

                  let plant = parts[0]
                  let disease = parts[1]

                  // Clean formatting
                  plant = plant.replaceAll("_", " ")
                  disease = disease.replaceAll("_", " ")

                  // Remove brackets from plant name
                  plant = plant.replace(/\(.*?\)/g, "").trim()

                  if (disease.toLowerCase() === "healthy") {
                    return `Healthy - ${plant}`
                  }

                  return `${disease} - ${plant}`
                }

                if (!detections.length) return null

                /* ============================================================
                   GROUP BY DATE
                ============================================================ */

                const dateMap: Record<string, number> = {}

                detections.forEach((d: any) => {
                  if (!d.timestamp) return

                  const date = new Date(d.timestamp)
                    .toISOString()
                    .split("T")[0]

                  dateMap[date] = (dateMap[date] || 0) + 1
                })

                const sortedDates = Object.keys(dateMap).sort()

                const timeSeries = sortedDates.map((date) => ({
                  date,
                  cases: dateMap[date],
                }))

                /* ============================================================
                   OUTBREAK ACCELERATION MODEL
                ============================================================ */

                let accelerationScore = 0

                let growthRates = []

                for (let i = 1; i < sortedDates.length; i++) {
                  const prev = dateMap[sortedDates[i - 1]]
                  const curr = dateMap[sortedDates[i]]

                  if (prev > 0 && curr > 0) {
                    growthRates.push(Math.log(curr / prev))
                  }
                }

                const avgGrowthRate =
                  growthRates.length === 0
                    ? 0
                    : growthRates.reduce((a, b) => a + b, 0) /
                    growthRates.length

                const outbreakAccelerationIndex =
                  100 * (1 - Math.exp(-avgGrowthRate))

                /* ============================================================
                   SPREAD VELOCITY INDEX
                ============================================================ */

                const totalDays = sortedDates.length || 1
                const totalCases = detections.length

                const avgCasesPerDay =
                  totalCases / totalDays

                const spreadVelocityIndex =
                  Math.min(100, avgCasesPerDay * 10)

                /* ============================================================
                   EARLY WARNING SCORE
                ============================================================ */

                const highCases = detections.filter(
                  (d: any) => d.severityLevel === "high"
                ).length

                const highRatio =
                  totalCases === 0
                    ? 0
                    : highCases / totalCases

                const earlyWarningScore =
                  Math.max(0, Math.min(100, 100 - (highRatio * 25)))

                /* ============================================================
                   GLOBAL OUTBREAK RISK
                ============================================================ */

                const outbreakRiskIndex =
                  outbreakAccelerationIndex * 0.4 +
                  spreadVelocityIndex * 0.3 +
                  earlyWarningScore * 0.3

                /* ============================================================
                   RETURN UI
                ============================================================ */

                return (
                  <Card className="border-green-200 shadow-lg">
                    <CardHeader>
                      <CardTitle className="text-xl text-green-700">
                        Outbreak & Spread Intelligence
                      </CardTitle>
                      <CardDescription>
                        Temporal disease growth, velocity modeling and early warning detection
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-8">

                      {/* OUTBREAK RISK SCORE */}

                      <div className="text-center space-y-3">
                        <div className="text-4xl font-bold text-green-700">
                          {outbreakRiskIndex.toFixed(1)}%
                        </div>
                        <div className="text-muted-foreground">
                          Outbreak Risk Index
                        </div>
                        <Progress value={outbreakRiskIndex} />
                      </div>

                      {/* METRICS GRID */}

                      <div className="grid md:grid-cols-3 gap-4">

                        <Card className="bg-green-50">
                          <CardHeader>
                            <CardTitle>Acceleration</CardTitle>
                          </CardHeader>
                          <CardContent className="text-xl font-bold text-green-700">
                            {outbreakAccelerationIndex.toFixed(1)}%
                          </CardContent>
                        </Card>

                        <Card className="bg-green-50">
                          <CardHeader>
                            <CardTitle>Spread Velocity</CardTitle>
                          </CardHeader>
                          <CardContent className="text-xl font-bold text-green-700">
                            {spreadVelocityIndex.toFixed(1)}%
                          </CardContent>
                        </Card>

                        <Card className="bg-green-50">
                          <CardHeader>
                            <CardTitle>Early Warning</CardTitle>
                          </CardHeader>
                          <CardContent className="text-xl font-bold text-green-700">
                            {earlyWarningScore.toFixed(1)}%
                          </CardContent>
                        </Card>

                      </div>

                      {/* CASE TREND CHART */}

                      <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={timeSeries}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis />
                          <Tooltip />
                          <Area
                            type="monotone"
                            dataKey="cases"
                            stroke="#15803d"
                            fill="#bbf7d0"
                          />
                        </AreaChart>
                      </ResponsiveContainer>

                      <CalculationDetails 
                        title="Epidemio-Analytics"
                        formulas={[
                          { label: "Spread Velocity", math: "Vs = (Δ Inf) / Δt * e^-IE", desc: "Measures the pace of pathogen migration suppressed by Intervention Effectiveness." },
                          { label: "Acceleration", math: "α = 100 * (1 - e^-λ)", desc: "Calculates the exponential growth rate of the disease outbreak in a specific sector." },
                          { label: "Intervention Eff.", math: "IE = Pi * 0.5 + Os * 0.3", desc: "Measures how effectively hardware triggered to contain infection to the node." }
                        ]}
                      />

                    </CardContent>
                  </Card>
                )

              })()}
            </div>
          </TabsContent>

          {/* TAB 5 */}
          <TabsContent value="impact">
            <div className="space-y-6">
              {/* ================= SECTION 5A – AI IMPACT MODELING ================= */}

              {(() => {

                const detections = historyData?.detections || []
                const sprays = historyData?.sprays || []

                let high = 0
                let medium = 0
                let low = 0

                detections.forEach((d: any) => {
                  if (d.severityLevel === "high") high++
                  else if (normalizeSeverityLevel(d.severityLevel) === "moderate") medium++
                  else if (d.severityLevel === "low") low++
                })

                const total = high + medium + low || 1
                const totalSprays = sprays.length

                /* ============================================================
                   MANUAL RISK MODEL (NO AI OPTIMIZATION)
                ============================================================ */

                const manualRisk =
                  (high * 6 + medium * 4 + low * 2) /
                  (total * 6)

                const aiRisk =
                  (high * 6 + medium * 3 + low * 1) /
                  (total * 6)

                const riskReductionPercent =
                  (manualRisk - aiRisk) * 100

                /* ============================================================
                   WATER SAVINGS MODEL
                ============================================================ */

                const waterPerSpray = 15

                const manualWater =
                  total * waterPerSpray

                const aiWater =
                  totalSprays * waterPerSpray

                const waterSaved =
                  manualWater - aiWater

                const waterOveruse =
                  Math.max(0, aiWater - manualWater)

                const waterSavedPercent =
                  manualWater === 0
                    ? 0
                    : (waterSaved / manualWater) * 100

                /* ============================================================
                   YIELD PRESERVATION MODEL
                ============================================================ */

                const manualYieldLoss =
                  manualRisk * 60

                const aiYieldLoss =
                  aiRisk * 40

                const yieldImprovement =
                  manualYieldLoss - aiYieldLoss

                /* ============================================================
                   AI PERFORMANCE MULTIPLIER
                ============================================================ */

                const aiMultiplier =
                  riskReductionPercent * 0.4 +
                  waterSavedPercent * 0.3 +
                  yieldImprovement * 0.3

                const aiImpactScore =
                  Math.max(0, Math.min(100, aiMultiplier))

                /* ============================================================
                   COMPARISON DATA FOR CHART
                ============================================================ */

                const comparisonData = [
                  {
                    name: "Risk %",
                    Manual: +(manualRisk * 100).toFixed(1),
                    AI: +(aiRisk * 100).toFixed(1),
                  },
                  {
                    name: "Water L",
                    Manual: +manualWater.toFixed(1),
                    AI: +aiWater.toFixed(1),
                  },
                  {
                    name: "Yield Loss %",
                    Manual: +manualYieldLoss.toFixed(1),
                    AI: +aiYieldLoss.toFixed(1),
                  },
                ]

                /* ============================================================
                   RETURN UI
                ============================================================ */

                return (
                  <Card className="border-green-200 shadow-lg">
                    <CardHeader>
                      <CardTitle className="text-2xl text-green-700">
                        AI Impact Modeling Engine
                      </CardTitle>
                      <CardDescription>
                        Projected estimate comparing a modeled manual-farming baseline against AI-guided intervention. Figures are model-based projections from severity-weighted assumptions, not measured field trial outcomes.
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-8">

                      {/* AI IMPACT SCORE */}

                      <div className="text-center space-y-3">
                        <div className="text-4xl font-bold text-green-700">
                          {aiImpactScore.toFixed(1)}%
                        </div>
                        <div className="text-muted-foreground">
                          AI Impact Score
                        </div>
                        <Progress value={aiImpactScore} />
                      </div>

                      {/* METRICS GRID */}

                      <div className="grid md:grid-cols-3 gap-4">

                        <Card className="bg-green-50">
                          <CardHeader>
                            <CardTitle>Risk Reduction</CardTitle>
                          </CardHeader>
                          <CardContent className="text-xl font-bold text-green-700">
                            {riskReductionPercent.toFixed(1)}%
                          </CardContent>
                        </Card>

                        <Card className="bg-green-50">
                          <CardHeader>
                            <CardTitle>Water Delta</CardTitle>
                          </CardHeader>
                          <CardContent className={`text-xl font-bold ${waterOveruse > 0 ? "text-red-600" : "text-green-700"}`}>
                            {waterSaved.toFixed(1)} L
                          </CardContent>
                        </Card>

                        <Card className="bg-green-50">
                          <CardHeader>
                            <CardTitle>Yield Improvement</CardTitle>
                          </CardHeader>
                          <CardContent className="text-xl font-bold text-green-700">
                            {yieldImprovement.toFixed(1)}%
                          </CardContent>
                        </Card>

                      </div>

                      {/* COMPARISON CHART */}

                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={comparisonData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="Manual" fill="#ef4444" />
                          <Bar dataKey="AI" fill="#16a34a" />
                        </BarChart>
                      </ResponsiveContainer>

                      <CalculationDetails 
                        title="Executive Performance"
                        formulas={[
                          { label: "Water Saved", math: "WS = (V_{manual} - V_{ai}) / V_{manual}", desc: "Percentage of groundwater preserved vs blanket-application traditional farming." },
                          { label: "Yield Preservation", math: "YP = (L_{manual} - L_{ai})", desc: "Calculated improvement in harvest tonnage by reducing untreated crop necrosis." },
                          { label: "AI Impact", math: "AIM = Σ(Metrics * W_i)", desc: "A weighted composite score representing total farm optimization through the AI engine." }
                        ]}
                      />

                    </CardContent>
                  </Card>
                )

              })()}
            </div>
          </TabsContent>

        </Tabs>

      </div>
    </div>
  )
}
