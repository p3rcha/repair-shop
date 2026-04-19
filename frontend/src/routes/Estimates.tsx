import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, MoreHorizontalIcon, RefreshIcon } from "@hugeicons/core-free-icons"

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

import { api, ApiError } from "@/lib/api"
import {
  ESTIMATE_STATUSES,
  STATUS_LABEL,
  type Estimate,
  type EstimateStatus,
} from "@/lib/types"
import { StatusBadge } from "@/components/StatusBadge"
import { EstimateDetailDialog } from "@/components/EstimateDetailDialog"

type Filter = EstimateStatus | "all"

const FILTERS: Filter[] = ["all", ...ESTIMATE_STATUSES]
const FILTER_LABEL: Record<Filter, string> = {
  all: "All statuses",
  ...STATUS_LABEL,
}

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
  const [filter, setFilter] = useState<Filter>("all")
  const [data, setData] = useState<Estimate[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [detailId, setDetailId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const qs = filter === "all" ? "" : `?status=${filter}`
      const list = await api.get<Estimate[]>(`/estimates${qs}`)
      setData(list)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to load estimates"
      setError(message)
      setData([])
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    void load()
  }, [load])

  async function changeStatus(estimate: Estimate, next: EstimateStatus) {
    if (estimate.status === next) return
    try {
      const updated = await api.patch<Estimate>(`/estimates/${estimate.id}/status`, {
        status: next,
      })
      setData((current) =>
        current ? current.map((e) => (e.id === updated.id ? updated : e)) : current,
      )
      toast.success(`Estimate #${estimate.id} → ${STATUS_LABEL[next]}`)
      if (filter !== "all" && updated.status !== filter) {
        setData((current) => (current ? current.filter((e) => e.id !== updated.id) : current))
      }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to update status"
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
            {loading ? "—" : `${data?.length ?? 0} ${(data?.length ?? 0) === 1 ? "result" : "results"}`}
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
          <Button variant="outline" size="sm" onClick={load} aria-label="Refresh">
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

      <EstimateDetailDialog
        estimate={data?.find((e) => e.id === detailId) ?? null}
        open={detailId !== null}
        onOpenChange={(open) => {
          if (!open) setDetailId(null)
        }}
      />
    </div>
  )
}
