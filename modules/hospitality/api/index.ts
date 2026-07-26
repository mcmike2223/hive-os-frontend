import api from "@/modules/shared/api/http";
import type {
  HospitalityLocation,
  HospitalityReservation,
  HospitalityServiceOrder,
  HospitalityCustomer,
  HospitalityEvent,
  HospitalityMenuItem,
  HospitalityOverview,
  HospitalityMenuCategory,
  HospitalityStaffShift,
  HospitalityWaitlistEntry,
  HospitalityFeedback,
  HospitalityZone,
} from "@/modules/hospitality/types";

type Paginated<T> = {
  data: T[];
};

const unwrapList = <T>(payload: unknown): T[] => {
  if (Array.isArray(payload)) {
    return payload as T[];
  }

  if (payload && typeof payload === "object" && Array.isArray((payload as Paginated<T>).data)) {
    return (payload as Paginated<T>).data;
  }

  return [];
};

export const fetchHospitalityOverview = async () =>
  (await api.get<HospitalityOverview>("/hospitality/overview")).data;

export const fetchHospitalityTables = async (params: Record<string, unknown> = {}) =>
  unwrapList<HospitalityLocation>((await api.get("/hospitality/tables", { params })).data);

export const createHospitalityTable = async (payload: Record<string, unknown>) =>
  (await api.post<HospitalityLocation>("/hospitality/tables", payload)).data;

export const updateHospitalityTable = async (id: number, payload: Record<string, unknown>) =>
  (await api.put<HospitalityLocation>(`/hospitality/tables/${id}`, payload)).data;

export const deleteHospitalityTable = async (id: number) =>
  (await api.delete(`/hospitality/tables/${id}`)).data;

export const fetchHospitalityReservations = async (params: Record<string, unknown> = {}) =>
  unwrapList<HospitalityReservation>((await api.get("/hospitality/reservations", { params })).data);

export const createHospitalityReservation = async (payload: Record<string, unknown>) =>
  (await api.post<HospitalityReservation>("/hospitality/reservations", payload)).data;

export const updateHospitalityReservation = async (id: number, payload: Record<string, unknown>) =>
  (await api.put<HospitalityReservation>(`/hospitality/reservations/${id}`, payload)).data;

export const fetchHospitalityServiceOrders = async (params: Record<string, unknown> = {}) =>
  unwrapList<HospitalityServiceOrder>((await api.get("/hospitality/service-orders", { params })).data);

export const createHospitalityServiceOrder = async (payload: Record<string, unknown>) =>
  (await api.post<HospitalityServiceOrder>("/hospitality/service-orders", payload)).data;

export const updateHospitalityServiceOrder = async (id: number, payload: Record<string, unknown>) =>
  (await api.put<HospitalityServiceOrder>(`/hospitality/service-orders/${id}`, payload)).data;

export const closeHospitalityServiceOrder = async (id: number) =>
  (await api.post<HospitalityServiceOrder>(`/hospitality/service-orders/${id}/close`)).data;

export const fetchHospitalityMenuItems = async (params: Record<string, unknown> = {}) =>
  unwrapList<HospitalityMenuItem>((await api.get("/hospitality/menu-items", { params })).data);

export const createHospitalityMenuItem = async (payload: Record<string, unknown>) =>
  (await api.post<HospitalityMenuItem>("/hospitality/menu-items", payload)).data;

export const updateHospitalityMenuItem = async (id: number, payload: Record<string, unknown>) =>
  (await api.put<HospitalityMenuItem>(`/hospitality/menu-items/${id}`, payload)).data;

export const deleteHospitalityMenuItem = async (id: number) =>
  (await api.delete(`/hospitality/menu-items/${id}`)).data;

export const fetchHospitalityMenuCategories = async (params: Record<string, unknown> = {}) =>
  unwrapList<HospitalityMenuCategory>((await api.get("/hospitality/menu-categories", { params })).data);

export const createHospitalityMenuCategory = async (payload: Record<string, unknown>) =>
  (await api.post<HospitalityMenuCategory>("/hospitality/menu-categories", payload)).data;

export const updateHospitalityMenuCategory = async (id: number, payload: Record<string, unknown>) =>
  (await api.put<HospitalityMenuCategory>(`/hospitality/menu-categories/${id}`, payload)).data;

export const deleteHospitalityMenuCategory = async (id: number) =>
  (await api.delete(`/hospitality/menu-categories/${id}`)).data;

export const fetchHospitalityStaffShifts = async (params: Record<string, unknown> = {}) =>
  unwrapList<HospitalityStaffShift>((await api.get("/hospitality/staff-shifts", { params })).data);

export const createHospitalityStaffShift = async (payload: Record<string, unknown>) =>
  (await api.post<HospitalityStaffShift>("/hospitality/staff-shifts", payload)).data;

