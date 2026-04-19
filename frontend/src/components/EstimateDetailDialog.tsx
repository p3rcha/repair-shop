import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { StatusBadge } from "@/components/StatusBadge"
import type { Estimate } from "@/lib/types"

function formatMoney(value: string | number) {
  const n = typeof value === "number" ? value : Number(value)
  if (Number.isNaN(n)) return String(value)
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" })
}

function formatDate(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

type Props = {
  estimate: Estimate | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[0.65rem] uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <span className="text-sm">{value}</span>
    </div>
  )
}

export function EstimateDetailDialog({ estimate, open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        {estimate && (
          <>
            <DialogHeader>
              <DialogTitle>Estimate #{estimate.id}</DialogTitle>
              <DialogDescription>{formatDate(estimate.created_at)}</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Customer" value={estimate.customer_name} />
              <Field
                label="Status"
                value={<StatusBadge status={estimate.status} />}
              />
              <Field
                label="Vehicle"
                value={
                  <>
                    {estimate.vehicle_make} {estimate.vehicle_model}
                    {estimate.vehicle_year ? ` · ${estimate.vehicle_year}` : ""}
                  </>
                }
              />
              <Field
                label="License plate"
                value={estimate.license_plate || "—"}
              />
            </div>

            <Separator />

            <div className="flex flex-col gap-2">
              <span className="text-[0.65rem] uppercase tracking-widest text-muted-foreground">
                Line items
              </span>
              <div className="flex flex-col">
                <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 border-b border-border py-2 text-[0.65rem] uppercase tracking-widest text-muted-foreground">
                  <span>Item</span>
                  <span className="text-right">Qty</span>
                  <span className="text-right">Unit</span>
                  <span className="text-right">Total</span>
                </div>
                {estimate.items.map((line) => {
                  const lineTotal = Number(line.unit_price) * line.quantity
                  return (
                    <div
                      key={line.id}
                      className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 border-b border-border py-2 text-sm"
                    >
                      <span className="font-medium">{line.item_name}</span>
                      <span className="text-right tabular-nums">{line.quantity}</span>
                      <span className="text-right tabular-nums text-muted-foreground">
                        {formatMoney(line.unit_price)}
                      </span>
                      <span className="text-right font-medium tabular-nums">
                        {formatMoney(lineTotal)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-widest text-muted-foreground">
                Total
              </span>
              <span className="font-heading text-2xl tabular-nums">
                {formatMoney(estimate.total)}
              </span>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
