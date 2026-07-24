import api from "@/modules/shared/api/http";
import type {
  BarcodePayload,
  InventoryEntityRecord,
  InventoryItem,
  PaginatedQaBatchResults,
  PaginatedResponse,
  ProductCategory,
  ProductDetailResponse,
  ProductOptionsResponse,
  ProductRecord,
  ProductSummaryResponse,
  Supplier,
  SupplierDetail,
  Tag,
  QaProtocol,
  CoAResponse,
} from "@/modules/inventory/types";

type ListParams = Record<string, unknown>;
type MultipartPayload = Record<string, unknown> | FormData;

const isFormData = (payload: MultipartPayload): payload is FormData => payload instanceof FormData;

export const fetchInventoryProductSummary = async () =>
  (await api.get<ProductSummaryResponse>("/inventory/products/summary")).data;

export const fetchInventoryProductOptions = async (excludeProductId?: number) =>
  (
    await api.get<ProductOptionsResponse>("/inventory/products/options", {
      params: excludeProductId ? { exclude_product_id: excludeProductId } : undefined,
    })
  ).data;

export const generateInventoryBarcode = async (prefix?: string) =>
  (
    await api.post<BarcodePayload>("/inventory/products/generate-barcode", {
      prefix,
    })
  ).data;

export const fetchInventoryProductCategories = async (params: ListParams = {}) =>
  (
    await api.get<PaginatedResponse<ProductCategory>>("/inventory/product-categories", {
      params,
    })
  ).data;

export const fetchInventoryCategories = async (params: ListParams = {}) =>
  (
    await api.get<any>("/inventory/categories", {
      params,
    })
  ).data;

export const createInventoryCategory = async (payload: Record<string, unknown>) =>
  (await api.post<any>("/inventory/categories", payload)).data;

export const updateInventoryCategory = async (id: number, payload: Record<string, unknown>) =>
  (await api.patch<any>(`/inventory/categories/${id}`, payload)).data;

export const deleteInventoryCategory = async (id: number) =>
  (await api.delete(`/inventory/categories/${id}`)).data;

export const createInventoryProductCategory = async (payload: Record<string, unknown>) =>
  (await api.post<ProductCategory>("/inventory/product-categories", payload)).data;

export const updateInventoryProductCategory = async (id: number, payload: Record<string, unknown>) =>
  (await api.patch<ProductCategory>(`/inventory/product-categories/${id}`, payload)).data;

export const deleteInventoryProductCategory = async (id: number) =>
  (await api.delete(`/inventory/product-categories/${id}`)).data;

export const fetchInventoryTags = async (params: ListParams = {}) =>
  (
    await api.get<PaginatedResponse<Tag>>("/inventory/tags", {
      params,
    })
  ).data;

export const createInventoryTag = async (payload: Record<string, unknown>) =>
  (await api.post<Tag>("/inventory/tags", payload)).data;

export const updateInventoryTag = async (id: number, payload: Record<string, unknown>) =>
  (await api.patch<Tag>(`/inventory/tags/${id}`, payload)).data;

export const deleteInventoryTag = async (id: number) =>
  (await api.delete(`/inventory/tags/${id}`)).data;

export const fetchInventorySuppliers = async (params: ListParams = {}) =>
  (
    await api.get<PaginatedResponse<Supplier>>("/inventory/suppliers", {
      params,
    })
  ).data;

export const fetchInventorySupplier = async (id: number) =>
  (await api.get<SupplierDetail>(`/inventory/suppliers/${id}`)).data;

export const createInventorySupplier = async (payload: Record<string, unknown>) =>
  (await api.post<Supplier>("/inventory/suppliers", payload)).data;

export const updateInventorySupplier = async (id: number, payload: Record<string, unknown>) =>
  (await api.patch<Supplier>(`/inventory/suppliers/${id}`, payload)).data;

export const deactivateInventorySupplier = async (id: number) =>
  (await api.post<Supplier>(`/inventory/suppliers/${id}/deactivate`)).data;

export const deleteInventorySupplier = async (id: number) =>
  (await api.delete(`/inventory/suppliers/${id}`)).data;

export const fetchInventoryEntityRecords = async (resource: string, params: ListParams = {}) =>
  (
    await api.get<PaginatedResponse<InventoryEntityRecord>>(`/inventory/${resource}`, {
      params,
    })
  ).data;

export const createInventoryEntityRecord = async (resource: string, payload: Record<string, unknown> | FormData) =>
  (await api.post<InventoryEntityRecord>(`/inventory/${resource}`, payload)).data;

export const updateInventoryEntityRecord = async (
  resource: string,
  id: number,
  payload: Record<string, unknown> | FormData
) => (await api.patch<InventoryEntityRecord>(`/inventory/${resource}/${id}`, payload)).data;

