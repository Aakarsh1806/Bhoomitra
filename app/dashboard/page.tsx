"use client"

import Link from "next/link"
import { useFarmStore } from "@/store/farmStore"
import { useTranslation } from "@/lib/use-translation"
import WeatherStrip from "@/components/weather-strip"
import { 
  Activity, 
  AlertCircle, 
  CheckCircle2, 
  CloudRain, 
  LayoutDashboard, 
  Map as MapIcon, 
  TrendingUp,
  Zap,
  Droplets
} from "lucide-react"

export default function DashboardHome() {
  const { detections, activities, sensorData } = useFarmStore()
  const t = useTranslation()
  
  const activeDetectionsCount = detections?.length || 0
  const totalSprayLiters = activities?.reduce((acc, curr) => acc + (curr.totalLiters || 0), 0) || 0

  // 🛰️ Real-time average moisture from all active sensors
  const sensors = Object.values(sensorData);
  const avgMoisture = sensors.length > 0 
    ? Math.round(sensors.reduce((acc, s) => acc + s.soilMoisture, 0) / sensors.length)
    : 42; // Fallback value

  return (
    <div className="space-y-12 animate-in fade-in duration-700">

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-extrabold text-[#1a2e1d] flex items-center gap-3">
            <LayoutDashboard className="text-green-600 h-9 w-9" />
            {t("dashboard.title", "Dashboard Overview")}
          </h1>
          <p className="text-[#4a634f] mt-2 text-lg font-medium">
            {t("dashboard.subtitle", "Smart Monitoring & Precision Agriculture Control Center")}
          </p>
        </div>
        <div className="bg-green-100 text-green-800 px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 border border-green-200">
          <Zap className="h-4 w-4 fill-current" />
          AI System Online
        </div>
      </div>

      {/* Live weather + agronomic signals for the saved farm location */}
      <WeatherStrip />

      <div className="grid md:grid-cols-4 gap-6">

        <div className="bg-white p-7 rounded-3xl border border-green-100 shadow-sm hover:shadow-md transition-all group overflow-hidden relative">
          <div className="absolute top-0 right-0 w-24 h-24 bg-red-50 rounded-bl-full -mr-8 -mt-8 opacity-50 group-hover:scale-110 transition-transform"></div>
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-semibold text-[#5a7a60] uppercase tracking-wider">{t("dashboard.activeDetections", "Active Detections")}</h3>
              <p className="text-4xl font-black text-[#1e3a23] mt-3">{activeDetectionsCount}</p>
            </div>
            <div className="bg-red-100 p-3 rounded-2xl text-red-600">
              <AlertCircle className="h-6 w-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-xs text-red-600 font-bold">
            <TrendingUp className="h-3 w-3 mr-1" />
            {t("dashboard.needsAttention", "Needs Attention")}
          </div>
        </div>

        <div className="bg-white p-7 rounded-3xl border border-green-100 shadow-sm hover:shadow-md transition-all group overflow-hidden relative">
          <div className="absolute top-0 right-0 w-24 h-24 bg-green-50 rounded-bl-full -mr-8 -mt-8 opacity-50 group-hover:scale-110 transition-transform"></div>
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-semibold text-[#5a7a60] uppercase tracking-wider">{t("dashboard.monitoredZones", "Monitored Zones")}</h3>
              <p className="text-4xl font-black text-[#1e3a23] mt-3">24</p>
            </div>
            <div className="bg-green-100 p-3 rounded-2xl text-green-600">
              <MapIcon className="h-6 w-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-xs text-green-600 font-bold">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            {t("dashboard.fullCoverage", "Full Coverage")}
          </div>
        </div>

        <div className="bg-white p-7 rounded-3xl border border-green-100 shadow-sm hover:shadow-md transition-all group overflow-hidden relative">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-bl-full -mr-8 -mt-8 opacity-50 group-hover:scale-110 transition-transform"></div>
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-semibold text-[#5a7a60] uppercase tracking-wider">{t("dashboard.totalSpraying", "Total Spraying")}</h3>
              <p className="text-4xl font-black text-[#1e3a23] mt-3">{totalSprayLiters}L</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-2xl text-blue-600">
              <CloudRain className="h-6 w-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-xs text-blue-600 font-bold">
            <Activity className="h-3 w-3 mr-1" />
            {t("dashboard.seasonToDate", "Season to date")}
          </div>
        </div>

        <div className="bg-white p-7 rounded-3xl border border-green-100 shadow-sm hover:shadow-md transition-all group overflow-hidden relative">
          <div className="absolute top-0 right-0 w-24 h-24 bg-yellow-50 rounded-bl-full -mr-8 -mt-8 opacity-50 group-hover:scale-110 transition-transform"></div>
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-semibold text-[#5a7a60] uppercase tracking-wider">{t("dashboard.avgSoilMoisture", "Avg. Soil Moisture")}</h3>
              <p className="text-4xl font-black text-[#1e3a23] mt-3">{avgMoisture}%</p>
            </div>
            <div className="bg-yellow-100 p-3 rounded-2xl text-yellow-600">
              <Droplets className="h-6 w-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-xs text-yellow-600 font-bold">
            <Activity className="h-3 w-3 mr-1" />
            {t("dashboard.liveTelemetry", "Live Telemetry")}
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        
        <div className="bg-slate-50 rounded-[2.5rem] p-9 border border-slate-100 shadow-inner">
          <h2 className="text-2xl font-bold text-slate-800 mb-8 flex items-center gap-3">
            <Activity className="text-green-600 h-6 w-6" />
            {t("dashboard.systemActivityLog", "System Activity Log")}
          </h2>
          <div className="space-y-5">
            {activities && activities.length > 0 ? (
              activities.slice(0, 3).map((act, i) => (
                <div key={i} className="bg-white p-5 rounded-[1.5rem] flex items-center justify-between border border-slate-50 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-5">
                    <div className="h-12 w-12 bg-green-50 rounded-2xl flex items-center justify-center text-green-600">
                      <CloudRain className="h-6 w-6" />
                    </div>
                    <div>
                        <p className="font-extrabold text-slate-700">{act.pesticideName || t("dashboard.pesticide", "Pesticide")} {t("dashboard.application", "Application")}</p>
                        <p className="text-xs text-slate-400 font-medium">{new Date(act.timestamp).toLocaleString()}</p>
                    </div>
                  </div>
                  <span className="text-xs font-black bg-green-100 text-green-700 px-4 py-1.5 rounded-full uppercase tracking-wider">
                    {t("dashboard.completed", "Completed")}
                  </span>
                </div>
              ))
            ) : (
                <div className="bg-white p-8 rounded-[1.5rem] text-center text-slate-400 font-semibold border-2 border-dashed border-slate-100">
                    {t("dashboard.noActivities", "No recent spray activities recorded.")}
                </div>
            )}
          </div>
        </div>

        <div className="bg-green-900 rounded-[2.5rem] p-9 text-white relative overflow-hidden shadow-2xl">
           <div className="absolute bottom-0 right-0 opacity-10">
             <LayoutDashboard className="h-80 w-80 -mb-20 -mr-20" />
           </div>
           <h2 className="text-2xl font-bold mb-8 flex items-center gap-3">
             <Zap className="text-yellow-400 h-6 w-6 fill-current" />
             {t("dashboard.recommendationsTitle", "AI Field Recommendations")}
           </h2>
           <div className="space-y-8 relative z-10">
             {detections && detections.length > 0 ? (
               <div className="p-7 bg-white/10 backdrop-blur-xl rounded-[1.5rem] border border-white/20 shadow-xl">
                 <p className="text-xs font-black text-green-300 uppercase tracking-[0.2em] mb-3">{t("dashboard.criticalIntervention", "Critical Intervention Required")}</p>
                 <p className="text-2xl font-black">{t("dashboard.treat", "Treat")} {detections[0].diseaseName}</p>
                 <p className="text-lg font-medium text-green-100/90 mt-1">{t("dashboard.zone", "Zone")} {detections[0].infectedZoneId}</p>
                 <p className="text-sm text-green-50/70 mt-4 leading-relaxed">
                   {t("dashboard.aiSuggestion", "AI models suggest immediate application of")} {detections[0].pesticideName} {t("dashboard.preventSprawl", "to prevent 35% sprawl in adjacent zones.")}
                 </p>
               </div>
             ) : (
                <div className="p-7 bg-white/10 backdrop-blur-xl rounded-[1.5rem] border border-white/20">
                    <p className="text-xl font-bold italic opacity-90">{t("dashboard.allSystemsOptimal", "All systems optimal.")}</p>
                    <p className="text-sm text-green-50/70 mt-3 leading-relaxed">
                      {t("dashboard.noDiseases", "No diseases detected in current scans. Keep up the preventive maintenance!")}
                    </p>
                </div>
             )}
             <div className="flex gap-5">
               <Link 
                 href="/dashboard/map" 
                 className="flex-1 bg-white text-green-900 py-4 rounded-2xl font-black hover:bg-green-50 transition-all active:scale-95 shadow-lg text-center"
               >
                 View Map
               </Link>
               <Link 
                 href="/dashboard/recommendations" 
                 className="flex-1 bg-green-700 text-white py-4 rounded-2xl font-black hover:bg-green-600 transition-all active:scale-95 border border-green-600 shadow-lg text-center"
               >
                 Full Report
               </Link>
             </div>
           </div>
        </div>

      </div>

    </div>
  )
}
