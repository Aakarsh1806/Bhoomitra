import { pesticideDatabase, Pesticide } from "@/app/data/pesticideDatabase"

/*
  PROFESSIONAL SAFE RECOMMENDATION ENGINE
  ---------------------------------------
  1. Exact disease match
  2. Crop-level fallback
  3. Disease-type fallback
  4. Organic final fallback

  Guarantees non-empty response.
*/

function normalize(str: string) {
    return str.trim().toLowerCase()
}

function extractCrop(disease: string) {
    return disease.split("___")[0]
}

function inferDiseaseType(disease: string): "fungal" | "viral" | "bacterial" | "unknown" {
    const lower = disease.toLowerCase()

    if (lower.includes("virus")) return "viral"
    if (lower.includes("blight") || lower.includes("spot") || lower.includes("rot") || lower.includes("rust") || lower.includes("mildew"))
        return "fungal"
    if (lower.includes("bacterial")) return "bacterial"

    return "unknown"
}

export function getSafePesticideRecommendation(
    disease: string,
    confidence?: number
): {
    pesticides: Pesticide[]
    recommendationType: "exact" | "crop" | "type" | "organic"
    warning?: string
} {

    const normalizedDisease = normalize(disease)

    /* ==============================
       1️⃣ EXACT MATCH
    ============================== */

    let match = pesticideDatabase.filter(p =>
        p.approvedFor.some(d => normalize(d) === normalizedDisease)
    )

    if (match.length > 0) {
        return {
            pesticides: match,
            recommendationType: "exact",
            warning:
                confidence && confidence < 0.6
                    ? "Low confidence prediction. Verify before spraying."
                    : undefined
        }
    }

    /* ==============================
       2️⃣ CROP LEVEL FALLBACK
    ============================== */

    const crop = normalize(extractCrop(disease))

    match = pesticideDatabase.filter(p =>
        p.approvedFor.some(d =>
            normalize(d).startsWith(crop)
        )
    )

    if (match.length > 0) {
        return {
            pesticides: match,
            recommendationType: "crop",
            warning: "Specific disease match not found. Showing general crop-level treatment."
        }
    }

    /* ==============================
       3️⃣ DISEASE TYPE FALLBACK
    ============================== */

    const diseaseType = inferDiseaseType(disease)

    if (diseaseType === "fungal") {
        match = pesticideDatabase.filter(p => p.type === "Fungicide")
    }

    if (diseaseType === "viral") {
        match = pesticideDatabase.filter(p => p.type === "Insecticide")
    }

    if (diseaseType === "bacterial") {
        match = pesticideDatabase.filter(p => p.type === "Bactericide")
    }

    if (match.length > 0) {
        return {
            pesticides: match,
            recommendationType: "type",
            warning: "Broad-spectrum treatment recommended based on detected disease category."
        }
    }

    /* ==============================
       4️⃣ DYNAMIC ORGANIC SELECTOR
    ============================== */

    const organicFallback = pesticideDatabase.filter(p => p.type === "Organic")
    
    // First try: Specific organic match for this disease
    const organicMatch = organicFallback.filter(p => 
        p.approvedFor.some(d => normalize(d) === normalizedDisease)
    )

    if (organicMatch.length > 0) {
        return {
            pesticides: organicMatch,
            recommendationType: "exact",
            warning: "Specific organic treatment found for this condition."
        }
    }

    // Second try: Organic match for the disease type (Fungal/Bacterial/Viral)
    const typeMatch = organicFallback.filter(p => {
        if (diseaseType === "fungal") return p.chemicalName.toLowerCase().includes("buttermilk") || p.chemicalName.toLowerCase().includes("trichoderma") || p.chemicalName.toLowerCase().includes("soda")
        if (diseaseType === "viral") return p.chemicalName.toLowerCase().includes("ggc") || p.chemicalName.toLowerCase().includes("agni")
        if (diseaseType === "bacterial") return p.chemicalName.toLowerCase().includes("pseudomonas")
        return false
    })

    if (typeMatch.length > 0) {
        return {
            pesticides: typeMatch,
            recommendationType: "type",
            warning: "Selected organic treatment suitable for this disease category."
        }
    }

    return {
        pesticides: organicFallback.slice(0, 3),
        recommendationType: "organic",
        warning: "No direct match found. Showing broad-spectrum organic guidance."
    }
}