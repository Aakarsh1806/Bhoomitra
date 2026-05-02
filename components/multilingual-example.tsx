"use client"

import { useTranslation } from "@/lib/use-translation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

/**
 * Example component showing how to implement multilingual support
 * Copy this pattern to your components
 */
export function MultilingualExample() {
  const t = useTranslation()

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("map.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h3 className="font-semibold mb-2">{t("map.layout")}</h3>
          <p className="text-sm text-slate-600">
            {t("map.zones")}: 24
          </p>
        </div>

        <div className="grid gap-2">
          <Badge className="w-fit">{t("status.healthy")}</Badge>
          <Badge className="w-fit" variant="secondary">
            {t("status.warning")}
          </Badge>
          <Badge className="w-fit" variant="destructive">
            {t("status.critical")}
          </Badge>
        </div>

        <div className="flex gap-2">
          <Button>{t("action.save")}</Button>
          <Button variant="outline">{t("dialog.cancel")}</Button>
        </div>

        <div className="p-3 bg-blue-50 rounded border border-blue-200">
          <p className="text-sm text-blue-900">
            <strong>{t("map.selectZone")}</strong>
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
