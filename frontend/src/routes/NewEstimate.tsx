import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
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
import { YearCombobox } from "@/components/YearCombobox"

import { api, ApiError } from "@/lib/api"
import { getCategoryIcon } from "@/lib/category-icons"
import { cn } from "@/lib/utils"
import type { Category, Estimate, EstimateCreate, Item } from "@/lib/types"

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

function formatMoney(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" })
}

const DRAFT_STORAGE_KEY = "repair-shop:estimate-draft:v1"

type EstimateDraft = {
  customer: CustomerForm
  cart: Record<number, CartLine>
  activeCategoryId: number | null
}

function loadDraft(): EstimateDraft | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<EstimateDraft>
    if (!parsed || typeof parsed !== "object") return null
    return {
      customer: parsed.customer ?? {
        customer_name: "",
        vehicle_make: "",
        vehicle_model: "",
        vehicle_year: "",
        license_plate: "",
      },
      cart: parsed.cart ?? {},
      activeCategoryId: parsed.activeCategoryId ?? null,
    }
  } catch {
    return null
  }
}

function saveDraft(draft: EstimateDraft) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft))
  } catch {
    // ignore quota or serialization errors
  }
}

function clearDraft() {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(DRAFT_STORAGE_KEY)
  } catch {
    // ignore
  }
}

export function NewEstimate() {
  const navigate = useNavigate()

  const [draft] = useState(() => loadDraft())

  const [categories, setCategories] = useState<Category[] | null>(null)
  const [categoriesLoading, setCategoriesLoading] = useState(true)

  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(
    draft?.activeCategoryId ?? null,
  )
  const [items, setItems] = useState<Item[] | null>(null)
  const [itemsLoading, setItemsLoading] = useState(false)

  const [cart, setCart] = useState<Record<number, CartLine>>(
    () => draft?.cart ?? {},
  )
  const [submitting, setSubmitting] = useState(false)

  const form = useForm<CustomerForm>({
    resolver: zodResolver(customerSchema) as never,
    defaultValues: draft?.customer ?? {
      customer_name: "",
      vehicle_make: "",
      vehicle_model: "",
      vehicle_year: "",
      license_plate: "",
    },
  })

  useEffect(() => {
    const persist = () =>
      saveDraft({
        customer: form.getValues(),
        cart,
        activeCategoryId,
      })
    persist()
    const sub = form.watch(() => persist())
    return () => sub.unsubscribe()
  }, [form, cart, activeCategoryId])

  useEffect(() => {
    setCategoriesLoading(true)
    api
      .get<Category[]>("/categories")
      .then(setCategories)
      .catch((err) => {
        toast.error(err instanceof ApiError ? err.message : "Failed to load categories")
        setCategories([])
      })
      .finally(() => setCategoriesLoading(false))
  }, [])

  useEffect(() => {
    if (activeCategoryId == null) {
      setItems(null)
      return
    }
    let cancelled = false
    setItemsLoading(true)
    setItems(null)
    api
      .get<Item[]>(`/categories/${activeCategoryId}/items`)
      .then((list) => {
        if (!cancelled) setItems(list)
      })
      .catch((err) => {
        toast.error(err instanceof ApiError ? err.message : "Failed to load items")
        if (!cancelled) setItems([])
      })
      .finally(() => {
        if (!cancelled) setItemsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [activeCategoryId])

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

  async function onSubmit(rawValues: CustomerForm) {
    const values = rawValues as unknown as CustomerFormParsed
    if (cartLines.length === 0) {
      toast.error("Add at least one item")
      return
    }
    setSubmitting(true)
    try {
      const payload: EstimateCreate = {
        customer_name: values.customer_name,
        vehicle_make: values.vehicle_make,
        vehicle_model: values.vehicle_model,
        vehicle_year: values.vehicle_year,
        license_plate: values.license_plate,
        items: cartLines.map((l) => ({ item_id: l.item.id, quantity: l.quantity })),
      }
      const created = await api.post<Estimate>("/estimates", payload)
      clearDraft()
      toast.success(`Estimate #${created.id} created · ${formatMoney(Number(created.total))}`)
      navigate("/estimates")
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to create estimate"
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
              New estimate
            </h2>
            <p className="font-heading text-2xl">Build a repair order</p>
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
                  disabled={cartLines.length === 0 || submitting}
                  className="w-full"
                >
                  {submitting ? "Creating" : "Create estimate"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </Form>
  )
}
