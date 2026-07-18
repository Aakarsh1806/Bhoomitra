import { NextResponse } from "next/server"
import { zoneHistory } from "../../zones/data"

export async function GET() {

  // Build time series from stored history
  const maxLength = Math.max(
    ...zoneHistory.map(z => z.moistureHistory.length)
  )

  const trendData = []

  for (let i = 0; i < maxLength; i++) {
    let totalMoisture = 0
    let count = 0

    zoneHistory.forEach(zone => {
      if (zone.moistureHistory[i] !== undefined) {
        totalMoisture += zone.moistureHistory[i]
        count++
      }
    })

    if (count > 0) {
      trendData.push({
        index: i + 1,
        avgMoisture: Math.round(totalMoisture / count)
      })
    }
  }

  return NextResponse.json(trendData)
}
