/**
 * Fleet types (proposal §5.9).
 *
 * Decimal casts arrive as strings over JSON, so anything numeric is typed
 * `Numeric` and coerced at the render boundary.
 */

export type Numeric = number | string | null;

export type Paginated<T> = {
  status: string;
  data: T[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
};

export type VehicleStatus = "active" | "in_service" | "grounded" | "disposed";

export type FleetVehicle = {
  id: number;
  code: string;
  registration: string;
  name: string | null;
  type: string;
  make: string | null;
  model: string | null;
  year: number | null;
  vin: string | null;
  fuel_type: string;
  tank_capacity_litres: Numeric;
  current_odometer_km: Numeric;
  assigned_driver_id: number | null;
  home_warehouse_id: number | null;
  ownership: string;
  acquired_on: string | null;
  purchase_cost: Numeric;
  status: VehicleStatus;
  notes: string | null;
  is_roadworthy?: boolean;
  driver?: FleetDriver;
  documents?: FleetDocument[];
  service_schedules?: FleetServiceSchedule[];
};

export type FleetDriver = {
  id: number;
  employee_id: number | null;
  name: string;
  phone: string | null;
  licence_number: string | null;
  licence_class: string | null;
  licence_expires_on: string | null;
  medical_expires_on: string | null;
  status: string;
  notes: string | null;
  licence_valid?: boolean;
  days_to_licence_expiry?: number | null;
};

export type FleetAssignment = {
  id: number;
  vehicle_id: number;
  driver_id: number;
  starts_on: string;
  ends_on: string | null;
  notes: string | null;
  vehicle?: FleetVehicle;
  driver?: FleetDriver;
};

export type TripStatus = "planned" | "in_progress" | "completed" | "cancelled";

export type FleetTrip = {
  id: number;
  trip_number: string;
  vehicle_id: number;
  driver_id: number | null;
  purpose: string | null;
  origin: string | null;
  destination: string | null;
  departed_at: string | null;
  returned_at: string | null;
  start_odometer_km: Numeric;
  end_odometer_km: Numeric;
  distance_km: Numeric;
  status: TripStatus;
  shipment_id: number | null;
  notes: string | null;
  duration_hours?: Numeric;
  vehicle?: FleetVehicle;
  driver?: FleetDriver;
};

export type FleetFuelLog = {
  id: number;
  vehicle_id: number;
  driver_id: number | null;
  trip_id: number | null;
  filled_on: string;
  litres: Numeric;
  cost_per_litre: Numeric;
  total_cost: Numeric;
  odometer_km: Numeric;
  is_full_tank: boolean;
  /** Null whenever the tank-to-tank pairing was not available. */
  efficiency_km_per_litre: Numeric;
  station: string | null;
  reference: string | null;
  vehicle?: FleetVehicle;
  driver?: FleetDriver;
};

export type FleetServiceSchedule = {
  id: number;
  vehicle_id: number;
  name: string;
  interval_km: Numeric;
  interval_days: number | null;
  last_service_km: Numeric;
  last_service_on: string | null;
  is_active: boolean;
  vehicle?: FleetVehicle;
};

export type FleetServiceRecord = {
  id: number;
  vehicle_id: number;
  schedule_id: number | null;
  type: string;
  description: string | null;
  serviced_on: string;
  odometer_km: Numeric;
  parts_cost: Numeric;
  labour_cost: Numeric;
  total_cost: Numeric;
  supplier: string | null;
  invoice_reference: string | null;
  downtime_hours: number;
  vehicle?: FleetVehicle;
};

export type FleetDocument = {
  id: number;
  vehicle_id: number | null;
  driver_id: number | null;
  type: string;
  reference: string | null;
  issuer: string | null;
  issued_on: string | null;
  expires_on: string;
  cost: Numeric;
  status: string;
  notes: string | null;
  is_expired?: boolean;
  /** Negative once expired, which makes it sortable by urgency. */
  days_to_expiry?: number | null;
  vehicle?: FleetVehicle;
  driver?: FleetDriver;
};

export type MaintenanceDue = {
  schedule_id: number;
  vehicle_id: number;
  vehicle: string;
  name: string;
  km_remaining: Numeric;
  days_remaining: number | null;
  is_due: boolean;
};

export type FleetOverview = {
  range: { from: string | null; to: string | null };
  fleet: {
    vehicles: number;
    active: number;
    in_service: number;
    grounded: number;
    drivers: number;
    total_odometer_km: Numeric;
    by_status: Array<{ status: string; label: string; count: number }>;
    by_type: Array<{ type: string; count: number }>;
  };
  utilisation: {
    trips: number;
    completed: number;
    in_progress: number;
    cancelled: number;
    distance_km: Numeric;
    average_trip_km: Numeric;
    by_vehicle: Array<{ vehicle_id: number; trips: number; distance_km: Numeric }>;
  };
  fuel: {
    fills: number;
    litres: Numeric;
    cost: Numeric;
    average_cost_per_litre: Numeric;
    average_efficiency_km_per_litre: Numeric;
    measured_fills: number;
    by_vehicle: Array<{
      vehicle_id: number;
      fills: number;
      litres: Numeric;
      cost: Numeric;
      efficiency: Numeric;
    }>;
  };
  maintenance: {
    services: number;
    cost: Numeric;
    parts_cost: Numeric;
    labour_cost: Numeric;
    downtime_hours: number;
    due_now: number;
    due_soon: number;
    by_type: Array<{ type: string; label: string; count: number; cost: Numeric }>;
    due: MaintenanceDue[];
  };
  cost: {
    fuel: Numeric;
    maintenance: Numeric;
    total: Numeric;
    distance_km: Numeric;
    per_km: Numeric;
    fuel_per_km: Numeric;
    maintenance_per_km: Numeric;
  };
  compliance: {
    documents: number;
    expired: number;
    expiring_soon: number;
    licences_expired: number;
    licences_unknown: number;
    upcoming: Array<{
      document_id: number;
      type: string;
      subject: string;
      expires_on: string | null;
      days_to_expiry: number | null;
      is_expired: boolean;
    }>;
  };
  integrations: { human_resources: boolean; supply_chain: boolean };
};
