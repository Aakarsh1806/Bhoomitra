export interface Pesticide {
  chemicalName: string
  type: "Fungicide" | "Bactericide" | "Insecticide" | "Organic"
  approvedFor: string[]
  modeOfAction: string
  resistanceGroup?: string
  dosage: string
  applicationMethod: string
  sprayInterval: string
  preHarvestInterval: string
  safetyNote: string
}

/* 
  PROFESSIONAL AGRONOMIC DATABASE
  Based on common agricultural extension recommendations
  Structured for ML disease matching
*/

export const pesticideDatabase: Pesticide[] = [

  /* ===========================
     🍎 APPLE DISEASES
  =========================== */

  {
    chemicalName: "Captan 50% WP",
    type: "Fungicide",
    approvedFor: ["Apple___Apple_scab"],
    modeOfAction: "Protective contact fungicide",
    resistanceGroup: "FRAC M4",
    dosage: "2 g per liter",
    applicationMethod: "Foliar spray",
    sprayInterval: "7–10 days",
    preHarvestInterval: "7 days",
    safetyNote: "Apply before infection period; avoid during bloom."
  },

  {
    chemicalName: "Thiophanate-Methyl 70% WP",
    type: "Fungicide",
    approvedFor: ["Apple___Black_rot"],
    modeOfAction: "Systemic benzimidazole fungicide",
    resistanceGroup: "FRAC 1",
    dosage: "1 g per liter",
    applicationMethod: "Foliar spray",
    sprayInterval: "10–14 days",
    preHarvestInterval: "14 days",
    safetyNote: "Rotate with non-FRAC 1 fungicides."
  },

  {
    chemicalName: "Myclobutanil 10% WP",
    type: "Fungicide",
    approvedFor: ["Apple___Cedar_apple_rust"],
    modeOfAction: "Systemic DMI fungicide",
    resistanceGroup: "FRAC 3",
    dosage: "0.5 g per liter",
    applicationMethod: "Foliar spray",
    sprayInterval: "14 days",
    preHarvestInterval: "14 days",
    safetyNote: "Do not exceed 3 applications per season."
  },

  /* ===========================
     🌽 CORN (MAIZE)
  =========================== */

  {
    chemicalName: "Propiconazole 25% EC",
    type: "Fungicide",
    approvedFor: [
      "Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot",
      "Corn_(maize)___Northern_Leaf_Blight",
      "Corn_(maize)___Common_rust"
    ],
    modeOfAction: "Systemic triazole fungicide",
    resistanceGroup: "FRAC 3",
    dosage: "1 ml per liter",
    applicationMethod: "Foliar spray at VT stage",
    sprayInterval: "10–14 days",
    preHarvestInterval: "14 days",
    safetyNote: "Avoid repeated solo applications."
  },

  {
    chemicalName: "Azoxystrobin 23% SC",
    type: "Fungicide",
    approvedFor: [
      "Corn_(maize)___Northern_Leaf_Blight",
      "Corn_(maize)___Common_rust"
    ],
    modeOfAction: "QoI fungicide",
    resistanceGroup: "FRAC 11",
    dosage: "1 ml per liter",
    applicationMethod: "Foliar spray",
    sprayInterval: "10 days",
    preHarvestInterval: "14 days",
    safetyNote: "Limit to 2 sequential sprays."
  },

  /* ===========================
     🍅 TOMATO & POTATO (KAGGLE FAVORITES)
  =========================== */

  {
    chemicalName: "Chlorothalonil 75% WP",
    type: "Fungicide",
    approvedFor: [
      "Tomato___Early_blight",
      "Tomato___Late_blight",
      "Potato___Early_blight",
      "Potato___Late_blight"
    ],
    modeOfAction: "Multi-site contact fungicide",
    resistanceGroup: "FRAC M5",
    dosage: "2 g per liter",
    applicationMethod: "Foliar spray",
    sprayInterval: "7 days",
    preHarvestInterval: "7-14 days",
    safetyNote: "Do not apply in high temperatures to avoid leaf burn."
  },

  {
    chemicalName: "Copper Oxychloride 50% WP",
    type: "Bactericide",
    approvedFor: [
      "Tomato___Bacterial_spot",
      "Pepper,_bell___Bacterial_spot"
    ],
    modeOfAction: "Contact bactericide/fungicide",
    resistanceGroup: "FRAC M1",
    dosage: "3 g per liter",
    applicationMethod: "Foliar spray",
    sprayInterval: "7–10 days",
    preHarvestInterval: "1 day",
    safetyNote: "Safe for most crops but avoid mixing with acidic chemicals."
  },

  {
    chemicalName: "Imidacloprid 17.8% SL",
    type: "Insecticide",
    approvedFor: [
      "Tomato___Tomato_Yellow_Leaf_Curl_Virus",
      "Tomato___Tomato_mosaic_virus",
      "Squash___Powdery_mildew"
    ],
    modeOfAction: "Systemic neonicotinoid (Vector Control)",
    resistanceGroup: "IRAC 4A",
    dosage: "0.5 ml per liter",
    applicationMethod: "Soil drench or foliar spray",
    sprayInterval: "15 days",
    preHarvestInterval: "21 days",
    safetyNote: "Highly effective against whiteflies and aphids that spread viruses."
  },

  /* ===========================
     🌿 ORGANIC ALTERNATIVES (KAGGLE COMPATIBLE)
  =========================== */

  {
    chemicalName: "Neem Oil Extract (Cold Pressed)",
    type: "Organic",
    approvedFor: [
      "Tomato___Early_blight",
      "Tomato___Bacterial_spot",
      "Corn_(maize)___Common_rust",
      "Squash___Powdery_mildew",
      "Apple___Apple_scab",
      "Grape___Black_rot",
      "Grape___Leaf_blight_(Isariopsis_Leaf_Spot)",
      "Strawberry___Leaf_scorch"
    ],
    modeOfAction: "Biological disruption / Repellent",
    dosage: "5 ml per liter with soap",
    applicationMethod: "Foliar spray (Evening)",
    sprayInterval: "5 days",
    preHarvestInterval: "0 days",
    safetyNote: "Broad-spectrum safe organic alternative."
  },

  {
    chemicalName: "Trichoderma Viride",
    type: "Organic",
    approvedFor: [
      "Potato___Late_blight",
      "Tomato___Late_blight",
      "Tomato___Early_blight",
      "Apple___Black_rot",
      "Grape___Black_rot",
      "Grape___Esca_(Black_Measles)"
    ],
    modeOfAction: "Bio-fungicide antagonist",
    dosage: "5 g per liter",
    applicationMethod: "Soil treatment or foliar spray",
    sprayInterval: "10 days",
    preHarvestInterval: "0 days",
    safetyNote: "Beneficial fungi that kills pathogenic fungi."
  },

  {
    chemicalName: "Sour Buttermilk (Fermented)",
    type: "Organic",
    approvedFor: [
      "Squash___Powdery_mildew",
      "Tomato___Leaf_Mold",
      "Grape___Powdery_mildew"
    ],
    modeOfAction: "Antifungal probiotic acidity",
    dosage: "1 liter in 10 liters of water",
    applicationMethod: "Foliar spray",
    sprayInterval: "7 days",
    preHarvestInterval: "0 days",
    safetyNote: "Best applied early morning; use 3-4 day old buttermilk."
  },

  {
    chemicalName: "Baking Soda & Soap Solution",
    type: "Organic",
    approvedFor: [
      "Squash___Powdery_mildew",
      "Tomato___Septoria_leaf_spot",
      "Strawberry___Leaf_scorch"
    ],
    modeOfAction: "pH disruption of fungal spores",
    dosage: "5 g baking soda + 2 ml liquid soap per liter",
    applicationMethod: "Foliar spray",
    sprayInterval: "7–10 days",
    preHarvestInterval: "0 days",
    safetyNote: "Test on few leaves first to avoid leaf burn."
  },

  {
    chemicalName: "Pseudomonas Fluorescens",
    type: "Organic",
    approvedFor: [
      "Tomato___Bacterial_spot",
      "Pepper,_bell___Bacterial_spot",
      "Tomato___Early_blight"
    ],
    modeOfAction: "Systemic resistance inducer",
    dosage: "10 g per liter",
    applicationMethod: "Root dipping or foliar spray",
    sprayInterval: "15 days",
    preHarvestInterval: "0 days",
    safetyNote: "Extremely effective for bacterial blights."
  },

  {
    chemicalName: "Ginger-Garlic-Chili (GGC) Extract",
    type: "Organic",
    approvedFor: [
      "Tomato___Tomato_Yellow_Leaf_Curl_Virus",
      "Tomato___Tomato_mosaic_virus",
      "Pepper,_bell___Bacterial_spot"
    ],
    modeOfAction: "Bio-pesticide and vector repellent",
    dosage: "20 ml extract per liter",
    applicationMethod: "Foliar spray",
    sprayInterval: "5 days",
    preHarvestInterval: "0 days",
    safetyNote: "Controls whiteflies and aphids that spread viruses."
  },

  {
    chemicalName: "Dashaparani Kashayam",
    type: "Organic",
    approvedFor: [
      "Apple___Apple_scab",
      "Apple___Cedar_apple_rust",
      "Tomato___Septoria_leaf_spot",
      "Potato___Late_blight",
      "Grape___Leaf_blight_(Isariopsis_Leaf_Spot)",
      "Corn_(maize)___Common_rust",
      "Corn_(maize)___Northern_Leaf_Blight",
      "Tomato___Early_blight"
    ],
    modeOfAction: "Immunity booster and broad-spectrum pesticide",
    dosage: "200 ml in 10 liters of water",
    applicationMethod: "Foliar spray",
    sprayInterval: "10–15 days",
    preHarvestInterval: "0 days",
    safetyNote: "Traditional ten-leaf extract; keeps plants healthy."
  },

  {
    chemicalName: "Wood Ash & Water",
    type: "Organic",
    approvedFor: [
      "Potato___Late_blight",
      "Tomato___Late_blight",
      "Tomato___Early_blight",
      "Corn_(maize)___Northern_Leaf_Blight",
      "Squash___Powdery_mildew",
      "Strawberry___Leaf_scorch"
    ],
    modeOfAction: "Mineral-based protective barrier",
    dosage: "Dusting or 100g ash per liter (strained)",
    applicationMethod: "Dusting or spray",
    sprayInterval: "After every rain or weekly",
    preHarvestInterval: "0 days",
    safetyNote: "Increases soil alkalinity; use sparingly on leaves."
  },

  /* ===========================
     🍇 GRAPE
  =========================== */

  {
    chemicalName: "Mancozeb 75% WP",
    type: "Fungicide",
    approvedFor: [
      "Grape___Black_rot",
      "Grape___Leaf_blight_(Isariopsis_Leaf_Spot)"
    ],
    modeOfAction: "Contact multi-site fungicide",
    resistanceGroup: "FRAC M3",
    dosage: "2.5 g per liter",
    applicationMethod: "Foliar spray",
    sprayInterval: "7–10 days",
    preHarvestInterval: "7 days",
    safetyNote: "Do not mix with alkaline pesticides."
  },

  {
    chemicalName: "Azoxystrobin",
    type: "Fungicide",
    approvedFor: ["Grape___Esca_(Black_Measles)"],
    modeOfAction: "Systemic QoI fungicide",
    resistanceGroup: "FRAC 11",
    dosage: "1 ml per liter",
    applicationMethod: "Foliar spray",
    sprayInterval: "10–14 days",
    preHarvestInterval: "14 days",
    safetyNote: "Rotate resistance groups."
  },

  /* ===========================
     🍅 TOMATO
  =========================== */

  {
    chemicalName: "Metalaxyl + Mancozeb",
    type: "Fungicide",
    approvedFor: [
      "Tomato___Late_blight",
      "Tomato___Early_blight"
    ],
    modeOfAction: "Systemic + contact combination",
    resistanceGroup: "FRAC 4 + M3",
    dosage: "2 g per liter",
    applicationMethod: "Foliar spray",
    sprayInterval: "7–10 days",
    preHarvestInterval: "7 days",
    safetyNote: "Avoid overuse to prevent resistance."
  },

  {
    chemicalName: "Chlorothalonil 75% WP",
    type: "Fungicide",
    approvedFor: [
      "Tomato___Septoria_leaf_spot",
      "Tomato___Leaf_Mold"
    ],
    modeOfAction: "Protective contact fungicide",
    resistanceGroup: "FRAC M5",
    dosage: "2 g per liter",
    applicationMethod: "Foliar spray",
    sprayInterval: "7 days",
    preHarvestInterval: "7 days",
    safetyNote: "Apply preventively."
  },

  {
    chemicalName: "Imidacloprid 17.8% SL",
    type: "Insecticide",
    approvedFor: [
      "Tomato___Tomato_Yellow_Leaf_Curl_Virus"
    ],
    modeOfAction: "Systemic neonicotinoid (controls whitefly vector)",
    resistanceGroup: "IRAC 4A",
    dosage: "0.3 ml per liter",
    applicationMethod: "Foliar spray",
    sprayInterval: "14 days",
    preHarvestInterval: "3 days",
    safetyNote: "Apply early to control vector population."
  },

  /* ===========================
     🍓 STRAWBERRY
  =========================== */

  {
    chemicalName: "Copper Oxychloride",
    type: "Bactericide",
    approvedFor: ["Strawberry___Leaf_scorch"],
    modeOfAction: "Multi-site copper contact",
    resistanceGroup: "FRAC M1",
    dosage: "2 g per liter",
    applicationMethod: "Foliar spray",
    sprayInterval: "10 days",
    preHarvestInterval: "3 days",
    safetyNote: "Avoid excessive copper accumulation."
  },

  /* ===========================
     🌿 GENERAL IMMUNITY BOOSTERS
  =========================== */

  {
    chemicalName: "Panchagavya",
    type: "Organic",
    approvedFor: [
      "Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot",
      "Corn_(maize)___Common_rust",
      "Any___Healthy"
    ],
    modeOfAction: "Growth promoter and immunity enhancer",
    dosage: "30 ml per liter",
    applicationMethod: "Foliar spray / Irrigation",
    sprayInterval: "15 days",
    preHarvestInterval: "0 days",
    safetyNote: "Improves overall plant health and resistance."
  }

]