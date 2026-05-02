"use client"

import { Button } from "@/components/ui/button"
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
  const confirmClassName =
    actionType === "Spray"
      ? "bg-green-600 hover:bg-green-700"
      : "bg-blue-600 hover:bg-blue-700"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirm {actionType}</DialogTitle>
          <DialogDescription>
            Review the command details before sending it to the backend.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 rounded-lg border bg-muted/30 p-4 text-sm">
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Zone Name</span>
            <span className="font-semibold text-foreground">{zoneName}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Action Type</span>
            <span className="font-semibold text-foreground">{actionType}</span>
          </div>
          {actionType === "Spray" && (
            <>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Chemical Name</span>
                <span className="font-semibold text-foreground">{chemicalName || "N/A"}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Dosage</span>
                <span className="font-semibold text-foreground">{dosage || "N/A"}</span>
              </div>
            </>
          )}
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Estimated Volume</span>
            <span className="font-semibold text-foreground">{estimatedVolumeLiters.toFixed(2)} L</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-slate-300 text-slate-700 hover:bg-slate-100">
            Cancel
          </Button>
          <Button className={confirmClassName} onClick={onConfirm}>
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
