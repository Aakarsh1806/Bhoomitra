import { NextResponse } from "next/server"
import { zones } from "../zones/data"

export async function POST(req: Request) {
    try {
        const { zoneId, disease, confidence } = await req.json()

        const zone = zones.find((z) => z.id === zoneId)

        if (!zone) {
            return NextResponse.json({ error: "Zone not found" }, { status: 404 })
        }

        // Update disease + confidence
        zone.disease = disease
        zone.mlConfidence = confidence
        zone.lastAnalyzed = new Date().toISOString()

        // Auto adjust zone status
        if (confidence > 0.75) {
            zone.status = "critical"
        } else if (confidence > 0.45) {
            zone.status = "warning"
        } else {
            zone.status = "healthy"
        }

        return NextResponse.json({ success: true })
    } catch (err) {
        return NextResponse.json({ error: "Invalid request" }, { status: 400 })
    }
}