export const ESTIMATE_STATUSES = ["pending", "in_progress", "completed"] as const
export type EstimateStatus = (typeof ESTIMATE_STATUSES)[number]

export const STATUS_LABEL: Record<EstimateStatus, string> = {
  pending: "Pending",
  in_progress: "In progress",
  completed: "Completed",
}

export type Category = {
  id: number
  name: string
  slug: string
  icon: string
}

export type Item = {
  id: number
  name: string
  base_price: string
}

export type EstimateLineItem = {
  id: number
  item_id: number
  item_name: string
  quantity: number
  unit_price: string
}

export type Estimate = {
  id: number
  customer_name: string
  vehicle_make: string
  vehicle_model: string
  vehicle_year: number | null
  license_plate: string | null
  status: EstimateStatus
  total: string
  created_at: string
  items: EstimateLineItem[]
}

export type EstimateCreate = {
  customer_name: string
  vehicle_make: string
  vehicle_model: string
  vehicle_year?: number | null
  license_plate?: string | null
  items: { item_id: number; quantity: number }[]
}
