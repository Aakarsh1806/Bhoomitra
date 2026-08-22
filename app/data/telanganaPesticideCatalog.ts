/**
 * Offline Telangana disease-advisory catalog.
 *
 * This covers every disease class returned by the bundled PlantVillage model.
 * It is decision support, not a product label: a farmer must verify the
 * locally registered product, crop stage, dose and waiting period with the
 * label and local agricultural-extension service before applying anything.
 */
export type TelanganaPesticideRecommendation = {
  disease: string
  crop: string
  activeIngredient: string
  formulation: string
  category: "Fungicide" | "Bactericide" | "Insecticide"
  dosage: string
  applicationMethod: string
  sprayInterval: string
  preHarvestInterval: string
  resistanceGroup: string
  safetyNote: string
  organicAlternative: string
  requiresManualConfirmation: true
  verificationNotice: string
}

export const TELANGANA_OFFLINE_NOTICE =
  "Offline Telangana decision support only. Verify the locally registered product label, crop stage, waiting period and local agricultural-extension advice before application."

const LABEL_DOSE = "Use only at the dose on the locally registered product label"
const LABEL_INTERVAL = "Follow product label and extension guidance"
const LABEL_PHI = "Follow product-label waiting period"

type AdvisoryInput = Omit<
  TelanganaPesticideRecommendation,
  "dosage" | "applicationMethod" | "sprayInterval" | "preHarvestInterval" | "requiresManualConfirmation" | "verificationNotice"
>

function advisory(input: AdvisoryInput): TelanganaPesticideRecommendation {
  return {
    ...input,
    dosage: LABEL_DOSE,
    applicationMethod: "Foliar application only when the label permits it",
    sprayInterval: LABEL_INTERVAL,
    preHarvestInterval: LABEL_PHI,
    requiresManualConfirmation: true,
    verificationNotice: TELANGANA_OFFLINE_NOTICE,
  }
}

