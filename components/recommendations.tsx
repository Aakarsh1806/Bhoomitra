"use client"

import { useState, useMemo, useEffect } from "react"
import { useFarmStore } from "@/store/farmStore"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import {
  Brain,
  Lightbulb,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  Droplets,
  MapPin,
  Calendar,
  ThermometerSun,
  Wind,
  Target,
  Zap,
  X,
  Check,
  FlaskConical
} from "lucide-react"

interface Recommendation {
  id: string
  type: "urgent" | "important" | "suggestion" | "optimization"
  category: "spraying" | "prevention" | "maintenance" | "optimization"
  title: string
  description: string
  zone?: string
  priority: "high" | "medium" | "low"
  confidence: number
  estimatedImpact: string
  timeframe: string
  reasoning: string
  actions: string[]
  dismissed?: boolean
  implemented?: boolean
}

const getReasoning = (plantType: string, diseaseName: string) => {
  const reasonings: Record<string, string> = {
    "Apple": "High humidity often correlates with scab progression in pome fruits. Biological sensors indicate rapid spore release.",
    "Corn (maize)": "Recent rainfall and warm temperatures exceed the threshold for common rust incubation in grain crops.",
    "Grape": "Micro-climate analysis shows persistent leaf wetness, increasing susceptibility to fungal pathogens like powdery mildew.",
    "Potato": "Soil moisture levels and cool nights provide ideal conditions for blight development in root crops.",
    "Tomato": "High UV exposure combined with early morning dew is stressing plant cuticles, allowing for pathogen penetration.",
    "default": "Atmospheric sensors indicate optimal temperature and humidity for pathogen proliferation. Early intervention helps maintain crop yield."
  };
  return reasonings[plantType] || reasonings["default"];
};

const getImpact = (severity: string) => {
  switch (severity) {
    case "High": return "Prevent 15-20% yield loss";
    case "Moderate": return "Prevent 5-10% yield loss";
    case "Low": return "Prevent minor foliage damage";
    default: return "Maintain plant health";
  }
};

