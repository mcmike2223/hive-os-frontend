import http from "../shared/api/http";
import type { Warehouse, WarehouseLocation, WarehouseStock } from "./types";

const BASE_URL = "warehouse";

export const warehouseApi = {
    // Warehouses
    listWarehouses: (params?: Record<string, any>) => http.get(`${BASE_URL}/warehouses`, { params }),
    getWarehouse: (id: number) => http.get(`${BASE_URL}/warehouses/${id}`),
    createWarehouse: (data: Partial<Warehouse>) => http.post(`${BASE_URL}/warehouses`, data),
    updateWarehouse: (id: number, data: Partial<Warehouse>) => http.put(`${BASE_URL}/warehouses/${id}`, data),
    deleteWarehouse: (id: number) => http.delete(`${BASE_URL}/warehouses/${id}`),

    // Locations
    listLocations: (params?: Record<string, any>) => http.get(`${BASE_URL}/locations`, { params }),
    getLocation: (id: number) => http.get(`${BASE_URL}/locations/${id}`),
    createLocation: (data: Partial<WarehouseLocation>) => http.post(`${BASE_URL}/locations`, data),
    updateLocation: (id: number, data: Partial<WarehouseLocation>) => http.put(`${BASE_URL}/locations/${id}`, data),
    deleteLocation: (id: number) => http.delete(`${BASE_URL}/locations/${id}`),

    // Stocks
    listStocks: (params?: Record<string, any>) => http.get(`${BASE_URL}/stocks`, { params }),
    listMovements: (params?: Record<string, any>) => http.get(`${BASE_URL}/stocks/movements`, { params }),
    createMovement: (data: Record<string, unknown>) => http.post(`${BASE_URL}/stocks/movements`, data),
};
