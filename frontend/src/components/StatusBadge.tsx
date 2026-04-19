import { cn } from "@/lib/utils"
import { STATUS_LABEL, type EstimateStatus } from "@/lib/types"

const STATUS_STYLES: Record<EstimateStatus, { dot: string; text: string }> = {
  pending: { dot: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" },
  in_progress: { dot: "bg-sky-500", text: "text-sky-600 dark:text-sky-400" },
  completed: { dot: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" },
}

export function StatusBadge({ status, className }: { status: EstimateStatus; className?: string }) {
  const style = STATUS_STYLES[status]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-widest",
        style.text,
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", style.dot)} aria-hidden />
      {STATUS_LABEL[status]}
    </span>
  )
}
