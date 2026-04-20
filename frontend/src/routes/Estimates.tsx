import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  ArrowLeft02Icon,
  ArrowRight02Icon,
  Delete02Icon,
  Edit02Icon,
  MoreHorizontalIcon,
  RefreshIcon,
} from "@hugeicons/core-free-icons"

import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

import { ApiError } from "@/lib/api"
import {
  ESTIMATE_STATUSES,
  STATUS_LABEL,
  type Estimate,
  type EstimateStatus,
} from "@/lib/types"
import { useDeleteEstimate, useEstimates, useUpdateEstimateStatus } from "@/lib/queries"
import { StatusBadge } from "@/components/StatusBadge"
import { EstimateDetailDialog } from "@/components/EstimateDetailDialog"

type Filter = EstimateStatus | "all"

const FILTERS: Filter[] = ["all", ...ESTIMATE_STATUSES]
const FILTER_LABEL: Record<Filter, string> = {
  all: "All statuses",
  ...STATUS_LABEL,
}

const PAGE_SIZE = 20

function formatMoney(value: string) {
  const n = Number(value)
  if (Number.isNaN(n)) return value
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

export function Estimates() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState<Filter>("all")
  const [offset, setOffset] = useState(0)
  const [detailId, setDetailId] = useState<number | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Estimate | null>(null)

  useEffect(() => {
    setOffset(0)
  }, [filter])

  const query = useEstimates({ status: filter, limit: PAGE_SIZE, offset })
  const updateStatus = useUpdateEstimateStatus()
  const deleteEstimate = useDeleteEstimate()

  const data = query.data?.items ?? null
  const total = query.data?.total ?? 0
  const loading = query.isLoading
  const error = query.error
    ? query.error instanceof ApiError
      ? query.error.message
      : "Failed to load estimates"
    : null

  const page = Math.floor(offset / PAGE_SIZE) + 1
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const canPrev = offset > 0
  const canNext = offset + PAGE_SIZE < total

  async function changeStatus(estimate: Estimate, next: EstimateStatus) {
    if (estimate.status === next) return
    try {
      await updateStatus.mutateAsync({ id: estimate.id, status: next })
      toast.success(`Estimate #${estimate.id} → ${STATUS_LABEL[next]}`)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to update status"
      toast.error(message)
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    const target = pendingDelete
    try {
      await deleteEstimate.mutateAsync(target.id)
      toast.success(`Estimate #${target.id} deleted`)
      if (detailId === target.id) setDetailId(null)
      const lastOnPage = (data?.length ?? 0) === 1 && offset > 0
      if (lastOnPage) setOffset((o) => Math.max(0, o - PAGE_SIZE))
      setPendingDelete(null)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to delete estimate"
      toast.error(message)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
            Estimates
          </h2>
          <p className="font-heading text-2xl">
            {loading
              ? "—"
              : `${total} ${total === 1 ? "result" : "results"}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
            <SelectTrigger className="min-w-44" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FILTERS.map((f) => (
                <SelectItem key={f} value={f}>
                  {FILTER_LABEL[f]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => query.refetch()}
            aria-label="Refresh"
          >
            <HugeiconsIcon icon={RefreshIcon} />
            Refresh
          </Button>
          <Button asChild size="sm">
            <Link to="/estimates/new">
              <HugeiconsIcon icon={Add01Icon} />
              New estimate
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">#</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading &&
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={`sk-${i}`}>
                    {Array.from({ length: 7 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}

              {!loading && error && (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-sm text-destructive">
                    {error}
                  </TableCell>
                </TableRow>
              )}

              {!loading && !error && data && data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3 text-xs uppercase tracking-widest text-muted-foreground">
                      No estimates {filter !== "all" ? `with status "${STATUS_LABEL[filter]}"` : "yet"}
                      <Button asChild size="sm" variant="outline">
                        <Link to="/estimates/new">
                          <HugeiconsIcon icon={Add01Icon} />
                          Create new Estimate
                        </Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}

              {!loading &&
                !error &&
                data?.map((e) => (
                  <TableRow
                    key={e.id}
                    onClick={() => setDetailId(e.id)}
                    className="cursor-pointer"
                  >
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      #{e.id}
                    </TableCell>
                    <TableCell className="font-medium">{e.customer_name}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>
                          {e.vehicle_make} {e.vehicle_model}
                          {e.vehicle_year ? ` · ${e.vehicle_year}` : ""}
                        </span>
                        {e.license_plate && (
                          <span className="text-xs text-muted-foreground">{e.license_plate}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(e.created_at)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={e.status} />
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatMoney(e.total)}
                    </TableCell>
                    <TableCell onClick={(ev) => ev.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" aria-label="Row actions">
                            <HugeiconsIcon icon={MoreHorizontalIcon} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => setDetailId(e.id)}>
                            View details
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => navigate(`/estimates/${e.id}/edit`)}>
                            <HugeiconsIcon icon={Edit02Icon} />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => setPendingDelete(e)}
                          >
                            <HugeiconsIcon icon={Delete02Icon} />
                            Delete
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuLabel>Set status</DropdownMenuLabel>
                          {ESTIMATE_STATUSES.map((s) => (
                            <DropdownMenuItem
                              key={s}
                              disabled={e.status === s}
                              onSelect={() => void changeStatus(e, s)}
                            >
                              {STATUS_LABEL[s]}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs uppercase tracking-widest text-muted-foreground">
          {total > 0
            ? `Page ${page} of ${totalPages} · ${total} total`
            : ""}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!canPrev || loading}
            onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
          >
            <HugeiconsIcon icon={ArrowLeft02Icon} />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!canNext || loading}
            onClick={() => setOffset((o) => o + PAGE_SIZE)}
          >
            Next
            <HugeiconsIcon icon={ArrowRight02Icon} />
          </Button>
        </div>
      </div>

      <EstimateDetailDialog
        estimate={data?.find((e) => e.id === detailId) ?? null}
        open={detailId !== null}
        onOpenChange={(open) => {
          if (!open) setDetailId(null)
        }}
        onEdit={(id) => {
          setDetailId(null)
          navigate(`/estimates/${id}/edit`)
        }}
      />

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open && !deleteEstimate.isPending) setPendingDelete(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete estimate?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete
                ? `Estimate #${pendingDelete.id} for ${pendingDelete.customer_name} (${pendingDelete.vehicle_make} ${pendingDelete.vehicle_model}) will be permanently removed. This cannot be undone.`
                : "This cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteEstimate.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteEstimate.isPending}
              onClick={(e) => {
                e.preventDefault()
                void confirmDelete()
              }}
            >
              {deleteEstimate.isPending ? "Deleting" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
