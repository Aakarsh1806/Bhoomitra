"use client"

import { useMemo, useState, useEffect } from "react"
import { useFarmStore } from "@/store/farmStore"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import ZoneDetails from "@/components/ZoneDetails"
import CommandConfirmationDialog from "@/components/command-confirmation-dialog"
import { 
  Droplets, 
  MapPin, 
  History, 
  Zap, 
  AlertCircle,
  Clock,
  FlaskConical,
  Sprout
} from "lucide-react"

interface ZoneData {
  id: string
}

interface FarmProfile {
  acres: number
  zones: number
  zoneNames: Record<string, string>
}

const COVERAGE_PER_LITER = 100

function getZoneAreaSqMeters(acres: number, zoneCount: number) {
  const zoneAreaSqYards = (acres * 4040) / Math.max(1, zoneCount)
  return zoneAreaSqYards * 0.836
}

function generateZoneIds(count: number) {
  const cols = 6
  const ids: string[] = []

  for (let i = 0; i < count; i++) {
    const row = String.fromCharCode(65 + Math.floor(i / cols))
    const col = (i % cols) + 1
    ids.push(`${row}${col}`)
  }

  return ids
}

export default function ControlsPage() {
  const { detections, activities, addActivity } = useFarmStore()
  const [selectedZones, setSelectedZones] = useState<string[]>([])
  const [viewingZoneId, setViewingZoneId] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [sprayConfirmOpen, setSprayConfirmOpen] = useState(false)
  const [zones, setZones] = useState<string[]>([])
  const [profile, setProfile] = useState<FarmProfile>({
    acres: 6,
    zones: 24,
    zoneNames: {},
  })

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [zonesRes, farmerProfileRes] = await Promise.all([
          fetch("/api/zones"),
          fetch("/api/farmer-profile"),
        ])

        const rawZones = await zonesRes.json()
        const zoneData: ZoneData[] = Array.isArray(rawZones) ? rawZones : rawZones?.zones || []
        const farmerProfileData = await farmerProfileRes.json()

        const configuredZones = farmerProfileData?.exists
          ? generateZoneIds(farmerProfileData.profile.zones)
          : zoneData.map(zone => zone.id)

        setZones(configuredZones)
        if (farmerProfileData?.exists) {
          setProfile({
            acres: farmerProfileData.profile.acres,
            zones: farmerProfileData.profile.zones,
            zoneNames: farmerProfileData.profile.zoneNames || {},
          })
        }
      } catch (error) {
        console.error("Failed to load zones/profile", error)
      }
    }

    fetchData()
  }, [])

  const zoneAreaSqM = useMemo(() => {
    return getZoneAreaSqMeters(profile.acres, profile.zones)
  }, [profile.acres, profile.zones])

  const selectedAreaSqM = useMemo(() => {
    return selectedZones.length * zoneAreaSqM
  }, [selectedZones.length, zoneAreaSqM])

  const requiredVolumeLiters = useMemo(() => {
    return selectedAreaSqM / COVERAGE_PER_LITER
  }, [selectedAreaSqM])

  const columns = Math.min(profile.zones, 6)
  const rows = Math.ceil(profile.zones / Math.max(columns, 1))

  const getZoneLabel = (zoneId: string) => {
    const custom = profile.zoneNames?.[zoneId]
    return custom && custom.trim().length > 0 ? custom : zoneId
  }

  const selectedZoneDisplayName = useMemo(() => {
    if (selectedZones.length === 0) return ""
    const firstZone = selectedZones[0]
    const firstLabel = getZoneLabel(firstZone)
    return selectedZones.length === 1 ? firstLabel : `${firstLabel} + ${selectedZones.length - 1} more`
  }, [selectedZones, profile.zoneNames])

  const selectedDetection = useMemo(() => {
    const matchedZone = selectedZones.find((zoneId) => detections.some((d) => d.infectedZoneId === zoneId))
    if (!matchedZone) return null
    return detections.find((d) => d.infectedZoneId === matchedZone) || null
  }, [selectedZones, detections])

  const handleZoneToggle = (zoneId: string) => {
    setViewingZoneId(zoneId)
    setSelectedZones(prev => 
      prev.includes(zoneId) ? prev.filter(z => z !== zoneId) : [...prev, zoneId]
    )
  }

  const getSeverityColor = (zoneId: string) => {
    const zoneDetection = detections.find(d => d.infectedZoneId === zoneId)
    if (!zoneDetection) return "bg-green-100 border-green-200"
    
    switch (zoneDetection.severity) {
      case "Low": return "bg-yellow-100 border-yellow-300"
      case "Moderate": return "bg-orange-200 border-orange-400"
      case "High": return "bg-red-200 border-red-400"
      default: return "bg-green-100 border-green-200"
    }
  }

  const getBorderClass = (zoneId: string) => {
    const zoneDetection = detections.find(d => d.infectedZoneId === zoneId)
    if (!zoneDetection) return ""
    
    switch (zoneDetection.pesticideCategory) {
      case "Fungicide": return "border-[3px] border-blue-500 shadow-lg shadow-blue-200"
      case "Bactericide": return "border-[3px] border-purple-500 shadow-lg shadow-purple-200"
      case "Nematicide": return "border-[3px] border-amber-800 shadow-lg shadow-amber-200"
      case "Viral Control": return "border-[3px] border-teal-500 shadow-lg shadow-teal-200"
      default: return ""
    }
  }

  const executeSprayNow = () => {
    if (selectedZones.length === 0) {
      toast.error("Please select at least one zone to spray")
      return
    }
    
    // Check if any selected zones have detections
    const zonesWithDetections = selectedZones.filter(zId => 
      detections.some(d => d.infectedZoneId === zId)
    )

    if (zonesWithDetections.length === 0) {
      toast.error("No detection data available for selected zones. Visit Detection page first.")
      return
    }

    // For simplicity, we'll use the detection data from the FIRST infected zone in the selection
    const firstDetectionId = zonesWithDetections[0]
    const detection = detections.find(d => d.infectedZoneId === firstDetectionId)!

    const totalArea = selectedAreaSqM
    const calculatedLiters = parseFloat((totalArea / COVERAGE_PER_LITER).toFixed(2))

    const newActivity = {
      id: crypto.randomUUID(),
      zones: [...selectedZones],
      pesticideName: detection.pesticideName,
      totalLiters: calculatedLiters,
      timestamp: Date.now(),
      status: "Completed" as const
    }

    addActivity(newActivity)
    setSelectedZones([])
    setSprayConfirmOpen(false)
    toast.success(`Spraying completed for ${selectedZones.length} zones. Total: ${calculatedLiters}L`)
  }

  const handleSprayNowClick = () => {
    if (selectedZones.length === 0) {
      toast.error("Please select at least one zone to spray")
      return
    }

    const zonesWithDetections = selectedZones.filter(zId =>
      detections.some(d => d.infectedZoneId === zId)
    )

    if (zonesWithDetections.length === 0) {
      toast.error("No detection data available for selected zones. Visit Detection page first.")
      return
    }

    setSprayConfirmOpen(true)
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <Zap className="text-blue-600 h-8 w-8" />
              Smart Spray Control
            </h1>
            <p className="text-slate-500">Manual zone override and automated distribution logic</p>
          </div>
          <div className="flex gap-3">
            <Button 
                variant="outline" 
                onClick={() => setShowHistory(!showHistory)}
                className="flex items-center gap-2"
            >
              <History className="h-4 w-4" />
              {showHistory ? "View Control Grid" : "View All Activity"}
            </Button>
            <Button 
                onClick={handleSprayNowClick}
                className="bg-blue-600 hover:bg-blue-700 flex items-center gap-2"
            >
              <Droplets className="h-4 w-4" />
              Spray Now
            </Button>
          </div>
        </div>

        {showHistory ? (
          /* Activity Log View */
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle>Recent Activity Logs</CardTitle>
              <CardDescription>Historical data of all spray operations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {activities.length > 0 ? (
                  activities.map((act) => (
                    <div key={act.id} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 bg-white hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                          <Droplets className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-800">{act.pesticideName}</span>
                            <Badge variant="secondary" className="text-[10px] uppercase">{act.status}</Badge>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {new Date(act.timestamp).toLocaleString()}</span>
                            <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {act.zones.join(", ")}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-slate-900">{act.totalLiters}L</p>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Consumption</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 text-slate-400">
                    <Sprout className="h-12 w-12 mx-auto mb-4 opacity-20" />
                    No activity logs found.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          /* Main Control View */
          <div className="grid lg:grid-cols-3 gap-8">
            
            {/* Grid Map */}
            <div className="lg:col-span-2 space-y-6">
              <Card className="border-slate-200 shadow-md overflow-hidden">
                <CardHeader className="bg-white border-b border-slate-100">
                  <div className="flex justify-between items-center">
                    <CardTitle>
                      Farm Grid Map ({profile.zones} Zones | {rows}x{columns} | {profile.acres} Acres)
                    </CardTitle>
                    <div className="flex gap-4">
                       <span className="flex items-center gap-1.5 text-xs text-slate-600">
                        <div className="h-2.5 w-2.5 rounded-full bg-green-400" /> Healthy
                       </span>
                       <span className="flex items-center gap-1.5 text-xs text-slate-600">
                        <div className="h-2.5 w-2.5 rounded-full bg-red-400" /> Infected
                       </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-8 bg-slate-50/50">
                  <div
                    className="grid gap-4 max-w-3xl mx-auto"
                    style={{ gridTemplateColumns: `repeat(${Math.max(columns, 1)}, minmax(0, 1fr))` }}
                  >
                    {zones.map((id) => {
                      const zoneDetection = detections.find(d => d.infectedZoneId === id);
                      return (
                        <button
                          key={id}
                          onClick={() => {
                            handleZoneToggle(id);
                            setViewingZoneId(id);
                          }}
                          className={`
                            aspect-square rounded-2xl flex flex-col items-center justify-center gap-2
                            transition-all duration-300 relative group
                            ${getSeverityColor(id)}
                            ${getBorderClass(id)}
                            ${selectedZones.includes(id) ? "ring-4 ring-blue-500/30 scale-[1.05] z-10" : "hover:scale-[1.02]"}
                          `}
                        >
                          <span className={`text-sm font-bold ${zoneDetection ? "text-slate-900" : "text-green-700"}`}>
                              {getZoneLabel(id)}
                          </span>
                          <span className="text-[10px] text-slate-500">{id}</span>
                          {selectedZones.includes(id) && (
                             <div className="absolute top-2 right-2 h-5 w-5 bg-blue-600 rounded-full flex items-center justify-center">
                                <span className="text-[10px] text-white font-bold animate-in zoom-in-50">✓</span>
                             </div>
                          )}
                          {zoneDetection && (
                             <div className="text-[10px] font-bold text-red-600 px-2 py-0.5 rounded-full bg-white/60 border border-red-200">
                                {zoneDetection.severity}
                             </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Status Alert */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                  {detections.length > 0 ? (
                    <>
                      <div className="h-12 w-12 rounded-2xl flex items-center justify-center bg-amber-50 text-amber-600">
                          <AlertCircle className="h-6 w-6" />
                      </div>
                      <div>
                          <h4 className="font-bold text-slate-900">
                            Detection: {detections[0].diseaseName}
                          </h4>
                          <p className="text-sm text-slate-500">
                            AI has identified {detections[0].severity} severity infection in {detections.length} zones. Action recommended.
                          </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="h-12 w-12 rounded-2xl flex items-center justify-center bg-green-50 text-green-600">
                          <Sprout className="h-6 w-6" />
                      </div>
                      <div>
                          <h4 className="font-bold text-slate-900">System Status: Optimized</h4>
                          <p className="text-sm text-slate-500">All zones currently monitored. No critical pathogens detected in latest scan cycle.</p>
                      </div>
                    </>
                  )}
              </div>
            </div>

            {/* Sidebar Details */}
            <div className="space-y-6">
               {viewingZoneId ? (
                 <ZoneDetails 
                   zoneId={viewingZoneId} 
                   onClose={() => setViewingZoneId(null)}
                   mode="autospray"
                 />
               ) : (
                 <Card className="border-slate-200 shadow-sm h-full">
                    <CardHeader>
                      <CardTitle>Treatment Specs</CardTitle>
                      <CardDescription>Live data from detection engine</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                    {detections.length > 0 ? (
                      <>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500 flex items-center gap-2"><FlaskConical className="h-4 w-4" /> Pesticide</span>
                                <span className="font-semibold text-slate-900">{detections[0].pesticideName}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500">Category</span>
                                <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100 border-none">{detections[0].pesticideCategory}</Badge>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500">Dosage</span>
                                <span className="font-semibold">{detections[0].dosagePerLiter} ml/L</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500">Coverage</span>
                                <span className="font-semibold">{COVERAGE_PER_LITER} m²/L</span>
                            </div>
                        </div>

                        <div className="pt-6 border-t border-slate-100">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Calculation</h4>
                            <div className="bg-slate-50 p-4 rounded-xl space-y-3">
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-slate-500">Selected Area</span>
                                  <span className="text-slate-900 font-medium">{selectedAreaSqM.toFixed(1)} m²</span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-slate-500">Formula</span>
                                    <span className="text-slate-400">Area / 100 m²/L</span>
                                </div>
                                <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                                    <span className="text-sm font-bold text-slate-900">Required Vol.</span>
                                    <span className="text-lg font-black text-blue-600">
                                      {requiredVolumeLiters.toFixed(2)} L
                                    </span>
                                </div>
                            </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-10">
                        <AlertCircle className="h-10 w-10 text-slate-200 mx-auto mb-3" />
                        <p className="text-sm text-slate-400">Perform a leaf scan to generate treatment specifications.</p>
                      </div>
                    )}
                    </CardContent>
                 </Card>
               )}
            </div>

          </div>
        )}
      </div>

      <CommandConfirmationDialog
        open={sprayConfirmOpen}
        onOpenChange={setSprayConfirmOpen}
        zoneName={selectedZoneDisplayName || "Selected zones"}
        actionType="Spray"
        chemicalName={selectedDetection?.pesticideName || "N/A"}
        dosage={selectedDetection ? `${selectedDetection.dosagePerLiter} ml/L` : "N/A"}
        estimatedVolumeLiters={requiredVolumeLiters}
        onConfirm={executeSprayNow}
      />
    </div>
  )
}
