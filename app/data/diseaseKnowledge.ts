export type SeverityLevel = "low" | "moderate" | "high"

export interface DiseaseKnowledge {
  displayName: string
  pathogenType: "Fungal" | "Bacterial" | "Viral"
  scientificName: string

  severityThresholds: {
    low: number
    moderate: number
  }

  farmerGuidance: {
    immediateActions: string[]
    recommendedTreatment: string[]
    irrigationAdvice: string
    fertilizerAdvice: string
  }

  scientificInsights: {
    transmission: string
    environmentalTriggers: string
    impact: string
  }
}

export const diseaseKnowledge: Record<string, DiseaseKnowledge> = {
  "Squash___Powdery_mildew": {
    displayName: "Squash – Powdery Mildew",
    pathogenType: "Fungal",
    scientificName: "Podosphaera xanthii",

    severityThresholds: {
      low: 0.4,
      moderate: 0.7
    },

    farmerGuidance: {
      immediateActions: [
        "Remove infected leaves immediately",
        "Increase plant spacing for better airflow"
      ],
      recommendedTreatment: [
        "Apply sulfur-based fungicide",
        "Use potassium bicarbonate spray"
      ],
      irrigationAdvice: "Avoid overhead watering; prefer drip irrigation",
      fertilizerAdvice: "Reduce excess nitrogen fertilization"
    },

    scientificInsights: {
      transmission:
        "Spores spread through air currents and infected plant debris.",
      environmentalTriggers:
        "High humidity with moderate temperatures (15–27°C).",
      impact:
        "Can reduce yield by 20–40% if untreated."
    }
  },

  "Tomato___Late_blight": {
    displayName: "Tomato – Late Blight",
    pathogenType: "Fungal",
    scientificName: "Phytophthora infestans",
    severityThresholds: { low: 0.3, moderate: 0.6 },
    farmerGuidance: {
      immediateActions: ["Destroy infected plants immediately", "Improve drainage"],
      recommendedTreatment: ["Copper-based fungicides", "Trichoderma Viride (Organic)", "Wood Ash dusting (Organic)"],
      irrigationAdvice: "Switch to drip irrigation; keep leaves dry",
      fertilizerAdvice: "Avoid high nitrogen; use potash to strengthen cell walls"
    },
    scientificInsights: {
      transmission: "Wind-borne spores and water splash.",
      environmentalTriggers: "Cool, wet weather (15-20°C) with high humidity.",
      impact: "Can destroy entire crops within days if unchecked."
    }
  },

  "Tomato___Early_blight": {
    displayName: "Tomato – Early Blight",
    pathogenType: "Fungal",
    scientificName: "Alternaria solani",
    severityThresholds: { low: 0.4, moderate: 0.7 },
    farmerGuidance: {
      immediateActions: ["Prune lower leaves", "Mulch around base"],
      recommendedTreatment: ["Mancozeb", "Neem Oil Extract (Organic)", "Baking Soda solution (Organic)"],
      irrigationAdvice: "Water at the base early in the morning",
      fertilizerAdvice: "Ensure adequate calcium and magnesium"
    },
    scientificInsights: {
      transmission: "Soil-borne spores splashing onto lower leaves.",
      environmentalTriggers: "High humidity and warm temperatures (24-29°C).",
      impact: "Reduces fruit size and yield through defoliation."
    }
  },

  "Potato___Late_blight": {
    displayName: "Potato – Late Blight",
    pathogenType: "Fungal",
    scientificName: "Phytophthora infestans",
    severityThresholds: { low: 0.2, moderate: 0.5 },
    farmerGuidance: {
      immediateActions: ["Remove 'volunteer' potatoes", "Hill up soil over tubers"],
      recommendedTreatment: ["Metalaxyl", "Trichoderma Viride (Organic)", "Dashaparani Kashayam (Organic)"],
      irrigationAdvice: "Avoid late evening watering",
      fertilizerAdvice: "Balanced N-P-K; avoid excessive vegetative growth"
    },
    scientificInsights: {
      transmission: "Spreads via infected tubers and wind-blown spores.",
      environmentalTriggers: "Extended periods of leaf wetness and cool nights.",
      impact: "Causes rapid rot of both foliage and tubers."
    }
  },

  "Corn_(maize)___Common_rust": {
    displayName: "Corn – Common Rust",
    pathogenType: "Fungal",
    scientificName: "Puccinia sorghi",
    severityThresholds: { low: 0.5, moderate: 0.8 },
    farmerGuidance: {
      immediateActions: ["Plant resistant hybrids", "Tillage to bury debris"],
      recommendedTreatment: ["Propiconazole", "Panchagavya spray (Organic)", "Neem Oil (Organic)"],
      irrigationAdvice: "Minimize overhead irrigation during silking",
      fertilizerAdvice: "Maintain optimal phosphorus levels"
    },
    scientificInsights: {
      transmission: "Wind-blown urediniospores from southern regions.",
      environmentalTriggers: "High humidity (>95%) and temperatures (16-25°C).",
      impact: "Reduces photosynthetic capacity; affects ear fill."
    }
  },

  "Grape___Black_rot": {
    displayName: "Grape – Black Rot",
    pathogenType: "Fungal",
    scientificName: "Guignardia bidwellii",
    severityThresholds: { low: 0.3, moderate: 0.6 },
    farmerGuidance: {
      immediateActions: ["Remove mummified berries", "Prune for sun exposure"],
      recommendedTreatment: ["Mancozeb", "Fermented Buttermilk (Organic)", "Trichoderma (Organic)"],
      irrigationAdvice: "Ensure good vineyard floor drainage",
      fertilizerAdvice: "Control vigor; avoid lush canopy"
    },
    scientificInsights: {
      transmission: "Overwintering spores on canes and mummies.",
      environmentalTriggers: "Significant rain events during early shoot growth.",
      impact: "Can cause 100% crop loss in susceptible varieties."
    }
  }
}