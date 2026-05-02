"use client"

import { useState, useEffect } from "react"
import { useAutomation } from "@/lib/automation-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Sprout,
  Play,
  Pause,
  Square,
  Settings,
  Clock,
  Droplets,
  AlertTriangle,
  CheckCircle,
  Calendar,
  Timer,
  Zap,
  BarChart3,
  MapPin,
} from "lucide-react"

interface SprayingSession {
  id: string
  zone: string
  status: "active" | "scheduled" | "completed" | "paused"
  startTime: string
  duration: number
  dosage: number
  pesticideType: string
  progress: number
}

export default function SprayingControls() {
  const { zones: globalZones, isAutoMode, setAutoMode, activities } = useAutomation()
  const [globalDosage, setGlobalDosage] = useState([75])
  const [selectedZones, setSelectedZones] = useState<string[]>([])
  const [pesticideLevel, setPesticideLevel] = useState(68)

  // Mock data for active spraying sessions
  const [sprayingSessions, setSprayingSessions] = useState<SprayingSession[]>([
    {
      id: "session-1",
      zone: "A3",
      status: "active",
      startTime: "14:30",
      duration: 15,
      dosage: 80,
      pesticideType: "Fungicide",
      progress: 65,
    },
    {
      id: "session-2",
      zone: "B5",
      status: "scheduled",
      startTime: "15:00",
      duration: 12,
      dosage: 70,
      pesticideType: "Insecticide",
      progress: 0,
    },
  ])

  const zones = [
    "A1",
    "A2",
    "A3",
    "A4",
    "A5",
    "A6",
    "B1",
    "B2",
    "B3",
    "B4",
    "B5",
    "B6",
    "C1",
    "C2",
    "C3",
    "C4",
    "C5",
    "C6",
    "D1",
    "D2",
    "D3",
    "D4",
    "D5",
    "D6",
  ]
  const pesticideTypes = ["Fungicide", "Insecticide", "Herbicide", "Bactericide", "Nematicide"]

  const handleZoneToggle = (zone: string) => {
    setSelectedZones((prev) => (prev.includes(zone) ? prev.filter((z) => z !== zone) : [...prev, zone]))
  }

  const handleStartSpraying = () => {
    if (selectedZones.length === 0) return

    const newSessions = selectedZones.map((zone) => ({
      id: `session-${Date.now()}-${zone}`,
      zone,
      status: "active" as const,
      startTime: new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" }),
      duration: 15,
      dosage: globalDosage[0],
      pesticideType: "Fungicide",
      progress: 0,
    }))

    setSprayingSessions((prev) => [...prev, ...newSessions])
    setSelectedZones([])
  }

  const handlePauseSession = (sessionId: string) => {
    setSprayingSessions((prev) =>
      prev.map((session) =>
        session.id === sessionId ? { ...session, status: session.status === "active" ? "paused" : "active" } : session,
      ),
    )
  }

  const handleStopSession = (sessionId: string) => {
    setSprayingSessions((prev) =>
      prev.map((session) => (session.id === sessionId ? { ...session, status: "completed", progress: 100 } : session)),
    )
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "text-green-600"
      case "paused":
        return "text-yellow-600"
      case "scheduled":
        return "text-blue-600"
      case "completed":
        return "text-gray-600"
      default:
        return "text-gray-600"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <Play className="h-4 w-4 text-green-600" />
      case "paused":
        return <Pause className="h-4 w-4 text-yellow-600" />
      case "scheduled":
        return <Clock className="h-4 w-4 text-blue-600" />
      case "completed":
        return <CheckCircle className="h-4 w-4 text-gray-600" />
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Spraying Controls</h1>
            <p className="text-muted-foreground">Manage pesticide spraying operations and schedules</p>
          </div>

          {/* System Status */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm text-muted-foreground">System Online</span>
            </div>
            <div className="flex items-center gap-2">
              <Droplets className="h-4 w-4 text-blue-600" />
              <span className="text-sm">Pesticide: {pesticideLevel}%</span>
            </div>
          </div>
        </div>

        {/* Mode Toggle */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Zap className="h-5 w-5 text-primary" />
                <div>
                  <h3 className="font-medium">Operation Mode</h3>
                  <p className="text-sm text-muted-foreground">
                    {isAutoMode
                      ? "AI automatically manages spraying based on sensor data"
                      : "Manual control of all spraying operations"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Label htmlFor="auto-mode" className="text-sm">
                  Manual
                </Label>
                <Switch id="auto-mode" checked={isAutoMode} onCheckedChange={setAutoMode} />
                <Label htmlFor="auto-mode" className="text-sm">
                  Auto
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="manual" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="manual">Manual Control</TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="active">Active Sessions</TabsTrigger>
          </TabsList>

          {/* Manual Control Tab */}
          <TabsContent value="manual" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Zone Selection */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-primary" />
                    Zone Selection
                  </CardTitle>
                  <CardDescription>Select zones for manual spraying</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-6 gap-2">
                    {zones.map((zoneId) => (
                      <Button
                        key={zoneId}
                        variant={selectedZones.includes(zoneId) ? "secondary" : "outline"}
                        size="sm"
                        className={`h-10 border-2 ${globalZones[zoneId]?.color} ${selectedZones.includes(zoneId) ? "ring-2 ring-primary ring-offset-2" : ""}`}
                        onClick={() => handleZoneToggle(zoneId)}
                      >
                        {zoneId}
                      </Button>
                    ))}
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Selected: {selectedZones.length} zones</span>
                    <Button variant="outline" size="sm" onClick={() => setSelectedZones([])} className="bg-transparent">
                      Clear All
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Spray Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5 text-primary" />
                    Spray Settings
                  </CardTitle>
                  <CardDescription>Configure dosage and pesticide type</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Dosage Slider */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Dosage Level</Label>
                      <span className="text-sm font-medium">{globalDosage[0]}%</span>
                    </div>
                    <Slider
                      value={globalDosage}
                      onValueChange={setGlobalDosage}
                      max={100}
                      min={10}
                      step={5}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Light (10%)</span>
                      <span>Heavy (100%)</span>
                    </div>
                  </div>

                  {/* Pesticide Type */}
                  <div className="space-y-2">
                    <Label>Pesticide Type</Label>
                    <Select defaultValue="fungicide">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {pesticideTypes.map((type) => (
                          <SelectItem key={type.toLowerCase()} value={type.toLowerCase()}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Duration */}
                  <div className="space-y-2">
                    <Label>Duration (minutes)</Label>
                    <Input type="number" defaultValue="15" min="5" max="60" />
                  </div>

                  {/* Start Button */}
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={handleStartSpraying}
                    disabled={selectedZones.length === 0 || isAutoMode}
                  >
                    <Sprout className="mr-2 h-5 w-5" />
                    Start Spraying ({selectedZones.length} zones)
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Schedule Tab */}
          <TabsContent value="schedule" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Spraying Schedule
                </CardTitle>
                <CardDescription>Set up automated spraying schedules</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Zone</Label>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="Select zone" />
                        </SelectTrigger>
                        <SelectContent>
                          {zones.map((zone) => (
                            <SelectItem key={zone} value={zone}>
                              {zone}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Time</Label>
                      <Input type="time" defaultValue="06:00" />
                    </div>

                    <div className="space-y-2">
                      <Label>Frequency</Label>
                      <Select defaultValue="daily">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="biweekly">Bi-weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Pesticide Type</Label>
                      <Select defaultValue="fungicide">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {pesticideTypes.map((type) => (
                            <SelectItem key={type.toLowerCase()} value={type.toLowerCase()}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Dosage (%)</Label>
                      <Input type="number" defaultValue="75" min="10" max="100" />
                    </div>

                    <div className="space-y-2">
                      <Label>Duration (minutes)</Label>
                      <Input type="number" defaultValue="15" min="5" max="60" />
                    </div>
                  </div>
                </div>

                <Button className="w-full">
                  <Timer className="mr-2 h-4 w-4" />
                  Add to Schedule
                </Button>
              </CardContent>
            </Card>

            {/* Scheduled Sessions */}
            <Card>
              <CardHeader>
                <CardTitle>Upcoming Schedules</CardTitle>
                <CardDescription>Manage your scheduled spraying sessions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {sprayingSessions
                    .filter((s) => s.status === "scheduled")
                    .map((session) => (
                      <div key={session.id} className="flex items-center justify-between p-3 rounded-lg border">
                        <div className="flex items-center gap-3">
                          <Clock className="h-4 w-4 text-blue-600" />
                          <div>
                            <p className="font-medium">Zone {session.zone}</p>
                            <p className="text-sm text-muted-foreground">
                              {session.startTime} • {session.pesticideType} • {session.dosage}%
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" className="bg-transparent">
                            Edit
                          </Button>
                          <Button variant="outline" size="sm" className="bg-transparent">
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ))}
                  {sprayingSessions.filter((s) => s.status === "scheduled").length === 0 && (
                    <p className="text-center text-muted-foreground py-8">No scheduled sessions</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Active Sessions Tab */}
          <TabsContent value="active" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Active Spraying Sessions
                </CardTitle>
                <CardDescription>Monitor and control ongoing spraying operations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {sprayingSessions
                    .filter((s) => s.status === "active" || s.status === "paused")
                    .map((session) => (
                      <div key={session.id} className="p-4 rounded-lg border space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {getStatusIcon(session.status)}
                            <div>
                              <h4 className="font-medium">Zone {session.zone}</h4>
                              <p className="text-sm text-muted-foreground">
                                Started: {session.startTime} • {session.pesticideType} • {session.dosage}%
                              </p>
                            </div>
                          </div>
                          <Badge variant={session.status === "active" ? "default" : "secondary"} className="capitalize">
                            {session.status}
                          </Badge>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span>Progress</span>
                            <span>{session.progress}%</span>
                          </div>
                          <Progress value={session.progress} className="h-2" />
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>Duration: {session.duration} min</span>
                            <span>
                              Est. completion: {Math.round(((100 - session.progress) / 100) * session.duration)} min
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePauseSession(session.id)}
                            className="bg-transparent"
                          >
                            {session.status === "active" ? (
                              <>
                                <Pause className="mr-2 h-4 w-4" />
                                Pause
                              </>
                            ) : (
                              <>
                                <Play className="mr-2 h-4 w-4" />
                                Resume
                              </>
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleStopSession(session.id)}
                            className="bg-transparent"
                          >
                            <Square className="mr-2 h-4 w-4" />
                            Stop
                          </Button>
                        </div>
                      </div>
                    ))}

                  {sprayingSessions.filter((s) => s.status === "active" || s.status === "paused").length === 0 && (
                    <div className="text-center py-8">
                      <Sprout className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No active spraying sessions</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Pesticide Level Alert */}
            {pesticideLevel < 20 && (
              <Card className="border-destructive">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    <div>
                      <h4 className="font-medium text-destructive">Low Pesticide Level</h4>
                      <p className="text-sm text-muted-foreground">
                        Current level: {pesticideLevel}%. Refill recommended before starting new sessions.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Recent Automation Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Recent Automation Activity
            </CardTitle>
            <CardDescription>Automated spray actions triggered by AI detection</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activities.length > 0 ? (
                activities.map((activity) => (
                  <div key={activity.id} className="flex items-start justify-between p-4 rounded-lg border bg-muted/30">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                          Zone {activity.zoneId}
                        </Badge>
                        <span className="font-semibold text-sm">{activity.disease}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Treated with <span className="text-foreground font-medium">{activity.chemical}</span> at <span className="text-foreground font-medium">{activity.dosage}</span> dosage.
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">{activity.timestamp}</p>
                      <Badge variant="secondary" className="text-[10px] mt-1">Auto-Triggered</Badge>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  No recent automation activity
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
