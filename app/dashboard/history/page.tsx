"use client"

import { useEffect, useState } from "react"
import { History, Clock, Activity, MapPin, Droplets, SprayCan } from "lucide-react"

export default function HistoryPage() {
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    fetch("/api/history")
      .then(res => res.json())
      .then(setData)
  }, [])

  if (!data) return <div className="p-10 text-center"><p className="text-xl">Loading comprehensive activity logs...</p></div>

  const { history = [] } = data

  return (
    <div className="space-y-8 p-4">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-green-100 rounded-2xl text-green-700">
          <History size={28} />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Activity Log</h1>
          <p className="text-slate-500">Real-time hardware feed and historical event records</p>
        </div>
      </div>

      <div className="grid gap-4 mt-8">
        {history.length > 0 ? (
          history.map((entry: any, i: number) => (
            <div 
              key={i} 
              className="flex items-start gap-4 p-5 rounded-2xl border bg-white shadow-sm hover:shadow-md transition-shadow duration-200"
            >
              <div className={`p-2 rounded-xl border ${
                entry.type === "spray" 
                  ? "bg-green-50 text-green-600 border-green-100" 
                  : entry.type === "water" 
                    ? "bg-blue-50 text-blue-600 border-blue-100" 
                    : "bg-slate-50 text-slate-600 border-slate-100"
              }`}>
                {entry.type === "spray" ? <SprayCan size={20} /> : entry.type === "water" ? <Droplets size={20} /> : <Activity size={20} />}
              </div>
              
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-slate-800 capitalize">
                      {entry.type === "water" ? "Pulsed Water Pump" : entry.type === "spray" ? "Activated Pesticide Sprayer" : entry.type}
                    </h3>
                    <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
                      <div className="flex items-center gap-1">
                        <MapPin size={14} />
                        <span>Zone {entry.zoneId}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock size={14} />
                        <span>{new Date(entry.timestamp).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className={`text-xs font-black px-2 py-1 rounded-full uppercase ${
                    entry.status === "completed" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                  }`}>
                    {entry.status || "logged"}
                  </div>
                </div>
                
                {entry.details && (
                  <p className="mt-3 text-sm text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100 italic">
                    {entry.details}
                  </p>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-20 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200">
            <Activity className="h-16 w-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 font-medium">No recent activity detected in the history log.</p>
          </div>
        )}
      </div>
    </div>
  )
}