export const telanganaPesticideCatalog: TelanganaPesticideRecommendation[] = [
  advisory({ disease: "Apple___Apple_scab", crop: "Apple", activeIngredient: "Captan", formulation: "Crop-registered formulation", category: "Fungicide", resistanceGroup: "FRAC M4", safetyNote: "Use protective equipment and avoid application during bloom unless the label allows it.", organicAlternative: "Remove fallen leaves and prune to improve canopy airflow." }),
  advisory({ disease: "Apple___Black_rot", crop: "Apple", activeIngredient: "Crop-registered protectant fungicide", formulation: "Extension-guided formulation", category: "Fungicide", resistanceGroup: "Rotate labelled FRAC groups", safetyNote: "Remove mummified fruit and cankers before considering a spray.", organicAlternative: "Prune infected wood with sanitised tools and destroy diseased fruit." }),
  advisory({ disease: "Apple___Cedar_apple_rust", crop: "Apple", activeIngredient: "Crop-registered DMI fungicide", formulation: "Extension-guided formulation", category: "Fungicide", resistanceGroup: "FRAC 3—rotate with another labelled group", safetyNote: "Do not repeat the same resistance group consecutively.", organicAlternative: "Remove nearby alternate-host juniper where feasible and improve airflow." }),
  advisory({ disease: "Cherry_(including_sour)___Powdery_mildew", crop: "Cherry", activeIngredient: "Sulphur or another crop-registered fungicide", formulation: "Extension-guided formulation", category: "Fungicide", resistanceGroup: "FRAC M2 or labelled alternative", safetyNote: "Avoid sulphur products in hot conditions or where incompatible oils were recently used.", organicAlternative: "Prune for airflow and remove infected shoots early." }),
  advisory({ disease: "Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot", crop: "Maize", activeIngredient: "Propiconazole", formulation: "Crop-registered formulation", category: "Fungicide", resistanceGroup: "FRAC 3", safetyNote: "Avoid repeated solo FRAC 3 applications and do not spray in strong wind or before rain.", organicAlternative: "Remove badly affected leaves and improve field airflow." }),
  advisory({ disease: "Corn_(maize)___Common_rust_", crop: "Maize", activeIngredient: "Azoxystrobin", formulation: "Crop-registered formulation", category: "Fungicide", resistanceGroup: "FRAC 11", safetyNote: "Rotate resistance groups; do not repeat FRAC 11 products consecutively.", organicAlternative: "Remove volunteer maize and monitor lower leaves." }),
  advisory({ disease: "Corn_(maize)___Northern_Leaf_Blight", crop: "Maize", activeIngredient: "Propiconazole", formulation: "Crop-registered formulation", category: "Fungicide", resistanceGroup: "FRAC 3", safetyNote: "Confirm the disease and rotate modes of action.", organicAlternative: "Use tolerant hybrids and destroy heavily infected residue." }),
  advisory({ disease: "Grape___Black_rot", crop: "Grape", activeIngredient: "Mancozeb or another crop-registered protectant", formulation: "Extension-guided formulation", category: "Fungicide", resistanceGroup: "FRAC M3 or labelled alternative", safetyNote: "Observe the label waiting period and avoid incompatible tank mixes.", organicAlternative: "Prune for airflow and remove mummified berries." }),
  advisory({ disease: "Grape___Esca_(Black_Measles)", crop: "Grape", activeIngredient: "No curative spray—extension-led vine management", formulation: "Not applicable", category: "Fungicide", resistanceGroup: "Not applicable", safetyNote: "Do not present a fungicide as a cure; mark and prune affected wood using sanitised tools.", organicAlternative: "Improve vine vigour, remove infected wood and disinfect pruning tools." }),
  advisory({ disease: "Grape___Leaf_blight_(Isariopsis_Leaf_Spot)", crop: "Grape", activeIngredient: "Mancozeb or another crop-registered protectant", formulation: "Extension-guided formulation", category: "Fungicide", resistanceGroup: "FRAC M3 or labelled alternative", safetyNote: "Rotate modes of action and avoid spraying before rain.", organicAlternative: "Remove infected leaves and maintain an open canopy." }),
  advisory({ disease: "Orange___Haunglongbing_(Citrus_greening)", crop: "Citrus", activeIngredient: "No curative chemical—vector management plan", formulation: "Extension-guided formulation", category: "Insecticide", resistanceGroup: "Use only locally labelled psyllid-control groups", safetyNote: "Confirm citrus greening with an extension officer; do not claim that a pesticide cures infected trees.", organicAlternative: "Use disease-free nursery stock, scout for psyllids and remove confirmed severely affected trees as advised." }),
  advisory({ disease: "Peach___Bacterial_spot", crop: "Peach", activeIngredient: "Copper-based crop-registered bactericide", formulation: "Extension-guided formulation", category: "Bactericide", resistanceGroup: "FRAC M1", safetyNote: "Avoid repeated copper use and follow crop-stage restrictions on the label.", organicAlternative: "Use clean planting material and remove severely affected leaves or fruit." }),
  advisory({ disease: "Pepper,_bell___Bacterial_spot", crop: "Pepper", activeIngredient: "Copper-based crop-registered bactericide", formulation: "Extension-guided formulation", category: "Bactericide", resistanceGroup: "FRAC M1", safetyNote: "Avoid excessive copper accumulation and handling plants when wet.", organicAlternative: "Use disease-free seedlings, sanitation and drip irrigation where possible." }),
  advisory({ disease: "Potato___Early_blight", crop: "Potato", activeIngredient: "Chlorothalonil or another crop-registered protectant", formulation: "Extension-guided formulation", category: "Fungicide", resistanceGroup: "FRAC M5 or labelled alternative", safetyNote: "Confirm the disease and follow the label waiting period.", organicAlternative: "Remove infected foliage and avoid overhead irrigation." }),
  advisory({ disease: "Potato___Late_blight", crop: "Potato", activeIngredient: "Crop-registered late-blight fungicide", formulation: "Extension-guided formulation", category: "Fungicide", resistanceGroup: "Rotate labelled FRAC groups", safetyNote: "Do not repeatedly use the same systemic group; avoid spraying ahead of rain or irrigation.", organicAlternative: "Destroy heavily infected foliage and improve drainage and airflow." }),
  advisory({ disease: "Squash___Powdery_mildew", crop: "Squash", activeIngredient: "Sulphur or another crop-registered fungicide", formulation: "Extension-guided formulation", category: "Fungicide", resistanceGroup: "FRAC M2 or labelled alternative", safetyNote: "Avoid sulphur in high heat and do not mix it with incompatible oils.", organicAlternative: "Remove heavily infected leaves and improve spacing and airflow." }),
  advisory({ disease: "Strawberry___Leaf_scorch", crop: "Strawberry", activeIngredient: "Crop-registered protectant fungicide", formulation: "Extension-guided formulation", category: "Fungicide", resistanceGroup: "Rotate labelled FRAC groups", safetyNote: "Confirm the diagnosis because nutrient, salt and heat stress can look similar.", organicAlternative: "Remove affected leaves, mulch soil and avoid splash irrigation." }),
  advisory({ disease: "Tomato___Bacterial_spot", crop: "Tomato", activeIngredient: "Copper-based crop-registered bactericide", formulation: "Extension-guided formulation", category: "Bactericide", resistanceGroup: "FRAC M1", safetyNote: "Avoid excessive copper use and do not mix products unless both labels permit it.", organicAlternative: "Use clean seedlings, remove infected plants and avoid handling wet foliage." }),
  advisory({ disease: "Tomato___Early_blight", crop: "Tomato", activeIngredient: "Chlorothalonil or another crop-registered protectant", formulation: "Extension-guided formulation", category: "Fungicide", resistanceGroup: "FRAC M5 or labelled alternative", safetyNote: "Do not apply during high heat; use protective equipment.", organicAlternative: "Remove infected leaves and avoid overhead irrigation." }),
  advisory({ disease: "Tomato___Late_blight", crop: "Tomato", activeIngredient: "Crop-registered late-blight fungicide", formulation: "Extension-guided formulation", category: "Fungicide", resistanceGroup: "Rotate labelled FRAC groups", safetyNote: "Do not repeat the same systemic group without rotation; avoid rain and wind.", organicAlternative: "Remove infected foliage and improve drainage and airflow." }),
  advisory({ disease: "Tomato___Leaf_Mold", crop: "Tomato", activeIngredient: "Crop-registered protectant fungicide", formulation: "Extension-guided formulation", category: "Fungicide", resistanceGroup: "Rotate labelled FRAC groups", safetyNote: "Reduce humidity and improve ventilation before considering a spray.", organicAlternative: "Prune dense growth, ventilate protected cultivation and avoid leaf wetness." }),
  advisory({ disease: "Tomato___Septoria_leaf_spot", crop: "Tomato", activeIngredient: "Chlorothalonil or another crop-registered protectant", formulation: "Extension-guided formulation", category: "Fungicide", resistanceGroup: "FRAC M5 or labelled alternative", safetyNote: "Do not spray heat-stressed plants; follow the label waiting period.", organicAlternative: "Mulch soil, remove lower infected leaves and avoid splash irrigation." }),
  advisory({ disease: "Tomato___Spider_mites Two-spotted_spider_mite", crop: "Tomato", activeIngredient: "Crop-registered selective miticide", formulation: "Extension-guided formulation", category: "Insecticide", resistanceGroup: "Use only a locally labelled mite-control group", safetyNote: "Confirm mites by checking leaf undersides; do not use a broad-spectrum insecticide that harms beneficial insects.", organicAlternative: "Wash leaf undersides with water, remove heavily infested leaves and conserve natural predators." }),
  advisory({ disease: "Tomato___Target_Spot", crop: "Tomato", activeIngredient: "Crop-registered protectant fungicide", formulation: "Extension-guided formulation", category: "Fungicide", resistanceGroup: "Rotate labelled FRAC groups", safetyNote: "Confirm the disease and minimise leaf wetness before considering a spray.", organicAlternative: "Remove infected leaves, improve airflow and avoid overhead irrigation." }),
  advisory({ disease: "Tomato___Tomato_Yellow_Leaf_Curl_Virus", crop: "Tomato", activeIngredient: "No curative chemical—whitefly vector management", formulation: "Extension-guided formulation", category: "Insecticide", resistanceGroup: "Use only locally labelled whitefly-control groups", safetyNote: "A pesticide does not cure infected plants; confirm diagnosis and focus on whitefly management.", organicAlternative: "Rogue severely affected plants, use insect-proof netting and yellow sticky traps." }),
  advisory({ disease: "Tomato___Tomato_mosaic_virus", crop: "Tomato", activeIngredient: "No curative chemical—sanitation management", formulation: "Not applicable", category: "Insecticide", resistanceGroup: "Not applicable", safetyNote: "Do not claim that an insecticide cures mosaic virus; disinfect hands and tools and remove confirmed infected plants.", organicAlternative: "Use clean seed, avoid tobacco handling near plants and sanitise tools between plants." }),
]