export const deleteInventoryEntityRecord = async (resource: string, id: number) =>
  (await api.delete(`/inventory/${resource}/${id}`)).data;

export const assignInventoryShelfBox = async (
  id: number,
  payload: {
    storable_type: string;
    storable_id: number;
    notes?: string;
  }
) => (await api.post(`/inventory/shelf-boxes/${id}/assign`, payload)).data;

export const fetchInventoryItems = async (params: ListParams = {}) =>
  (
    await api.get<PaginatedResponse<InventoryItem>>("/inventory/items", {
      params,
    })
  ).data;

export const createInventoryItem = async (payload: Record<string, unknown>) =>
  (await api.post<InventoryItem>("/inventory/items", payload)).data;

export const updateInventoryItem = async (id: number, payload: Record<string, unknown>) =>
  (await api.patch<InventoryItem>(`/inventory/items/${id}`, payload)).data;

export const deleteInventoryItem = async (id: number) =>
  (await api.delete(`/inventory/items/${id}`)).data;

export const adjustInventoryItemStock = async (id: number, payload: Record<string, unknown>) =>
  (await api.post(`/inventory/items/${id}/adjust-stock`, payload)).data;

export const fetchInventoryProducts = async (params: ListParams = {}) =>
  (
    await api.get<PaginatedResponse<ProductRecord>>("/inventory/products", {
      params,
    })
  ).data;

export const fetchInventoryProduct = async (id: number) =>
  (await api.get<ProductDetailResponse>(`/inventory/products/${id}`)).data;

export const createInventoryProduct = async (payload: MultipartPayload) =>
  (
    await api.post<ProductRecord>("/inventory/products", payload)
  ).data;

export const updateInventoryProduct = async (id: number, payload: MultipartPayload) => {
  if (isFormData(payload)) {
    return (await api.post<ProductRecord>(`/inventory/products/${id}?_method=PATCH`, payload)).data;
  }

  return (await api.patch<ProductRecord>(`/inventory/products/${id}`, payload)).data;
};

export const deleteInventoryProduct = async (id: number) =>
  (await api.delete(`/inventory/products/${id}`)).data;

export const bulkDeleteInventoryProducts = async (ids: number[]) =>
  (
    await api.post<{ deleted_count: number }>("/inventory/products/bulk-delete", {
      ids,
    })
  ).data;

export const bulkUpdateInventoryProductsStatus = async (
  ids: number[],
  status: "draft" | "published" | "archived"
) =>
  (
    await api.post<{ updated_count: number; status: "draft" | "published" | "archived" }>(
      "/inventory/products/bulk-status",
      {
        ids,
        status,
      }
    )
  ).data;

export const syncInventoryProductTags = async (productId: number, tagIds: number[]) =>
  (
    await api.post<ProductRecord>(`/inventory/products/${productId}/tags`, {
      tag_ids: tagIds,
    })
  ).data;

export type ShelfBoxOption = { id: number; name: string };

export const fetchShelfBoxOptions = async () =>
  (await api.get<ShelfBoxOption[]>("/inventory/shelf-boxes/options")).data;

export const assignProductToShelf = async (productId: number, shelfBoxId: number) =>
  (
    await api.post<{ message: string; product: ProductRecord }>(
      `/inventory/products/${productId}/assign-shelf`,
      { shelf_box_id: shelfBoxId }
    )
  ).data;

export const fetchInventoryQaProtocols = async () =>
  (await api.get<QaProtocol[]>("/inventory/qa-protocols")).data;

export const recordInventoryBatchQaResults = async (
  batchId: number,
  payload: {
    results: Record<string, string | number>;
    notes?: string;
    tested_at?: string;
    sample_size?: number;
  }
) => (await api.post(`/inventory/product-batches/${batchId}/qa-results`, payload)).data;

export const fetchInventoryBatchCoa = async (batchId: number) =>
  (await api.get<CoAResponse>(`/inventory/product-batches/${batchId}/coa`)).data;

export const fetchInventoryBatchQaResults = async (batchId: number) =>
  (await api.get<PaginatedQaBatchResults>(`/inventory/product-batches/${batchId}/qa-results`)).data;

export const fetchInventoryDocuments = async (params: ListParams = {}) =>
  (await api.get<PaginatedResponse<any>>("/inventory/documents", { params })).data;

export const fetchInventoryDocument = async (id: number) =>
  (await api.get<any>(`/inventory/documents/${id}`)).data;

export const createInventoryDocument = async (payload: Record<string, unknown>) =>
  (await api.post<any>("/inventory/documents", payload)).data;

export const runInventoryDocumentAction = async (
  id: number,
  action: string,
  payload: Record<string, unknown> = {}
) => (await api.post<any>(`/inventory/documents/${id}/actions/${action}`, payload)).data;
