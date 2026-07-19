"use client"

import { useMemo, useState } from "react"
import { Sprout, MapPinned, Grid3X3, Cpu, ArrowRight, ArrowLeft, CheckCircle2 } from "lucide-react"
import FarmLocationPicker from "@/components/farm-location-picker"
import type { FarmLocation } from "@/app/lib/farmLocation"

type BasicInfo = {
  farmerName: string
  village: string
  district: string
  acres: number
  primaryCrop: string
}

type Props = {
  onComplete: () => void
}

const crops = [
  "Paddy",
  "Cotton",
  "Maize",
  "Groundnut",
  "Chilli",
  "Sugarcane",
  "Tomato",
  "Millets",
  "Other",
]

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

function calculateZones(acres: number) {
  return Math.min(12 + Math.floor((acres - 2) * 2.4), 24)
}

export default function FarmerOnboarding({ onComplete }: Props) {
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const [basicInfo, setBasicInfo] = useState<BasicInfo>({
    farmerName: "",
    village: "",
    district: "",
    acres: 2,
    primaryCrop: "Paddy",
  })
  const [farmLocation, setFarmLocation] = useState<FarmLocation | null>(null)

  const zones = useMemo(() => calculateZones(basicInfo.acres), [basicInfo.acres])
  const zoneIds = useMemo(() => generateZoneIds(zones), [zones])

  const [zoneNames, setZoneNames] = useState<Record<string, string>>({})
  const [sensorAssignments, setSensorAssignments] = useState<Record<string, string>>({
    sensor1: "A1",
    sensor2: "A2",
    sensor3: "A3",
  })

  const zoneNameMap = useMemo(() => {
    const out: Record<string, string> = {}
    zoneIds.forEach((id) => {
      out[id] = zoneNames[id] || id
    })
    return out
  }, [zoneIds, zoneNames])

  const canContinueStep1 =
    basicInfo.farmerName.trim().length > 1 &&
    basicInfo.village.trim().length > 1 &&
    basicInfo.district.trim().length > 1 &&
    !!basicInfo.primaryCrop &&
    !!farmLocation

  const farmLocationLabel = [basicInfo.village.trim(), basicInfo.district.trim()]
    .filter(Boolean)
    .join(", ")

  const handleSave = async () => {
    setSaving(true)
    setError("")

    const payload = {
      farmerName: basicInfo.farmerName.trim(),
      village: basicInfo.village.trim(),
      district: basicInfo.district.trim(),
      acres: basicInfo.acres,
      totalFarmAreaAcres: basicInfo.acres,
      primaryCrop: basicInfo.primaryCrop,
      zones,
      zoneCount: zones,
      zoneNames: zoneNameMap,
      sensorAssignments,
      farmLocation,
    }

    try {
      const res = await fetch("/api/farmer-profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data?.message || "Failed to save onboarding")
        setSaving(false)
        return
      }

      onComplete()
    } catch (e) {
      setError("Network error while saving profile")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-lime-50 p-4 md:p-8">
      <div className="mx-auto max-w-4xl rounded-2xl border border-green-100 bg-white shadow-xl">
        <div className="border-b border-green-100 p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-green-100 p-2 text-green-700">
              <Sprout className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-green-900">Welcome to Bhoomitra</h1>
              <p className="text-sm text-green-700">Set up your farm in 4 quick steps</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-4 gap-2">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className={`h-2 rounded-full ${n <= step ? "bg-green-500" : "bg-green-100"}`} />
            ))}
          </div>
        </div>

        <div className="p-6 md:p-8">
          {step === 1 && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 text-green-800">
                <MapPinned className="h-4 w-4" />
                <h2 className="text-lg font-semibold">Step 1: Farmer Details</h2>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-sm text-slate-700">Farmer Name</span>
                  <input
                    className="w-full rounded-lg border border-slate-200 px-3 py-2"
                    value={basicInfo.farmerName}
                    onChange={(e) => setBasicInfo((s) => ({ ...s, farmerName: e.target.value }))}
                    placeholder="Enter farmer name"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-sm text-slate-700">Village</span>
                  <input
                    className="w-full rounded-lg border border-slate-200 px-3 py-2"
                    value={basicInfo.village}
                    onChange={(e) => setBasicInfo((s) => ({ ...s, village: e.target.value }))}
                    placeholder="Enter village"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-sm text-slate-700">District</span>
                  <input
                    className="w-full rounded-lg border border-slate-200 px-3 py-2"
                    value={basicInfo.district}
                    onChange={(e) => setBasicInfo((s) => ({ ...s, district: e.target.value }))}
                    placeholder="Enter district"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-sm text-slate-700">Primary Crop</span>
                  <select
                    className="w-full rounded-lg border border-slate-200 px-3 py-2"
                    value={basicInfo.primaryCrop}
                    onChange={(e) => setBasicInfo((s) => ({ ...s, primaryCrop: e.target.value }))}
                  >
                    {crops.map((crop) => (
                      <option key={crop} value={crop}>
                        {crop}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="rounded-xl border border-lime-200 bg-lime-50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-lime-900">Land Size (Acres)</p>
                    <p className="text-2xl font-bold text-lime-700">{basicInfo.acres} acres</p>
                  </div>
                </div>
                <input
                  type="range"
                  min={2}
                  max={10}
                  step={1}
                  value={basicInfo.acres}
                  onChange={(e) => setBasicInfo((s) => ({ ...s, acres: Number(e.target.value) }))}
                  className="mt-3 w-full"
                />
                <p className="mt-1 text-xs text-lime-700">Range: 2 to 10 acres</p>
              </div>

              <FarmLocationPicker
                value={farmLocation}
                onChange={setFarmLocation}
                fallbackLabel={farmLocationLabel}
              />
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 text-green-800">
                <Grid3X3 className="h-4 w-4" />
                <h2 className="text-lg font-semibold">Step 2: Zone Calculation</h2>
              </div>

              <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center">
                <p className="text-sm text-green-700">Using your land size formula</p>
                <p className="mt-2 text-2xl font-bold text-green-800">Your farm will have {zones} zones</p>
                <p className="mt-1 text-xs text-green-700">zones = min(12 + floor((acres - 2) * 2.4), 24)</p>
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <p className="mb-3 text-sm font-medium text-slate-700">Preview Grid</p>
                <div className="grid grid-cols-6 gap-2">
                  {zoneIds.map((id) => (
                    <div key={id} className="rounded-md border border-green-200 bg-green-50 px-2 py-1 text-center text-xs font-semibold text-green-700">
                      {id}
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-sm text-slate-600">Confirm this layout to continue.</p>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-green-800">Step 3: Rename Zones</h2>
              <p className="text-sm text-slate-600">Give farmer-friendly names like Near well, North corner, etc.</p>

              <div className="grid max-h-[380px] gap-3 overflow-auto rounded-xl border border-slate-200 p-4 md:grid-cols-2">
                {zoneIds.map((id) => (
                  <label key={id} className="space-y-1">
                    <span className="text-xs font-semibold text-slate-500">{id}</span>
                    <input
                      className="w-full rounded-lg border border-slate-200 px-3 py-2"
                      value={zoneNames[id] ?? ""}
                      onChange={(e) => setZoneNames((prev) => ({ ...prev, [id]: e.target.value }))}
                      placeholder={`Default: ${id}`}
                    />
                  </label>
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 text-green-800">
                <Cpu className="h-4 w-4" />
                <h2 className="text-lg font-semibold">Step 4: Sensor Assignment</h2>
              </div>

              <p className="text-sm text-slate-600">Assign each hardware sensor to the installed zone.</p>

              <div className="grid gap-4 md:grid-cols-3">
                {["sensor1", "sensor2", "sensor3"].map((sensor) => (
                  <label key={sensor} className="space-y-1">
                    <span className="text-sm font-medium capitalize text-slate-700">
                      Which zone is {sensor.replace("sensor", "Sensor ")} installed in?
                    </span>
                    <select
                      className="w-full rounded-lg border border-slate-200 px-3 py-2"
                      value={sensorAssignments[sensor] || zoneIds[0]}
                      onChange={(e) => setSensorAssignments((prev) => ({ ...prev, [sensor]: e.target.value }))}
                    >
                      {zoneIds.map((id) => (
                        <option key={id} value={id}>
                          {id} - {zoneNameMap[id]}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>

              <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
                <div className="mb-2 flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="h-4 w-4" /> Ready to save profile
                </div>
                <p>
                  Farmer: {basicInfo.farmerName} | {basicInfo.village}, {basicInfo.district} | {basicInfo.acres} acres | {zones} zones
                </p>
              </div>
            </div>
          )}

          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

          <div className="mt-8 flex items-center justify-between">
            <button
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm disabled:opacity-40"
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              disabled={step === 1 || saving}
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>

            {step < 4 ? (
              <button
                className="inline-flex items-center gap-2 rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                onClick={() => setStep((s) => Math.min(4, s + 1))}
                disabled={step === 1 ? !canContinueStep1 : false}
              >
                Continue <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                className="inline-flex items-center gap-2 rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Saving..." : "Finish Setup"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