function normalise(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "_")
}

function stripCropPrefix(value: string) {
  const index = value.indexOf("___")
  return index >= 0 ? value.slice(index + 3) : value
}

export function getTelanganaOfflineRecommendation(disease: string, crop?: string) {
  const normalisedDisease = normalise(disease)
  const exact = telanganaPesticideCatalog.find(entry => normalise(entry.disease) === normalisedDisease)
  if (exact) return exact

  // The live ML service returns a crop-stripped disease key (e.g.
  // "Esca_(Black_Measles)", not the catalog's "Grape___Esca_(Black_Measles)"),
  // so the exact match above never fires for a real scan — this catalog's
  // cultural-only entries (Esca, viral "no curative chemical" cases) would
  // otherwise silently fall through to a generic fungicide match. Fall back
  // to the disease-key suffix, preferring the entry whose crop matches the
  // farmer-selected crop when more than one crop shares a disease name (e.g.
  // Early_blight on both Potato and Tomato).
  const strippedInput = normalise(stripCropPrefix(disease))
  const suffixMatches = telanganaPesticideCatalog.filter(
    (entry) => normalise(stripCropPrefix(entry.disease)) === strippedInput,
  )
  if (suffixMatches.length === 0) return null
  if (crop) {
    const cropMatch = suffixMatches.find((entry) => normalise(entry.crop) === normalise(crop))
    if (cropMatch) return cropMatch
  }
  return suffixMatches[0]
}

export function getCatalogCoverage() {
  return telanganaPesticideCatalog.map(entry => entry.disease)
}