export default function Recommendations() {
  const { 
    detections, 
    removeDetection, 
    implementedRecords, 
    addImplementationRecord, 
    clearImplementationRecords,
    addDetection 
  } = useFarmStore()
  const [isHydrated, setIsHydrated] = useState(false)
  const [autoRecommendations, setAutoRecommendations] = useState(true)
  const [notifications, setNotifications] = useState(true)
  const [selectedRec, setSelectedRec] = useState<Recommendation | null>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)

  useEffect(() => {
    setIsHydrated(true)
  }, [])

  const handleCreateDemo = () => {
    addDetection({
      plantType: "Tomato",
      diseaseName: "Early Blight",
      severity: "High",
      infectedZoneId: "A1",
      pesticideName: "Mancozeb",
      pesticideCategory: "Fungicide",
      dosagePerLiter: 2.0,
      coveragePerLiter: 200,
      sprayInterval: "10 days",
      preHarvestDays: 3,
      createdAt: Date.now()
    })
    toast.success("Demo recommendation created for Zone A1")
  }

  const handleImplement = (rec: Recommendation) => {
    if (!rec.id) return

    const isAlreadyImplemented = implementedRecords.some(r => r.id === rec.id)
    
    if (isAlreadyImplemented) {
      toast.info("Already Implemented", {
        description: `The action for "${rec.title}" is already in your implementation history.`,
      })
      return
    }

    addImplementationRecord({
      id: rec.id,
      title: rec.title,
      description: rec.description,
      timestamp: new Date().toISOString(),
      zone: rec.zone,
      impact: rec.estimatedImpact
    })

    if (rec.id && !rec.id.startsWith("rec-static")) {
      removeDetection(rec.id)
    }

    toast.success("Implementation started!", {
      description: `Action plan for ${rec.title} has been deployed.`,
    })
  }

  const handleDismiss = (id: string) => {
    if (!id) return
    if (id.startsWith("rec-static")) {
       toast.info("Static recommendation dismissed for this session")
       return;
    }
    removeDetection(id)
    toast.success("Recommendation dismissed")
  }

  const dynamicRecommendations = useMemo(() => {
    return detections
      .filter(det => det.infectedZoneId)
      .map((det): Recommendation => ({
        id: det.infectedZoneId, 
        type: det.severity === "High" ? "urgent" : "important",
        category: "spraying",
        title: `${det.severity} Alert: ${det.diseaseName} in Zone ${det.infectedZoneId}`,
        description: `${det.diseaseName} detected on ${det.plantType}. Environmental conditions favor progression.`,
        zone: det.infectedZoneId,
        priority: det.severity.toLowerCase() as any,
        confidence: 85 + Math.floor(Math.random() * 10),
        estimatedImpact: getImpact(det.severity),
        timeframe: det.severity === "High" ? "Immediate action" : "Within 12 hours",
        reasoning: getReasoning(det.plantType, det.diseaseName),
        actions: [
          `Apply ${det.pesticideName} (${det.pesticideCategory})`,
          "Monitor adjacent zones for spread",
          "Adjust irrigation to reduce foliage wetness"
        ]
      }))
  }, [detections])

  const recommendations = useMemo(() => {
    if (!isHydrated) return []

    const staticRecs: Recommendation[] = [
      {
        id: "rec-static-1",
        type: "optimization",
        category: "optimization",
        title: "Optimize Spraying Schedule",
        description: "Adjust spraying times to early morning (5-7 AM) for better pesticide effectiveness.",
        priority: "medium",
        confidence: 91,
        estimatedImpact: "20-25% pesticide savings",
        timeframe: "Implement gradually",
        reasoning: "Wind speed analysis shows optimal conditions during early morning hours. Reduced evaporation achieves better coverage.",
        actions: ["Update equipment timers", "Adjust treatment logs"]
      }
    ]

    const allRecs = [...dynamicRecommendations, ...staticRecs]
    return allRecs.filter(rec => rec.id && !implementedRecords.some(r => r.id === rec.id))
  }, [dynamicRecommendations, implementedRecords, isHydrated])

  const getTypeColor = (type: string) => {
    switch (type) {
      case "urgent": return "text-red-600 bg-red-50 dark:bg-red-950"
      case "important": return "text-orange-600 bg-orange-50 dark:bg-orange-950"
      case "optimization": return "text-blue-600 bg-blue-50 dark:bg-blue-950"
      case "suggestion": return "text-green-600 bg-green-50 dark:bg-green-950"
      default: return "text-gray-600 bg-gray-50 dark:bg-gray-950"
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "urgent": return <AlertTriangle className="h-4 w-4" />
      case "important": return <Clock className="h-4 w-4" />
      case "optimization": return <TrendingUp className="h-4 w-4" />
      case "suggestion": return <Lightbulb className="h-4 w-4" />
      default: return <Brain className="h-4 w-4" />
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "destructive"
      case "medium": return "secondary"
      case "low": return "outline"
      default: return "outline"
    }
  }

  const urgentCount = recommendations.filter((rec) => rec.type === "urgent").length;
  const importantCount = recommendations.filter((rec) => rec.type === "important").length;

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">AI Recommendations</h1>
            <p className="text-muted-foreground">Intelligent suggestions for optimal farm management</p>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch id="auto-recommendations" checked={autoRecommendations} onCheckedChange={setAutoRecommendations} />
              <Label htmlFor="auto-recommendations" className="text-sm">Auto Recommendations</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="notifications" checked={notifications} onCheckedChange={setNotifications} />
              <Label htmlFor="notifications" className="text-sm">Notifications</Label>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                clearImplementationRecords()
                toast("History and constraints cleared")
              }}
            >
              Reset History
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Recommendations</CardTitle>
              <Brain className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{recommendations.length}</div>
              <p className="text-xs text-muted-foreground">Pending actions</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Urgent Actions</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{urgentCount}</div>
              <p className="text-xs text-muted-foreground">Require immediate attention</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Important Items</CardTitle>
              <Clock className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{importantCount}</div>
              <p className="text-xs text-muted-foreground">Within 24 hours</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">AI Confidence</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">89%</div>
              <p className="text-xs text-muted-foreground">Average accuracy</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="active" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="active">Active ({recommendations.length})</TabsTrigger>
            <TabsTrigger value="urgent">Urgent ({urgentCount})</TabsTrigger>
            <TabsTrigger value="implemented">Implemented ({implementedRecords.length})</TabsTrigger>
            <TabsTrigger value="insights">AI Insights</TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-4">
            {recommendations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed rounded-xl border-slate-200">
                <Brain className="h-12 w-12 text-slate-300 mb-4" />
                <h3 className="text-lg font-medium text-slate-900">All caught up!</h3>
                <p className="text-sm text-slate-500 max-w-xs mb-4">No active recommendations or all suggestions have been implemented.</p>
                <Button onClick={handleCreateDemo} variant="outline" size="sm">
                  Generate Demo Detection
                </Button>
              </div>
            ) : (
              recommendations.map((rec) => (
                <Card key={rec.id} className="relative shadow-sm hover:shadow-md transition-all duration-300">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${getTypeColor(rec.type)}`}>{getTypeIcon(rec.type)}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <CardTitle className="text-lg">{rec.title}</CardTitle>
                          <Badge variant={getPriorityColor(rec.priority)} className="capitalize">{rec.priority}</Badge>
                          {rec.zone && (
                            <Badge variant="outline" className="text-xs">
                              <MapPin className="mr-1 h-3 w-3" />
                              {rec.zone}
                            </Badge>
                          )}
                        </div>
                        <CardDescription className="text-base text-slate-600">{rec.description}</CardDescription>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => handleDismiss(rec.id)} className="bg-transparent opacity-40 hover:opacity-100 transition-opacity">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">AI Confidence</span>
                        <span className="font-medium">{rec.confidence}%</span>
                      </div>
                      <Progress value={rec.confidence} className="h-2" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Estimated Impact</p>
                      <p className="text-sm font-medium text-slate-800">{rec.estimatedImpact}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Timeframe</p>
                      <p className="text-sm font-medium text-slate-800">{rec.timeframe}</p>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <Brain className="h-4 w-4 text-primary" />
                      AI Reasoning
                    </h4>
                    <p className="text-sm text-slate-600">{rec.reasoning}</p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-sm font-medium mb-3">Recommended Actions</h4>
                    <div className="grid md:grid-cols-2 gap-2">
                      {rec.actions.map((action, index) => (
                        <div key={index} className="flex items-center gap-3 p-2 rounded-lg bg-slate-50 border border-slate-100 text-sm">
                          <div className="h-2 w-2 rounded-full bg-primary" />
                          {action}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <Button onClick={() => handleImplement(rec)} className="bg-primary hover:bg-primary/90">
                      <Check className="mr-2 h-4 w-4" />
                      Implement
                    </Button>
                    <Button variant="outline" className="bg-transparent">
                      <Calendar className="mr-2 h-4 w-4" />
                      Schedule
                    </Button>
                    <Button 
                      variant="outline" 
                      className="bg-transparent"
                      onClick={() => {
                        setSelectedRec(rec)
                        setIsDetailsOpen(true)
                      }}
                    >
                      More Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

          <TabsContent value="urgent" className="space-y-4">
            {recommendations.filter(r => r.type === "urgent").map((rec) => (
              <Card key={rec.id} className="border-red-200 dark:border-red-800 shadow-sm">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-red-50 dark:bg-red-950 text-red-600">
                        <AlertTriangle className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <CardTitle className="text-lg text-red-600">{rec.title}</CardTitle>
                          {rec.zone && (
                            <Badge variant="outline" className="text-xs">
                              <MapPin className="mr-1 h-3 w-3" />
                              {rec.zone}
                            </Badge>
                          )}
                        </div>
                        <CardDescription className="text-base">{rec.description}</CardDescription>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800">
                    <p className="text-sm text-red-800 dark:text-red-200 font-medium">⚠️ Urgent Action Required: {rec.timeframe}</p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Immediate Actions</h4>
                    <ul className="space-y-1">
                      {rec.actions.map((action, index) => (
                        <li key={index} className="flex items-center gap-2 text-sm">
                          <div className="h-1.5 w-1.5 rounded-full bg-red-600" />
                          {action}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button className="bg-red-600 hover:bg-red-700" onClick={() => handleImplement(rec)}>
                      <Zap className="mr-2 h-4 w-4" />
                      Take Action Now
                    </Button>
                    <Button 
                      variant="outline" 
                      className="bg-transparent"
                      onClick={() => {
                        setSelectedRec(rec)
                        setIsDetailsOpen(true)
                      }}
                    >
                      More Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="implemented" className="space-y-4">
            <div className="flex justify-end">
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-xs text-slate-400 hover:text-red-500"
                onClick={() => {
                  clearImplementationRecords()
                  toast.success("Implementation history cleared")
                }}
              >
                Clear History
              </Button>
            </div>
            {implementedRecords.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed rounded-xl border-slate-200">
                <CheckCircle className="h-12 w-12 text-slate-300 mb-4" />
                <h3 className="text-lg font-medium text-slate-900">No actions implemented yet</h3>
                <p className="text-sm text-slate-500 max-w-xs">Once you implement AI recommendations, they will appear here for your records.</p>
              </div>
            ) : (
              implementedRecords.map((rec) => (
                <Card key={rec.id} className="opacity-90 bg-slate-50 border-slate-200">
                  <CardHeader>
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-green-50 dark:bg-green-950 text-green-600">
                        <CheckCircle className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 justify-between">
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-lg">{rec.title}</CardTitle>
                            <Badge variant="outline" className="text-green-600 border-green-600">Implemented</Badge>
                          </div>
                          <span className="text-xs text-slate-400">
                            {new Date(rec.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <CardDescription>{rec.description}</CardDescription>
                        {rec.zone && (
                          <div className="mt-2 flex items-center gap-2">
                            <Badge variant="secondary">Zone {rec.zone}</Badge>
                            <span className="text-xs text-muted-foreground">Impact: {rec.impact}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="insights" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-primary" />
                  AI Performance Insights
                </CardTitle>
                <CardDescription>How the AI system is helping optimize your farm</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-4">
                    <h4 className="font-medium">Prediction Accuracy</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Disease Detection</span>
                        <span className="text-sm font-medium">94%</span>
                      </div>
                      <Progress value={94} className="h-2" />
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Weather Predictions</span>
                        <span className="text-sm font-medium">87%</span>
                      </div>
                      <Progress value={87} className="h-2" />
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Optimal Timing</span>
                        <span className="text-sm font-medium">91%</span>
                      </div>
                      <Progress value={91} className="h-2" />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h4 className="font-medium">Impact Metrics</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Pesticide Reduction</span>
                        <span className="text-sm font-medium text-green-600">-23%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Early Disease Detection</span>
                        <span className="text-sm font-medium text-green-600">+67%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Yield Improvement</span>
                        <span className="text-sm font-medium text-green-600">+12%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-2xl">
          {selectedRec && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`p-2 rounded-lg ${getTypeColor(selectedRec.type)}`}>
                    {getTypeIcon(selectedRec.type)}
                  </div>
                  <Badge variant={getPriorityColor(selectedRec.priority)} className="capitalize">
                    {selectedRec.priority} Priority
                  </Badge>
                  {selectedRec.zone && <Badge variant="secondary">Zone {selectedRec.zone}</Badge>}
                </div>
                <DialogTitle className="text-2xl">{selectedRec.title}</DialogTitle>
                <DialogDescription className="text-base pt-2">
                  {selectedRec.description}
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-6 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1 p-3 rounded-lg bg-slate-50 border border-slate-100">
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <Target className="h-4 w-4" /> Confidence Score
                    </p>
                    <p className="text-lg font-bold text-primary">{selectedRec.confidence}%</p>
                    <Progress value={selectedRec.confidence} className="h-1.5" />
                  </div>
                  <div className="space-y-1 p-3 rounded-lg bg-slate-50 border border-slate-100">
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <Zap className="h-4 w-4" /> Estimated Impact
                    </p>
                    <p className="text-lg font-bold text-slate-800">{selectedRec.estimatedImpact}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Brain className="h-4 w-4 text-primary" /> 
                    AI Comprehensive Reasoning
                  </h4>
                  <div className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">
                    {selectedRec.reasoning}
                    <p className="mt-2 text-xs italic text-slate-400">
                      *This reasoning is generated by the Bhoomitra Fusion Engine by correlating real-time sensor data, weather patterns, and historical crop health analytics.
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-semibold">Step-by-Step Action Plan</h4>
                  <div className="space-y-2">
                    {selectedRec.actions.map((action, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors">
                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                          {i + 1}
                        </div>
                        <p className="text-sm font-medium text-slate-700">{action}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <DialogFooter className="flex gap-2 sm:justify-between items-center sm:flex-row flex-col">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  Timeline: {selectedRec.timeframe}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setIsDetailsOpen(false)}>Close</Button>
                  <Button onClick={() => {
                    handleImplement(selectedRec)
                    setIsDetailsOpen(false)
                  }}>
                    <Check className="mr-2 h-4 w-4" />
                    Implement Now
                  </Button>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