export const updateHospitalityStaffShift = async (id: number, payload: Record<string, unknown>) =>
  (await api.put<HospitalityStaffShift>(`/hospitality/staff-shifts/${id}`, payload)).data;

export const deleteHospitalityStaffShift = async (id: number) =>
  (await api.delete(`/hospitality/staff-shifts/${id}`)).data;

export const fetchHospitalityEvents = async (params: Record<string, unknown> = {}) =>
  unwrapList<HospitalityEvent>((await api.get("/hospitality/events", { params })).data);

export const createHospitalityEvent = async (payload: Record<string, unknown>) =>
  (await api.post<HospitalityEvent>("/hospitality/events", payload)).data;

export const updateHospitalityEvent = async (id: number, payload: Record<string, unknown>) =>
  (await api.put<HospitalityEvent>(`/hospitality/events/${id}`, payload)).data;

export const deleteHospitalityEvent = async (id: number) =>
  (await api.delete(`/hospitality/events/${id}`)).data;

export const fetchHospitalityCustomers = async (params: Record<string, unknown> = {}) =>
  unwrapList<HospitalityCustomer>((await api.get("/hospitality/customers", { params })).data);

export const createHospitalityCustomer = async (payload: Record<string, unknown>) =>
  (await api.post<HospitalityCustomer>("/hospitality/customers", payload)).data;

export const updateHospitalityCustomer = async (id: number, payload: Record<string, unknown>) =>
  (await api.put<HospitalityCustomer>(`/hospitality/customers/${id}`, payload)).data;

export const deleteHospitalityCustomer = async (id: number) =>
  (await api.delete(`/hospitality/customers/${id}`)).data;

export const fetchHospitalityCustomerHistory = async (id: number) =>
  (await api.get(`/hospitality/customers/${id}/history`)).data;

export const fetchHospitalityWaitlist = async (params: Record<string, unknown> = {}) =>
  unwrapList<HospitalityWaitlistEntry>((await api.get("/hospitality/waitlist", { params })).data);

export const createHospitalityWaitlistEntry = async (payload: Record<string, unknown>) =>
  (await api.post<HospitalityWaitlistEntry>("/hospitality/waitlist", payload)).data;

export const updateHospitalityWaitlistEntry = async (id: number, payload: Record<string, unknown>) =>
  (await api.put<HospitalityWaitlistEntry>(`/hospitality/waitlist/${id}`, payload)).data;

export const seatHospitalityWaitlistEntry = async (id: number, location_id: number) =>
  (await api.post(`/hospitality/waitlist/${id}/seat`, { location_id })).data;

export const fetchHospitalityFeedback = async (params: Record<string, unknown> = {}) =>
  unwrapList<HospitalityFeedback>((await api.get("/hospitality/feedback", { params })).data);

export const updateHospitalityFeedback = async (id: number, payload: Record<string, unknown>) =>
  (await api.put<HospitalityFeedback>(`/hospitality/feedback/${id}`, payload)).data;

export const deleteHospitalityFeedback = async (id: number) =>
  (await api.delete(`/hospitality/feedback/${id}`)).data;


export const splitHospitalityBill = async (orderId: number, payload: Record<string, unknown>) =>
  (await api.post(`/hospitality/service-orders/${orderId}/split-bill`, payload)).data;

export const closeHospitalityOrder = async (orderId: number) =>
  (await api.post(`/hospitality/service-orders/${orderId}/close`)).data;

export const fetchHospitalityBills = async (orderId: number) =>
  (await api.get(`/hospitality/service-orders/${orderId}/bills`)).data;
export const fetchFloorPlan = async (params: Record<string, unknown> = {}) =>
  (await api.get("/hospitality/space/zones", { params })).data;

export const updateLocationStatus = async (id: number, status: string) =>
  (await api.patch(`/hospitality/space/locations/${id}/status`, { status })).data;

export const fetchHospitalityZones = async (params: Record<string, unknown> = {}) =>
  unwrapList<HospitalityZone>((await api.get("/hospitality/zones", { params })).data);

export const createHospitalityZone = async (payload: Record<string, unknown>) =>
  (await api.post<HospitalityZone>("/hospitality/zones", payload)).data;

export const updateHospitalityZone = async (id: number, payload: Record<string, unknown>) =>
  (await api.put<HospitalityZone>(`/hospitality/zones/${id}`, payload)).data;

export const deleteHospitalityZone = async (id: number) =>
  (await api.delete(`/hospitality/zones/${id}`)).data;

export const fetchGuestList = async () =>
  (await api.get("/hospitality/door/guest-list")).data;

export const guestCheckIn = async (id: number, actual_arrived_count: number) =>
  (await api.post(`/hospitality/door/check-in/${id}`, { actual_arrived_count })).data;
