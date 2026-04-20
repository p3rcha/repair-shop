import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"

import { api } from "./api"
import type {
  Category,
  Estimate,
  EstimateCreate,
  EstimateStatus,
  Item,
  PaginatedEstimates,
} from "./types"

export const queryKeys = {
  estimates: (params: EstimatesParams) => ["estimates", params] as const,
  estimate: (id: number) => ["estimates", "detail", id] as const,
  categories: ["categories"] as const,
  categoryItems: (id: number) => ["categories", id, "items"] as const,
}

export type EstimatesParams = {
  status: EstimateStatus | "all"
  limit: number
  offset: number
}

function buildEstimatesPath({ status, limit, offset }: EstimatesParams) {
  const params = new URLSearchParams()
  if (status !== "all") params.set("status", status)
  params.set("limit", String(limit))
  params.set("offset", String(offset))
  const qs = params.toString()
  return qs ? `/estimates?${qs}` : "/estimates"
}

export function useEstimates(params: EstimatesParams) {
  return useQuery({
    queryKey: queryKeys.estimates(params),
    queryFn: () => api.get<PaginatedEstimates>(buildEstimatesPath(params)),
    placeholderData: (prev) => prev,
  })
}

export function useUpdateEstimateStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: EstimateStatus }) =>
      api.patch<Estimate>(`/estimates/${id}/status`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["estimates"] })
    },
  })
}

export function useCreateEstimate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: EstimateCreate) =>
      api.post<Estimate>("/estimates", payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["estimates"] })
    },
  })
}

export function useEstimate(id: number | null) {
  return useQuery({
    queryKey: id == null ? ["estimates", "detail", "none"] : queryKeys.estimate(id),
    queryFn: () => api.get<Estimate>(`/estimates/${id}`),
    enabled: id != null,
  })
}

export function useUpdateEstimate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: EstimateCreate }) =>
      api.put<Estimate>(`/estimates/${id}`, payload),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["estimates"] })
      qc.setQueryData(queryKeys.estimate(data.id), data)
    },
  })
}

export function useDeleteEstimate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.del<void>(`/estimates/${id}`),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ["estimates"] })
      qc.removeQueries({ queryKey: queryKeys.estimate(id) })
    },
  })
}

export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories,
    queryFn: () => api.get<Category[]>("/categories"),
    staleTime: 5 * 60 * 1000,
  })
}

export function useCategoryItems(categoryId: number | null) {
  return useQuery({
    queryKey: categoryId == null ? ["categories", "items", "none"] : queryKeys.categoryItems(categoryId),
    queryFn: () => api.get<Item[]>(`/categories/${categoryId}/items`),
    enabled: categoryId != null,
    staleTime: 60 * 1000,
  })
}
