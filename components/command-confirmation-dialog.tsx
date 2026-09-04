"use client"

import { Button } from "@/components/ui/button"
import { useTranslation } from "@/lib/use-translation"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export type CommandActionType = "Spray" | "Hydrate"

type CommandConfirmationDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  zoneName: string
  actionType: CommandActionType
  estimatedVolumeLiters: number
  chemicalName?: string
  dosage?: string
  onConfirm: () => void
}

export default function CommandConfirmationDialog({
  open,
  onOpenChange,
  zoneName,
  actionType,
  estimatedVolumeLiters,
  chemicalName,
  dosage,
  onConfirm,
}: CommandConfirmationDialogProps) {
  const t = useTranslation()
  const actionLabel = actionType === "Spray" ? t("dialog.action.spray") : t("dialog.action.hydrate")
  const confirmClassName =
    actionType === "Spray"
      ? "bg-green-600 hover:bg-green-700"
      : "bg-blue-600 hover:bg-blue-700"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("dialog.confirmAction", { action: actionLabel })}</DialogTitle>
          <DialogDescription>
            {t("dialog.reviewDetails")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 rounded-lg border bg-muted/30 p-4 text-sm">
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">{t("dialog.zoneName")}</span>
            <span className="font-semibold text-foreground">{zoneName}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">{t("dialog.actionType")}</span>
            <span className="font-semibold text-foreground">{actionLabel}</span>
          </div>
          {actionType === "Spray" && (
            <>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">{t("dialog.chemicalName")}</span>
                <span className="font-semibold text-foreground">{chemicalName || t("dialog.na")}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">{t("dialog.dosage")}</span>
                <span className="font-semibold text-foreground">{dosage || t("dialog.na")}</span>
              </div>
            </>
          )}
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">{t("dialog.estimatedVolumeLabel")}</span>
            <span className="font-semibold text-foreground">{t("dialog.volumeLitres", { value: estimatedVolumeLiters.toFixed(2) })}</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-slate-300 text-slate-700 hover:bg-slate-100">
            {t("dialog.cancel")}
          </Button>
          <Button className={confirmClassName} onClick={onConfirm}>
            {t("dialog.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
