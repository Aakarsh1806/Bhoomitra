"use client"

import { useState } from "react"
import { diseaseKnowledge } from "@/app/data/diseaseKnowledge"
import { TELANGANA_OFFLINE_NOTICE } from "@/app/data/telanganaPesticideCatalog"
import { addDetectionLog } from "@/app/lib/mlLogStore"
import { useFarmStore } from "@/store/farmStore"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import {
  Camera,
  Upload,
  Brain,
  ShieldCheck,
  AlertTriangle,
  Beaker,
  Info,
  ChevronRight,
  Sparkles,
  MapPin,
  Clock,
  FlaskConical,
  Leaf,
  Droplets,
  Zap,
  CheckCircle
} from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export default function DetectionPage() {
  const addDetection = useFarmStore((state) => state.addDetection)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [zone, setZone] = useState("A1")
  const [showDetails, setShowDetails] = useState(false)
  const [logAdded, setLogAdded] = useState(false)

  const handleUpload = async () => {
    if (!file) return

    const formData = new FormData()
    formData.append("zoneId", zone)
    formData.append("file", file)

    setLoading(true)
    setShowDetails(false)
    setLogAdded(false)

    try {
      // ✅ CALL NEXT.JS BACKEND (NOT FLASK DIRECTLY)
      const response = await fetch("/api/hardwareDetect", {
        method: "POST",
        body: formData,
      })

      const data = await response.json()

      if (data.success) {
        const severityStr = data.detection.severityLevel.charAt(0).toUpperCase() + data.detection.severityLevel.slice(1)
        
        const recommendation = data.recommendation || null

        addDetection({
          plantType: data.detection.disease.split("___")[0].replace(/_/g, " "),
          diseaseName: data.detection.disease.split("___")[1]?.replace(/_/g, " ") || "Healthy",
          severity: severityStr as any,
          infectedZoneId: zone,
          pesticideName: recommendation ? `${recommendation.activeIngredient} ${recommendation.formulation || ""}`.trim() : "General IPM recommendation",
          pesticideCategory: recommendation?.category || "Organic",
          dosagePerLiter: 0,
          coveragePerLiter: 100,
          sprayInterval: recommendation?.sprayInterval || "Consult local agriculture officer",
          preHarvestDays: 0,
          createdAt: Date.now()
        })

        setResult({
          detectionId: data.detection.id,
          disease: data.detection.disease,
          confidence: data.detection.confidence,
          severityLevel: data.detection.severityLevel,
          recommendation,
          recommendationNotice: data.recommendationNotice || TELANGANA_OFFLINE_NOTICE,
        })
        
        toast.success(`Analysis complete for Zone ${zone}`)
      }
    } catch (error) {
      console.error("Hardware detect error:", error)
    }

    setLoading(false)
  }

  const formattedDisease = result?.disease
    ? result.disease.replace(/___/g, " - ").replace(/_/g, " ")
    : null

  const isHealthyResult = (result?.disease || "").toLowerCase().includes("healthy")
  const diseaseParts = result?.disease?.split("___") || []
  const detectedCrop = diseaseParts.length > 1 ? diseaseParts[0].replace(/_/g, " ") : "Sample"
  const detectedCondition = diseaseParts.length > 1 ? diseaseParts[1].replace(/_/g, " ") : formattedDisease || "Unknown"

  const knowledge =
    result?.disease && diseaseKnowledge[result.disease]
      ? diseaseKnowledge[result.disease]
      : null

  const severity =
    result?.severityLevel
      ? result.severityLevel.charAt(0).toUpperCase() +
        result.severityLevel.slice(1)
      : null

  const recommendation = result?.recommendation
  const recommendationName = recommendation
    ? `${recommendation.activeIngredient} ${recommendation.formulation || ""}`.trim()
    : null
  const organicSuggestions = recommendation ? [recommendation.organicAlternative] : []

  return (
    <div className="min-h-screen space-y-8 animate-in fade-in duration-700">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold text-[#1a2e1d] flex items-center gap-3">
            <Brain className="text-green-600 h-9 w-9" />
            AI Disease Detection
          </h1>
          <p className="text-[#4a634f] mt-2 text-lg font-medium">
            Upload leaf samples for instant pathology analysis & treatment plans.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl shadow-sm border border-green-100">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-sm font-bold text-green-800">Neural Network Active</span>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-8 items-start">
        {/* Upload Card */}
        <Card className={`lg:col-span-4 border-green-100 shadow-xl rounded-[2.5rem] overflow-hidden ${result ? 'lg:sticky lg:top-8' : ''}`}>
          <CardHeader className="bg-green-50/50 pb-8">
            <CardTitle className="text-xl flex items-center gap-2">
              <Camera className="h-5 w-5 text-green-600" />
              Sample Analysis
            </CardTitle>
            <CardDescription>Select a high-resolution image of the affected leaf</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-8">
            <div className="relative group border-2 border-dashed border-green-200 rounded-3xl aspect-square flex flex-col items-center justify-center bg-green-50/20 hover:bg-green-50/40 transition-all overflow-hidden">
              {preview ? (
                <>
                  <img
                    src={preview}
                    alt="Preview"
                    className="object-cover w-full h-full"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Button variant="secondary" size="sm" onClick={() => document.getElementById('leaf-upload')?.click()}>
                      Change Image
                    </Button>
                  </div>
                </>
              ) : (
                <div 
                  className="flex flex-col items-center cursor-pointer p-6 text-center"
                  onClick={() => document.getElementById('leaf-upload')?.click()}
                >
                  <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center text-green-600 mb-4">
                    <Upload className="h-8 w-8" />
                  </div>
                  <p className="text-sm font-bold text-green-800">Click to upload or drag & drop</p>
                  <p className="text-xs text-green-600/60 mt-2">PNG, JPG up to 10MB</p>
                </div>
              )}
              <input
                id="leaf-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const selected = e.target.files?.[0]
                  if (selected) {
                    setFile(selected)
                    setPreview(URL.createObjectURL(selected))
                  }
                }}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <MapPin className="h-4 w-4 text-green-600" />
                Select Farm Zone
              </label>
              <Select value={zone} onValueChange={setZone}>
                <SelectTrigger className="rounded-xl border-green-100 h-12">
                  <SelectValue placeholder="Select Zone" />
                </SelectTrigger>
                <SelectContent>
                  {["A1","A2","A3","A4","A5","A6","B1","B2","B3","B4","B5","B6","C1","C2","C3","C4","C5","C6","D1","D2","D3","D4","D5","D6"].map(z => (
                    <SelectItem key={z} value={z}>Zone {z}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleUpload}
              disabled={!file || loading}
              className="w-full h-14 rounded-2xl bg-green-600 hover:bg-green-700 text-lg font-bold shadow-lg shadow-green-200 transition-all active:scale-95"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Neural Processing...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Analyze Leaf Pattern
                </div>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Results Section */}
        <div className="lg:col-span-8">
          {result ? (
            <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
              <Card className="border-green-100 shadow-2xl rounded-[2.5rem] overflow-hidden">
                <div className={`h-2 w-full ${severity === "High" ? "bg-red-500" : severity === "Moderate" ? "bg-orange-500" : "bg-green-500"}`}></div>
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <Badge 
                      variant={severity === "High" ? "destructive" : severity === "Moderate" ? "warning" as any : "default"}
                      className="px-4 py-1 rounded-full uppercase tracking-widest font-black text-[10px]"
                    >
                      {severity === "High" ? "Alert: Action Required" : severity === "Moderate" ? "Monitoring Required" : "System Normal"}
                    </Badge>
                    <div
                      className="text-xs font-bold text-slate-400"
                      title={result.detectionId || undefined}
                    >
                      Scan ID (short): {result.detectionId ? result.detectionId.split("-")[0].toUpperCase() : "—"}
                    </div>
                  </div>
                  <CardTitle className="text-3xl font-black text-slate-800 mt-4 leading-tight">
                    {isHealthyResult ? "Healthy Crop" : detectedCondition}
                  </CardTitle>
                  <CardDescription className="text-lg font-medium">
                    {isHealthyResult ? "No disease detected in this sample" : `Detected on ${detectedCrop}`}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                  <div className="grid md:grid-cols-3 gap-6">
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">AI Confidence</p>
                      <div className="flex items-center gap-3 mt-1">
                        <p className="text-2xl font-black text-slate-800">{(result.confidence * 100).toFixed(1)}%</p>
                        <Progress value={result.confidence * 100} className="h-2 flex-1 bg-slate-200" />
                      </div>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Severity Level</p>
                      <p className={`text-2xl font-black mt-1 ${severity === "High" ? "text-red-600" : severity === "Moderate" ? "text-orange-600" : "text-green-600"}`}>
                        {isHealthyResult ? "Healthy" : severity}
                      </p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Target Zone</p>
                      <div className="flex items-center gap-2 mt-1">
                        <MapPin className="h-5 w-5 text-green-600" />
                        <p className="text-2xl font-black text-slate-800">{zone}</p>
                      </div>
                    </div>
                  </div>

                  <Separator className="bg-slate-100" />

                  <div className="space-y-6">
                    <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                      <Beaker className="h-5 w-5 text-green-600" />
                      IPM Treatment Protocol
                    </h3>
                    
                    <div className="grid md:grid-cols-2 gap-6">
                      {/* Knowledge Base */}
                      <div className="space-y-4">
                        <div className="p-6 bg-green-50/50 rounded-3xl border border-green-100 h-full">
                          <h4 className="font-bold text-green-800 flex items-center gap-2 mb-3">
                            <Info className="h-4 w-4" />
                            Disease Insight
                          </h4>
                          <div className="text-sm text-green-900/70 leading-relaxed italic">
                            {knowledge ? (
                              <div className="space-y-2">
                                <p><span className="font-bold">Impact:</span> {knowledge.scientificInsights.impact}</p>
                                <p><span className="font-bold">Transmission:</span> {knowledge.scientificInsights.transmission}</p>
                                <p><span className="font-bold">Triggers:</span> {knowledge.scientificInsights.environmentalTriggers}</p>
                              </div>
                            ) : (
                              "No major issues identified. Maintain standard irrigation and moisture control to ensure continued crop health."
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Pesticide Recommendation */}
                      <div className="space-y-4">
                        {recommendation ? (
                            <div className="p-6 bg-slate-900 text-white rounded-[2rem] shadow-xl relative overflow-hidden h-full">
                              <div className="absolute top-0 right-0 p-6 opacity-10">
                                <FlaskConical className="h-24 w-24" />
                              </div>
                              <h4 className="font-bold text-green-400 flex items-center gap-2 mb-4">
                                <ShieldCheck className="h-4 w-4" />
                                Recommended Treatment
                              </h4>
                              <p className="text-2xl font-black mb-1">{recommendationName}</p>
                              <Badge variant="outline" className="border-green-800 text-green-400 mb-6">{recommendation.category}</Badge>
                              
                              <div className="grid grid-cols-2 gap-4 text-xs">
                                <div className="space-y-1">
                                  <p className="text-slate-400 flex items-center gap-1"><Droplets className="h-3 w-3" /> Dosage</p>
                                  <p className="font-bold">{recommendation.dosage}</p>
                                </div>
                                <div className="space-y-1">
                                  <p className="text-slate-400 flex items-center gap-1"><Clock className="h-3 w-3" /> Interval</p>
                                  <p className="font-bold">{recommendation.sprayInterval}</p>
                                </div>
                              </div>
                            </div>
                        ) : (
                          <div className="p-6 bg-green-900 text-white rounded-[2rem] flex flex-col items-center justify-center text-center h-full">
                            <Leaf className="h-10 w-10 text-green-400 mb-4" />
                            <p className="font-bold">Organic Maintenance</p>
                            <p className="text-xs text-green-100 opacity-60 mt-1">Natural balance achieved. No chemical prescription required.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <Card className="bg-amber-50 border-amber-200 rounded-2xl p-5">
                    <p className="text-xs font-bold text-amber-900 leading-relaxed">
                      {result?.recommendationNotice || TELANGANA_OFFLINE_NOTICE} Manual farmer confirmation is required before any spray command.
                    </p>
                  </Card>

                   {/* Secondary Actions */}
                   <div className="grid md:grid-cols-2 gap-4">
                    {knowledge && knowledge.farmerGuidance.immediateActions.length > 0 && (
                      <Card className="bg-amber-50 border-amber-100 rounded-2xl p-5">
                        <h4 className="font-black text-[10px] text-amber-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                          <Zap className="h-3 w-3" /> Immediate Actions
                        </h4>
                        <ul className="space-y-2">
                          {knowledge.farmerGuidance.immediateActions.map((action, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs font-bold text-amber-900">
                              <CheckCircle className="h-3 w-3 text-amber-500 mt-0.5" />
                              {action}
                            </li>
                          ))}
                        </ul>
                      </Card>
                    )}
                    <Card className="bg-slate-50 border-none rounded-2xl p-5">
                      <h4 className="font-black text-[10px] text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Leaf className="h-3 w-3" /> Organic Alternatives
                      </h4>
                      <ul className="space-y-3">
                        {organicSuggestions.slice(0, 4).map((s, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs font-bold text-slate-600">
                            <ChevronRight className="h-3 w-3 text-green-600 mt-0.5" />
                            {s}
                          </li>
                        ))}
                      </ul>
                    </Card>
                    <div className="bg-green-100/50 rounded-2xl p-5 flex flex-col justify-center border border-green-200">
                      <p className="text-xs font-bold text-green-800 leading-relaxed text-center">
                        Scan automatically logged to History. Comprehensive reports available in the Recommendations dashboard.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="h-full min-h-[500px] flex flex-col items-center justify-center text-center p-12 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-100">
              <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 mb-6">
                <Brain className="h-12 w-12" />
              </div>
              <h3 className="text-2xl font-black text-slate-300">Awaiting Sample Data</h3>
              <p className="text-slate-400 mt-3 max-w-sm font-medium">
                Please upload a leaf image on the left panel to begin the AI automated diagnosis.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
