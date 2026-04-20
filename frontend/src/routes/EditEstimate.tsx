import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowLeft02Icon,
  PlusSignIcon,
  MinusSignIcon,
  Cancel01Icon,
} from "@hugeicons/core-free-icons"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
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
import { YearCombobox } from "@/components/YearCombobox"

import { ApiError } from "@/lib/api"
import {
  useCategories,
  useCategoryItems,
  useEstimate,
  useUpdateEstimate,
} from "@/lib/queries"
import { getCategoryIcon } from "@/lib/category-icons"
import { cn } from "@/lib/utils"
import type { EstimateCreate, Item } from "@/lib/types"

const CURRENT_YEAR = new Date().getFullYear()
const YEAR_OPTIONS = Array.from({ length: CURRENT_YEAR - 1969 }, (_, i) =>
  String(CURRENT_YEAR - i),
)

const customerSchema = z.object({
  customer_name: z.string().min(1, "Required"),
  vehicle_make: z.string().min(1, "Required"),
  vehicle_model: z.string().min(1, "Required"),
  vehicle_year: z
    .string()
    .optional()
    .transform((v) => {
      if (!v) return null
      const n = Number(v)
      return Number.isFinite(n) ? n : null
    }),
  license_plate: z
    .string()
    .max(20)
    .optional()
    .transform((v) => v?.trim() || null),
})

type CustomerForm = z.input<typeof customerSchema>
type CustomerFormParsed = z.output<typeof customerSchema>

type CartLine = { item: Item; quantity: number }

type Snapshot = {
  customer: Required<CustomerForm>
  cart: Record<number, CartLine>
}

function formatMoney(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" })
}

function emptyCustomer(): Required<CustomerForm> {
  return {
    customer_name: "",
    vehicle_make: "",
    vehicle_model: "",
    vehicle_year: "",
    license_plate: "",
  }
}

