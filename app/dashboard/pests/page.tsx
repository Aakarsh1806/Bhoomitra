"use client"

import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  BadgeCheck,
  Bug,
  Camera,
  CheckCircle2,
  ChevronRight,
  Clock3,
  CloudOff,
  Eye,
  FlaskConical,
  History,
  ImagePlus,
  Leaf,
  Loader2,
  MapPin,
  Microscope,
  RefreshCw,
  ShieldCheck,
  Sprout,
  Volume2,
} from "lucide-react"
import { toast } from "sonner"
import { useLanguage } from "@/lib/language-context"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const FALLBACK_ZONES = ["A1", "A2", "A3", "A4", "A5", "A6", "B1", "B2", "B3", "B4", "B5", "B6"]
const SUPPORTED_CROPS = ["Paddy", "Tomato", "Cotton", "Chilli", "Okra", "Maize", "Potato", "Mustard", "Sugarcane"]

type PestStatus = "new" | "monitoring" | "improving" | "increasing" | "resolved"
type ConfidenceBand = "low" | "medium" | "high"

type PestPrediction = {
  label: string
  pestId: string
  confidence: number
}

type PesticideAdvice = {
  product: string
  type: string
  modeOfAction: string
  resistanceNote: string
  labelRate: string
  application: string
  interval: string
  preHarvestInterval: string
  trigger: string
  safety: string
  eligible: boolean
  blockedReason: string | null
}

type PestResult = {
  success: boolean
  persisted: boolean
  recordId: string | null
  model: { modelId: string; modelVersion: string; ready: boolean; task: string }
  scan: { zoneId: string; crop: string; timestamp: string; imageName: string | null }
  summary: {
    primaryPestId: string
    primaryPestName: string
    scientificName: string
    confidence: number
    confidenceBand: ConfidenceBand
    cropMatch: "matched" | "review" | "not_applicable"
    identityNeedsReview: boolean
  }
  predictions: PestPrediction[]
  classificationLimit: string
  pest: { damageSigns: string[]; whyItMatters: string }
  advice: {
    inspectToday: string[]
    next48Hours: string[]
    prevention: string[]
    biologicalControl: string[]
    pesticide: PesticideAdvice
  }
  safety: {
    identityConfirmationRequired: boolean
    fieldThresholdRequired: boolean
    automaticChemicalAction: boolean
    message: string
  }
}

type PestRecord = {
  id: string
  zoneId: string
  crop: string
  pestName: string
  scientificName: string
  confidence: number
  confidenceBand: ConfidenceBand
  timestamp: string
  farmerConfirmed: boolean
  status: PestStatus
  followUpDue: string
}

type ModelStatus = {
  integrationReady: boolean
  model: { reachable: boolean; ready: boolean; modelId: string; modelVersion: string; classCount: number; message: string }
}

type SprayWindow = { safeNow: boolean; headline: string; source?: string }

const statusStyle: Record<PestStatus, string> = {
  new: "bg-sky-100 text-sky-800",
  monitoring: "bg-amber-100 text-amber-900",
  improving: "bg-emerald-100 text-emerald-800",
  increasing: "bg-red-100 text-red-800",
  resolved: "bg-slate-100 text-slate-700",
}

const confidenceBandStyle: Record<ConfidenceBand, { badge: string; bar: string; label: string }> = {
  high: { badge: "bg-green-100 text-green-800", bar: "bg-green-600", label: "High" },
  medium: { badge: "bg-amber-100 text-amber-900", bar: "bg-amber-500", label: "Medium" },
  low: { badge: "bg-red-100 text-red-800", bar: "bg-red-500", label: "Low" },
}

const MIN_CONFIDENCE_TO_SHOW = 0.65

function formatConfidence(value: number) {
  return `${Math.round(value * 100)}%`
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Unknown time"
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(date)
}

function ActionList({ items }: { items: string[] }) {
  return (
    <div className="space-y-4">
      {items.map((item, index) => (
        <div key={`${item}-${index}`} className="flex items-start gap-3">
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-100 text-sm font-extrabold text-green-800">
            {index + 1}
          </div>
          <p className="text-base font-medium leading-7 text-slate-700">{item}</p>
        </div>
      ))}
    </div>
  )
}