export function EditEstimate() {
  const navigate = useNavigate()
  const params = useParams<{ id: string }>()
  const idNum = params.id ? Number(params.id) : NaN
  const estimateId = Number.isFinite(idNum) ? idNum : null

  const estimateQuery = useEstimate(estimateId)
  const estimate = estimateQuery.data ?? null
  const estimateLoading = estimateQuery.isLoading

  const categoriesQuery = useCategories()
  const categories = categoriesQuery.data ?? null
  const categoriesLoading = categoriesQuery.isLoading

  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null)
  const itemsQuery = useCategoryItems(activeCategoryId)
  const items = itemsQuery.data ?? null
  const itemsLoading = itemsQuery.isFetching && activeCategoryId != null

  const [cart, setCart] = useState<Record<number, CartLine>>({})
  const updateEstimate = useUpdateEstimate()
  const submitting = updateEstimate.isPending

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingPayload, setPendingPayload] = useState<EstimateCreate | null>(null)

  const form = useForm<CustomerForm>({
    resolver: zodResolver(customerSchema) as never,
    defaultValues: emptyCustomer(),
  })

  const hydratedRef = useRef(false)
  const initialRef = useRef<Snapshot | null>(null)

  useEffect(() => {
    if (!estimate || hydratedRef.current) return
    const customer: Required<CustomerForm> = {
      customer_name: estimate.customer_name,
      vehicle_make: estimate.vehicle_make,
      vehicle_model: estimate.vehicle_model,
      vehicle_year: estimate.vehicle_year != null ? String(estimate.vehicle_year) : "",
      license_plate: estimate.license_plate ?? "",
    }
    form.reset(customer)

    const nextCart: Record<number, CartLine> = {}
    for (const line of estimate.items) {
      nextCart[line.item_id] = {
        item: {
          id: line.item_id,
          name: line.item_name,
          base_price: line.unit_price,
        },
        quantity: line.quantity,
      }
    }
    setCart(nextCart)

    initialRef.current = {
      customer,
      cart: structuredClone(nextCart),
    }
    hydratedRef.current = true
  }, [estimate, form])

  useEffect(() => {
    if (estimateQuery.error) {
      const message =
        estimateQuery.error instanceof ApiError
          ? estimateQuery.error.message
          : "Failed to load estimate"
      toast.error(message)
      navigate("/estimates")
    }
  }, [estimateQuery.error, navigate])

  useEffect(() => {
    if (categoriesQuery.error) {
      toast.error(
        categoriesQuery.error instanceof ApiError
          ? categoriesQuery.error.message
          : "Failed to load categories",
      )
    }
  }, [categoriesQuery.error])

  useEffect(() => {
    if (itemsQuery.error) {
      toast.error(
        itemsQuery.error instanceof ApiError
          ? itemsQuery.error.message
          : "Failed to load items",
      )
    }
  }, [itemsQuery.error])

  function bumpQuantity(item: Item, delta: number) {
    setCart((current) => {
      const existing = current[item.id]
      const next = (existing?.quantity ?? 0) + delta
      if (next <= 0) {
        const { [item.id]: _removed, ...rest } = current
        return rest
      }
      const isAddon = Number(item.base_price) === 0
      const capped = isAddon ? Math.min(next, 1) : next
      return { ...current, [item.id]: { item, quantity: capped } }
    })
  }

  function removeFromCart(itemId: number) {
    setCart((current) => {
      const { [itemId]: _removed, ...rest } = current
      return rest
    })
  }

  const cartLines = Object.values(cart)
  const grandTotal = cartLines.reduce(
    (sum, line) => sum + Number(line.item.base_price) * line.quantity,
    0,
  )

  const dirty = useMemo(() => {
    const init = initialRef.current
    if (!init) return false
    const cur = form.watch()
    if (cur.customer_name !== init.customer.customer_name) return true
    if (cur.vehicle_make !== init.customer.vehicle_make) return true
    if (cur.vehicle_model !== init.customer.vehicle_model) return true
    if ((cur.vehicle_year ?? "") !== init.customer.vehicle_year) return true
    if ((cur.license_plate ?? "") !== init.customer.license_plate) return true
    const curIds = Object.keys(cart)
      .map(Number)
      .sort((a, b) => a - b)
    const initIds = Object.keys(init.cart)
      .map(Number)
      .sort((a, b) => a - b)
    if (curIds.length !== initIds.length) return true
    if (curIds.some((id, idx) => id !== initIds[idx])) return true
    return curIds.some((id) => cart[id].quantity !== init.cart[id].quantity)
    // form.watch() must be in deps so re-renders trigger this memo on field changes
  }, [cart, form, form.watch()])

  function buildPayload(rawValues: CustomerForm): EstimateCreate {
    const values = customerSchema.parse(rawValues) as CustomerFormParsed
    return {
      customer_name: values.customer_name,
      vehicle_make: values.vehicle_make,
      vehicle_model: values.vehicle_model,
      vehicle_year: values.vehicle_year,
      license_plate: values.license_plate,
      items: cartLines.map((l) => ({ item_id: l.item.id, quantity: l.quantity })),
    }
  }

  function onSubmit(rawValues: CustomerForm) {
    if (cartLines.length === 0) {
      toast.error("Add at least one item")
      return
    }
    if (!dirty) {
      toast.message("No changes to save")
      return
    }
    const payload = buildPayload(rawValues)
    setPendingPayload(payload)
    setConfirmOpen(true)
  }

  async function confirmSave() {
    if (!estimateId || !pendingPayload) return
    try {
      const updated = await updateEstimate.mutateAsync({
        id: estimateId,
        payload: pendingPayload,
      })
      toast.success(`Estimate #${updated.id} updated · ${formatMoney(Number(updated.total))}`)
      setConfirmOpen(false)
      setPendingPayload(null)
      navigate("/estimates")
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to update estimate"
      toast.error(message)
    }
  }

  if (estimateLoading || !hydratedRef.current) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="flex flex-col gap-6 lg:col-span-2">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
          <Skeleton className="h-80 w-full" />
        </div>
      </div>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
              Edit estimate
            </h2>
            <p className="font-heading text-2xl">
              Estimate #{estimate?.id}
            </p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <HugeiconsIcon icon={ArrowLeft02Icon} />
            Back
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="flex flex-col gap-6 lg:col-span-2">
            <Card>
              <CardHeader>
                <h3 className="text-xs uppercase tracking-widest text-muted-foreground">
                  Customer & vehicle
                </h3>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="customer_name"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Customer name</FormLabel>
                      <FormControl>
                        <Input placeholder="Juan Santamaria" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="vehicle_make"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Make</FormLabel>
                      <FormControl>
                        <Input placeholder="Toyota" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="vehicle_model"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Model</FormLabel>
                      <FormControl>
                        <Input placeholder="Tercel" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="vehicle_year"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Year</FormLabel>
                      <FormControl>
                        <YearCombobox
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          options={YEAR_OPTIONS}
                          placeholder="Type or pick a year"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="license_plate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>License plate</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="ABC123"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h3 className="text-xs uppercase tracking-widest text-muted-foreground">
                  Categories
                </h3>
              </CardHeader>
              <CardContent>
                {categoriesLoading && (
                  <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <Skeleton key={i} className="h-20 w-full" />
                    ))}
                  </div>
                )}
                {!categoriesLoading && (
                  <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                    {categories?.map((c) => {
                      const Icon = getCategoryIcon(c.icon)
                      const active = c.id === activeCategoryId
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setActiveCategoryId(active ? null : c.id)}
                          className={cn(
                            "flex items-center gap-3 border border-border bg-background px-4 py-3 text-left text-sm transition-colors hover:bg-muted",
                            active && "border-primary bg-primary/10 hover:bg-primary/15",
                          )}
                        >
                          <span
                            className={cn(
                              "grid size-10 place-items-center border border-border text-muted-foreground",
                              active && "border-primary text-primary",
                            )}
                          >
                            <HugeiconsIcon icon={Icon} strokeWidth={1.6} className="size-5" />
                          </span>
                          <span className="text-xs font-semibold uppercase tracking-widest">
                            {c.name}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {activeCategoryId != null && (
              <Card>
                <CardHeader>
                  <h3 className="text-xs uppercase tracking-widest text-muted-foreground">
                    Items
                  </h3>
                </CardHeader>
                <CardContent className="flex flex-col">
                  {itemsLoading &&
                    Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="flex items-center justify-between gap-4 py-3">
                        <div className="flex flex-col gap-2">
                          <Skeleton className="h-4 w-48" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                        <Skeleton className="h-9 w-32" />
                      </div>
                    ))}

                  {!itemsLoading && items && items.length === 0 && (
                    <p className="py-8 text-center text-xs uppercase tracking-widest text-muted-foreground">
                      No items in this category
                    </p>
                  )}

                  {!itemsLoading &&
                    items?.map((item, idx) => {
                      const inCart = cart[item.id]?.quantity ?? 0
                      const isAddon = Number(item.base_price) === 0
                      return (
                        <div key={item.id}>
                          {idx > 0 && <Separator />}
                          <div className="flex items-center justify-between gap-4 py-3">
                            <div className="flex flex-col">
                              <span className="text-sm font-medium">{item.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {isAddon
                                  ? "Add-on · once per estimate"
                                  : formatMoney(Number(item.base_price))}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                size="icon-sm"
                                variant="outline"
                                onClick={() => bumpQuantity(item, -1)}
                                disabled={inCart === 0}
                              >
                                <HugeiconsIcon icon={MinusSignIcon} />
                              </Button>
                              <span className="min-w-8 text-center text-sm tabular-nums">
                                {inCart}
                              </span>
                              <Button
                                type="button"
                                size="icon-sm"
                                variant="outline"
                                onClick={() => bumpQuantity(item, 1)}
                                disabled={isAddon && inCart >= 1}
                              >
                                <HugeiconsIcon icon={PlusSignIcon} />
                              </Button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                </CardContent>
              </Card>
            )}
          </div>

          <div className="lg:col-span-1">
            <Card className="lg:sticky lg:top-6">
              <CardHeader>
                <h3 className="text-xs uppercase tracking-widest text-muted-foreground">
                  Cart
                </h3>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {cartLines.length === 0 && (
                  <p className="py-8 text-center text-xs uppercase tracking-widest text-muted-foreground">
                    Pick items to start the estimate
                  </p>
                )}

                {cartLines.map((line, idx) => {
                  const lineTotal = Number(line.item.base_price) * line.quantity
                  return (
                    <div key={line.item.id}>
                      {idx > 0 && <Separator />}
                      <div className="flex items-start justify-between gap-3 py-2">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium leading-tight">
                            {line.item.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {line.quantity} × {formatMoney(Number(line.item.base_price))}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium tabular-nums">
                            {formatMoney(lineTotal)}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => removeFromCart(line.item.id)}
                            aria-label="Remove"
                          >
                            <HugeiconsIcon icon={Cancel01Icon} />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })}

                {cartLines.length > 0 && (
                  <>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <span className="text-xs uppercase tracking-widest text-muted-foreground">
                        Total
                      </span>
                      <span className="font-heading text-2xl tabular-nums">
                        {formatMoney(grandTotal)}
                      </span>
                    </div>
                  </>
                )}

                <Button
                  type="submit"
                  disabled={cartLines.length === 0 || !dirty || submitting}
                  className="w-full"
                >
                  {submitting ? "Saving" : dirty ? "Save changes" : "No changes"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Save changes?</AlertDialogTitle>
              <AlertDialogDescription>
                This will overwrite estimate #{estimate?.id} with the current customer,
                vehicle, and line items. The status and creation date will not change.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault()
                  void confirmSave()
                }}
                disabled={submitting}
              >
                {submitting ? "Saving" : "Save changes"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </form>
    </Form>
  )
}