export default function PestDetectionPage() {
  const { language } = useLanguage()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [zone, setZone] = useState("A1")
  const [crop, setCrop] = useState("Paddy")
  const [farmCrop, setFarmCrop] = useState("Paddy")
  const [zoneOptions, setZoneOptions] = useState(FALLBACK_ZONES)
  const [result, setResult] = useState<PestResult | null>(null)
  const [history, setHistory] = useState<PestRecord[]>([])
  const [summary, setSummary] = useState({ active: 0, increasing: 0, followUpsDue: 0 })
  const [modelStatus, setModelStatus] = useState<ModelStatus | null>(null)
  const [sprayWindow, setSprayWindow] = useState<SprayWindow | null>(null)
  const [loading, setLoading] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nextStep, setNextStep] = useState<string | null>(null)

  const cropOptions = useMemo(
    () => Array.from(new Set([farmCrop, ...SUPPORTED_CROPS].filter(Boolean))),
    [farmCrop],
  )

  const refreshHistory = async () => {
    setHistoryLoading(true)
    try {
      const response = await fetch("/api/pests", { cache: "no-store" })
      const body = await response.json()
      if (!response.ok) throw new Error(body?.error || "Could not load pest history")
      setHistory(Array.isArray(body.records) ? body.records : [])
      setSummary(body.summary || { active: 0, increasing: 0, followUpsDue: 0 })
    } catch (historyError) {
      console.error(historyError)
    } finally {
      setHistoryLoading(false)
    }
  }

  useEffect(() => {
    let active = true

    Promise.allSettled([
      fetch("/api/zones").then((response) => response.json()),
      fetch("/api/farmer-profile").then((response) => response.json()),
      fetch("/api/pest-detect").then((response) => response.json()),
      fetch("/api/spray-window").then((response) => response.json()),
    ]).then(([zonesResponse, profileResponse, modelResponse, weatherResponse]) => {
      if (!active) return

      if (zonesResponse.status === "fulfilled") {
        const candidateZones = Array.isArray(zonesResponse.value)
          ? zonesResponse.value
          : zonesResponse.value?.zones
        const ids = Array.isArray(candidateZones)
          ? candidateZones.map((item: { id?: string }) => item.id).filter((id: unknown): id is string => typeof id === "string")
          : []
        if (ids.length) setZoneOptions(ids)
      }

      if (profileResponse.status === "fulfilled") {
        const profileCrop = profileResponse.value?.profile?.primaryCrop?.trim()
        if (profileCrop) {
          setFarmCrop(profileCrop)
          setCrop(profileCrop)
        }
      }

      if (modelResponse.status === "fulfilled") setModelStatus(modelResponse.value)
      if (weatherResponse.status === "fulfilled") setSprayWindow(weatherResponse.value)
    })

    void refreshHistory()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [preview])

  const selectImage = (selected?: File) => {
    if (!selected) return
    if (preview) URL.revokeObjectURL(preview)
    setFile(selected)
    setPreview(URL.createObjectURL(selected))
    setResult(null)
    setError(null)
    setNextStep(null)
  }

  const runScan = async () => {
    if (!file) {
      toast.error("Take or choose a clear pest photo first.")
      return
    }

    const form = new FormData()
    form.append("zoneId", zone)
    form.append("crop", crop)
    form.append("language", language)
    if (file) form.append("file", file)

    setLoading(true)
    setError(null)
    setNextStep(null)
    setResult(null)

    try {
      const response = await fetch("/api/pest-detect", { method: "POST", body: form })
      const body = await response.json()
      if (!response.ok) {
        setNextStep(body?.nextStep || null)
        throw new Error(body?.error || "The pest check could not be completed.")
      }
      setResult(body)
      toast.success(`Pest check completed for Zone ${zone}`)
      void refreshHistory()
    } catch (scanError) {
      const message = scanError instanceof Error ? scanError.message : "The pest check could not be completed."
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  const confirmResult = async () => {
    if (!result) return
    setConfirming(true)
    try {
      const response = await fetch("/api/pests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: result.recordId,
          status: "monitoring",
          farmerConfirmed: true,
          outcomeNote: "Farmer reviewed the classifier result and prevention plan.",
        }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body?.error || "Could not save this observation.")
      setResult((current) => current ? { ...current, persisted: true, recordId: body.record?.id || current.recordId } : current)
      toast.success("Confirmed and added to the crop-health audit")
      await refreshHistory()
    } catch (confirmError) {
      toast.error(confirmError instanceof Error ? confirmError.message : "Could not save this observation.")
    } finally {
      setConfirming(false)
    }
  }

  const updateOutcome = async (id: string, status: PestStatus) => {
    try {
      const response = await fetch("/api/pests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body?.error || "Could not save the follow-up.")
      toast.success("Follow-up saved")
      await refreshHistory()
    } catch (outcomeError) {
      toast.error(outcomeError instanceof Error ? outcomeError.message : "Could not save the follow-up.")
    }
  }

  const speakAdvice = () => {
    if (!result || typeof window === "undefined" || !("speechSynthesis" in window)) {
      toast.error("Voice playback is not supported on this device.")
      return
    }
    const words = [
      `${result.summary.primaryPestName} may be present.`,
      ...result.advice.inspectToday,
      ...result.advice.next48Hours,
    ].join(" ")
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(words)
    utterance.lang = language === "hi" ? "hi-IN" : language === "te" ? "te-IN" : language === "ta" ? "ta-IN" : language === "mr" ? "mr-IN" : "en-IN"
    window.speechSynthesis.speak(utterance)
  }

  const sprayDecisionReady = false
  const sprayDecisionTitle = "Do not spray from an image result alone"

  return (
    <div className="min-h-screen space-y-8 pb-12 animate-in fade-in duration-500">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-extrabold text-[#1a2e1d] md:text-4xl">
            <Bug className="h-9 w-9 text-green-700" />
            Pest Detection &amp; Prevention
          </h1>
          <p className="mt-2 max-w-3xl text-base font-medium text-[#4a634f] md:text-lg">
            Photograph the pest clearly, identify its likely class, and get a pest-specific scouting and prevention plan.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="gap-2 rounded-full border-green-200 bg-white px-4 py-2 text-green-800">
            <CloudOff className="h-4 w-4" /> Offline-ready workflow
          </Badge>
          <Badge variant="outline" className={`gap-2 rounded-full px-4 py-2 ${modelStatus?.model?.ready ? "border-green-200 bg-green-50 text-green-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
            <span className={`h-2 w-2 rounded-full ${modelStatus?.model?.ready ? "bg-green-500" : "bg-amber-500"}`} />
            {modelStatus?.model?.ready ? `Pest model ready · ${modelStatus.model.classCount || 19} classes` : "Pest model unavailable"}
          </Badge>
        </div>
      </header>

      <div className="grid items-start gap-7 xl:grid-cols-12">
        <Card className="overflow-hidden rounded-[2rem] border-green-100 shadow-lg xl:col-span-3">
          <CardHeader className="bg-green-50/70 pb-4">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Camera className="h-5 w-5 text-green-700" /> Check a plant
            </CardTitle>
            <CardDescription>Use one clear close-up. Include the insect and its damage where possible.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-5">
            <button
              type="button"
              onClick={() => document.getElementById("pest-image")?.click()}
              className="group relative flex aspect-[16/9] w-full items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-green-200 bg-green-50/40 text-center transition hover:border-green-400 hover:bg-green-50"
            >
              {preview ? (
                <>
                  <img src={preview} alt="Pest photo preview" className="h-full w-full object-cover" />
                  <span className="absolute bottom-3 rounded-full bg-black/70 px-4 py-2 text-xs font-bold text-white">Tap to change photo</span>
                </>
              ) : (
                <span className="flex flex-col items-center p-4">
                  <span className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-green-100 text-green-700">
                    <ImagePlus className="h-6 w-6" />
                  </span>
                  <span className="font-bold text-green-900">Take or choose a pest photo</span>
                  <span className="mt-1 text-sm leading-5 text-slate-500">Natural light · insect in focus</span>
                </span>
              )}
            </button>
            <input
              id="pest-image"
              className="hidden"
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(event) => selectImage(event.target.files?.[0])}
            />

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                  <MapPin className="h-4 w-4 text-green-700" /> Field zone
                </label>
                <Select value={zone} onValueChange={setZone}>
                  <SelectTrigger className="h-12 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {zoneOptions.map((item) => <SelectItem key={item} value={item}>Zone {item}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                  <Leaf className="h-4 w-4 text-green-700" /> Crop
                </label>
                <Select value={crop} onValueChange={setCrop}>
                  <SelectTrigger className="h-12 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {cropOptions.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-sm leading-5 text-slate-500">Registered crop: {farmCrop}. Guidance is checked against the selected crop.</p>

            <Button
              className="h-12 w-full rounded-xl bg-green-700 text-base font-bold hover:bg-green-800"
              disabled={loading || !file}
              onClick={() => void runScan()}
            >
              {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Microscope className="mr-2 h-5 w-5" />}
              Check this photo
            </Button>
            <p className="text-center text-sm leading-5 text-slate-500">Only real model results are shown. Scans above {formatConfidence(MIN_CONFIDENCE_TO_SHOW)} confidence are saved to pest history.</p>
          </CardContent>
        </Card>

        <div className="space-y-6 xl:col-span-9">
          {error ? (
            <Card className="rounded-[2rem] border-amber-200 bg-amber-50 shadow-sm">
              <CardContent className="flex gap-4 p-6">
                <AlertTriangle className="mt-1 h-7 w-7 shrink-0 text-amber-700" />
                <div>
                  <h2 className="text-lg font-extrabold text-amber-950">Pest analysis could not run</h2>
                  <p className="mt-1 text-sm leading-6 text-amber-900">{error}</p>
                  {nextStep && <p className="mt-3 rounded-xl bg-white/70 p-3 text-sm font-semibold text-amber-950">Next model step: {nextStep}</p>}
                </div>
              </CardContent>
            </Card>
          ) : !result ? (
            <Card className="flex min-h-[430px] items-center justify-center rounded-[2rem] border-green-100 bg-gradient-to-br from-white to-green-50/60 shadow-sm">
              <CardContent className="max-w-xl p-10 text-center">
                <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-green-700">
                  <Eye className="h-10 w-10" />
                </div>
                <h2 className="text-2xl font-extrabold text-slate-900">What you will receive</h2>
                <p className="mt-3 leading-7 text-slate-600">A likely pest identification with crop-specific damage signs, scouting steps, prevention and pesticide safety guidance.</p>
                <div className="mt-7 grid gap-3 text-left sm:grid-cols-2">
                  {["What pest?", "What should I do?"].map((item) => (
                    <div key={item} className="rounded-2xl border border-green-100 bg-white p-4 text-center text-sm font-extrabold text-green-900 shadow-sm">{item}</div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card className="overflow-hidden rounded-[2rem] border-green-100 shadow-lg">
                <div className="bg-green-700 px-6 py-3 text-sm font-extrabold text-white">Real image analysed by the Bhoomitra pest classifier</div>
                <CardContent className="grid gap-6 p-6 lg:grid-cols-2">
                  <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-emerald-100 via-green-50 to-lime-100">
                    {preview ? (
                      <img src={preview} alt="Uploaded pest photo" className="h-full w-full object-contain" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Leaf className="h-40 w-40 rotate-[-18deg] text-green-600/70" />
                      </div>
                    )}
                    <div className="absolute bottom-3 left-3 right-3 rounded-xl bg-black/75 px-3 py-2 text-xs font-bold text-white">
                      Classifier result: identifies the dominant pest category; it does not locate or count insects.
                    </div>
                  </div>

                  <div className="flex flex-col justify-center">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">Zone {result.scan.zoneId}</Badge>
                      <Badge variant="outline">{result.scan.crop}</Badge>
                    </div>
                    <p className="mt-5 text-sm font-bold uppercase tracking-[0.18em] text-green-700">Possible pest</p>
                    <h2 className="mt-1 text-3xl font-black text-slate-950">{result.summary.primaryPestName}</h2>
                    <p className="mt-1 text-sm italic text-slate-500">{result.summary.scientificName}</p>

                    {result.summary.confidence > MIN_CONFIDENCE_TO_SHOW ? (
                      <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Model confidence</p>
                          <Badge className={`${confidenceBandStyle[result.summary.confidenceBand].badge} shadow-none`}>
                            {confidenceBandStyle[result.summary.confidenceBand].label}
                          </Badge>
                        </div>
                        <div className="mt-2 flex items-center gap-3">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
                            <div
                              className={`h-full rounded-full transition-all ${confidenceBandStyle[result.summary.confidenceBand].bar}`}
                              style={{ width: `${Math.max(0, Math.min(100, result.summary.confidence * 100))}%` }}
                            />
                          </div>
                          <span className="text-lg font-black text-slate-800">{formatConfidence(result.summary.confidence)}</span>
                        </div>

                        {result.predictions.length > 1 && (
                          <div className="mt-4 space-y-2 border-t border-slate-200 pt-3">
                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Other possible matches</p>
                            {result.predictions.slice(1).map((prediction) => (
                              <div key={prediction.label} className="flex items-center justify-between gap-3 text-sm">
                                <span className="font-semibold text-slate-600">{prediction.label}</span>
                                <span className="font-bold text-slate-500">{formatConfidence(prediction.confidence)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
                        Confidence score not shown — below the reporting threshold. Retake the photo in better light or get an expert check before acting.
                      </div>
                    )}

                    <p className="mt-5 text-sm font-medium leading-6 text-slate-600">{result.classificationLimit}</p>
                    <Button variant="outline" className="mt-5 w-full rounded-xl" onClick={speakAdvice}>
                      <Volume2 className="mr-2 h-4 w-4" /> Listen to advice
                    </Button>
                    {result.recordId ? (
                      <Button
                        className="mt-3 h-12 w-full rounded-xl bg-green-700 text-base font-bold hover:bg-green-800"
                        disabled={confirming || (result.persisted && history.some((record) => record.id === result.recordId && record.farmerConfirmed))}
                        onClick={() => void confirmResult()}
                      >
                        {confirming ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <CheckCircle2 className="mr-2 h-5 w-5" />}
                        Confirm and save observation
                      </Button>
                    ) : (
                      <p className="mt-3 rounded-xl bg-slate-100 p-3 text-center text-sm font-semibold text-slate-500">
                        Not saved to pest history — confidence was below {formatConfidence(MIN_CONFIDENCE_TO_SHOW)}.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

            </>
          )}
        </div>
      </div>

      {result && (
        <>
          <Card className="rounded-[2rem] border-green-100 shadow-sm">
            <CardHeader className="pb-5">
              <CardTitle className="flex items-center gap-3 text-3xl">
                <Sprout className="h-8 w-8 text-green-700" /> Clear prevention plan
              </CardTitle>
              <CardDescription className="text-base leading-7">Follow these steps before considering pesticide use.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5 md:grid-cols-3">
              <div className="rounded-2xl border border-red-100 bg-red-50/60 p-6">
                <p className="mb-5 flex items-center gap-2 text-lg font-extrabold text-red-900"><Clock3 className="h-6 w-6" /> Do today</p>
                <ActionList items={result.advice.inspectToday} />
              </div>
              <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-6">
                <p className="mb-5 flex items-center gap-2 text-lg font-extrabold text-amber-950"><ChevronRight className="h-6 w-6" /> Next 48 hours</p>
                <ActionList items={result.advice.next48Hours} />
              </div>
              <div className="rounded-2xl border border-green-100 bg-green-50/70 p-6">
                <p className="mb-5 flex items-center gap-2 text-lg font-extrabold text-green-900"><ShieldCheck className="h-6 w-6" /> Prevent it returning</p>
                <ActionList items={result.advice.prevention} />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[2rem] border-blue-100 shadow-sm">
            <CardHeader className="pb-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-3 text-3xl">
                    <FlaskConical className="h-8 w-8 text-blue-700" /> Treatment &amp; pesticide guidance
                  </CardTitle>
                  <CardDescription className="mt-2 text-base leading-7">Begin with the lowest-impact option. Use a pesticide only after field confirmation and a safe weather check.</CardDescription>
                </div>
                <Badge className={`px-4 py-2 text-sm ${sprayDecisionReady ? "bg-green-100 text-green-900" : "bg-red-100 text-red-900"}`}>
                  {sprayDecisionReady ? "Conditions suitable for review" : "Do not spray now"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className={`rounded-2xl border p-6 ${sprayDecisionReady ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
                <p className={`text-sm font-extrabold uppercase tracking-[0.16em] ${sprayDecisionReady ? "text-green-700" : "text-red-700"}`}>When should I spray?</p>
                <h3 className={`mt-2 text-2xl font-black ${sprayDecisionReady ? "text-green-950" : "text-red-950"}`}>{sprayDecisionTitle}</h3>
                <p className="mt-3 text-base font-medium leading-7 text-slate-700">
                  {result.advice.pesticide.blockedReason || result.advice.pesticide.trigger}
                </p>
                <p className="mt-3 text-base font-bold leading-7 text-slate-900">
                  Weather gate: {sprayWindow?.safeNow
                    ? "Rain and wind are currently acceptable, but this is not permission to spray until field scouting confirms the pest and action threshold."
                    : sprayWindow?.headline || "Check rain and wind before any spray."}
                </p>
              </div>

              <div className="grid gap-5 lg:grid-cols-3">
                <section className="rounded-2xl border border-green-100 bg-green-50/60 p-6">
                  <p className="mb-5 flex items-center gap-2 text-xl font-extrabold text-green-950">
                    <BadgeCheck className="h-6 w-6 text-green-700" /> 1. Try lower-impact control first
                  </p>
                  <ActionList items={result.advice.biologicalControl} />
                </section>

                <section className="rounded-2xl border border-amber-100 bg-amber-50/50 p-6">
                  <p className="mb-5 flex items-center gap-2 text-xl font-extrabold text-amber-950">
                    <Clock3 className="h-6 w-6" /> 2. Spray only when all are true
                  </p>
                  <div className="space-y-4 text-base font-medium leading-7 text-slate-700">
                    <p><strong className="text-slate-950">Pest confirmed:</strong> Check nearby plants—not only this photo.</p>
                    <p><strong className="text-slate-950">Action threshold reached:</strong> Recount and act only if numbers are rising or local guidance recommends treatment.</p>
                    <p><strong className="text-slate-950">Weather safe:</strong> No expected rain and no strong wind during application.</p>
                  </div>
                </section>

                <section className="rounded-2xl border border-blue-100 bg-blue-50/50 p-6">
                  <p className="text-sm font-extrabold uppercase tracking-wider text-blue-700">3. If spraying is necessary</p>
                  <p className="mt-2 text-xl font-extrabold leading-7 text-slate-950">{result.advice.pesticide.product}</p>
                  <p className="mt-2 text-base text-slate-600">{result.advice.pesticide.type}</p>
                  <Separator className="my-5" />
                  <div className="space-y-4 text-base leading-7">
                    <p><strong className="text-slate-950">Where to apply:</strong> <span className="text-slate-700">{result.advice.pesticide.application}</span></p>
                    <p><strong className="text-slate-950">How much:</strong> <span className="text-slate-700">{result.advice.pesticide.labelRate}</span></p>
                    <p><strong className="text-slate-950">When to recheck:</strong> <span className="text-slate-700">{result.advice.pesticide.interval}</span></p>
                  </div>
                </section>
              </div>

              <div className="rounded-2xl bg-slate-900 p-6 text-base leading-7 text-white">
                <strong className="text-lg">Safety:</strong> {result.advice.pesticide.safety} {result.advice.pesticide.resistanceNote} Pre-harvest interval: {result.advice.pesticide.preHarvestInterval}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <Card className="rounded-[2rem] border-green-100 shadow-sm">
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-2xl"><History className="text-green-700" /> Pest history &amp; follow-up</CardTitle>
              <CardDescription>Review real classifications over time and record whether crop damage is improving.</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-bold">
              <Badge variant="outline">{summary.active} active</Badge>
              <Badge variant="outline" className="border-red-200 text-red-700">{summary.increasing} increasing</Badge>
              <Badge variant="outline" className="border-amber-200 text-amber-800">{summary.followUpsDue} follow-ups due</Badge>
              <Button variant="ghost" size="sm" disabled={historyLoading} onClick={() => void refreshHistory()}>
                <RefreshCw className={`mr-2 h-4 w-4 ${historyLoading ? "animate-spin" : ""}`} /> Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">No pest observations saved yet. Confirm a result to begin the audit.</div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {history.slice(0, 8).map((record) => (
                <div key={record.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-extrabold text-slate-900">{record.pestName}</p>
                      <p className="text-xs italic text-slate-500">{record.scientificName}</p>
                    </div>
                    <Badge className={`${statusStyle[record.status]} capitalize shadow-none`}>{record.status}</Badge>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Badge variant="outline">Zone {record.zoneId}</Badge>
                    <Badge variant="outline">{record.crop}</Badge>
                    {record.confidence > MIN_CONFIDENCE_TO_SHOW && (
                      <Badge className={`${confidenceBandStyle[record.confidenceBand].badge} shadow-none`}>
                        {formatConfidence(record.confidence)} confidence
                      </Badge>
                    )}
                  </div>
                  <div className="mt-4 rounded-xl bg-slate-50 p-3 text-center">
                    <p className="text-sm font-bold text-slate-800">{formatDate(record.timestamp)}</p>
                    <p className="text-[10px] font-bold uppercase text-slate-500">checked</p>
                  </div>
                  <p className="mt-4 text-xs font-bold text-slate-600">Follow-up: what do you see now?</p>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {([
                      ["Improving", "improving"],
                      ["Same", "monitoring"],
                      ["Increasing", "increasing"],
                      ["Resolved", "resolved"],
                    ] as [string, PestStatus][]).map(([label, value]) => (
                      <Button key={value} variant="outline" size="sm" className="h-9 rounded-lg px-2 text-xs" onClick={() => void updateOutcome(record.id, value)}>{label}</Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
